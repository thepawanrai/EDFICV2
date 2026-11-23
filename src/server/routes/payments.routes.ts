import crypto from 'crypto';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { logAudit } from '../lib/security.ts';
import {
  EVIDENCE_DIR,
  isValidEvidenceBuffer,
  resolvePrivateFile,
  savePrivateFile,
} from '../lib/storage.ts';
import {
  AuthenticatedRequest,
  authenticateOptional,
  requireAuth,
  requireRole,
} from '../middleware/auth.ts';
import { dispatchN8nEvent, dispatchWhatsAppMessage } from '../services/automation.ts';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

const submitUtrSchema = z.object({
  bookingReference: z.string().min(6).max(32),
  phone: z.string().min(10).max(15),
  utrReference: z.string().min(6).max(60),
  amountSubmittedInr: z.coerce.number().int().min(100).max(100000),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(400).optional(),
});

const manualPaymentSchema = z.object({
  appointmentId: z.string().min(1),
  paymentMethod: z.enum(['UPI', 'CASH', 'CARD', 'BANK_TRANSFER']).default('UPI'),
  utrReference: z.string().min(2).max(60),
  amountSubmittedInr: z.coerce.number().int().min(1).max(200000),
  totalServiceFeeInr: z.coerce.number().int().min(0).max(200000).optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  verifyImmediately: z.boolean().default(true),
  notes: z.string().max(400).optional(),
});

const verifySchema = z.object({
  totalServiceFeeInr: z.coerce.number().int().min(0).max(200000).optional(),
  notes: z.string().max(400).optional(),
});

const rejectSchema = z.object({
  rejectionReason: z.string().min(4).max(300),
});

const refundSchema = z.object({
  refundReason: z.string().min(4).max(300),
});

function nextReceiptNumber() {
  return `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
    .randomBytes(2)
    .toString('hex')
    .toUpperCase()}`;
}

// CRITICAL RULE: Uploading screenshot/UTR NEVER automatically marks payment VERIFIED.
// Verification requires explicit action by RECEPTION or SUPER_ADMIN.
router.post(
  '/submit-utr',
  authenticateOptional,
  upload.single('evidence'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = submitUtrSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error:
          'Valid booking reference, phone, UTR/reference, amount, and payment date are required.',
      });
      return;
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        bookingReference: parsed.data.bookingReference.trim().toUpperCase(),
        patientPhone: parsed.data.phone.trim(),
      },
      include: {
        service: true,
      },
    });

    if (!appointment) {
      res.status(404).json({
        error: 'Matching appointment not found for that booking reference and phone.',
      });
      return;
    }

    if (appointment.status === 'CANCELLED') {
      res.status(409).json({
        error: 'This appointment has been cancelled or expired. Please reserve a fresh slot.',
      });
      return;
    }

    let evidenceFilePath: string | null = null;
    let evidenceMimeType: string | null = null;

    if (req.file) {
      if (!isValidEvidenceBuffer(req.file.buffer, req.file.mimetype)) {
        res.status(400).json({
          error: 'Evidence file must be a valid PNG, JPEG, or PDF document.',
        });
        return;
      }
      const ext = path.extname(req.file.originalname) || '.png';
      evidenceFilePath = savePrivateFile(EVIDENCE_DIR, ext, req.file.buffer);
      evidenceMimeType = req.file.mimetype;
    }

    const settings = await prisma.clinicSetting.findUnique({ where: { id: 'singleton' } });
    const expectedAdvanceInr =
      appointment.service.advanceAmountInr || settings?.defaultAdvanceAmountInr || 500;

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          paymentMethod: 'UPI',
          expectedAdvanceInr,
          amountSubmittedInr: parsed.data.amountSubmittedInr,
          utrReference: parsed.data.utrReference.trim(),
          paymentDate: parsed.data.paymentDate,
          evidenceFilePath,
          evidenceMimeType,
          status: 'SUBMITTED',
          notes: parsed.data.notes?.trim() || null,
        },
      });

      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: 'ADVANCE_SUBMITTED',
          reservationExpiresAt: null,
        },
      });

      return created;
    });

    await logAudit({
      actorUserId: req.auth?.userId ?? null,
      actorRole: req.auth?.role ?? 'PUBLIC',
      action: 'UPI_PAYMENT_SUBMITTED',
      resourceType: 'Payment',
      resourceId: payment.id,
      summary: `UTR ${payment.utrReference} (INR ${payment.amountSubmittedInr}) submitted for ${appointment.bookingReference}; awaiting manual reception verification`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `pay-sub-${payment.id}`,
      eventType: 'payment.submitted',
      payload: {
        bookingReference: appointment.bookingReference,
        utrReference: payment.utrReference,
        amountSubmittedInr: payment.amountSubmittedInr,
        patientPhone: appointment.patientPhone,
      },
    });

    res.status(201).json({
      payment: {
        id: payment.id,
        status: payment.status,
        utrReference: payment.utrReference,
        amountSubmittedInr: payment.amountSubmittedInr,
        paymentDate: payment.paymentDate,
      },
      message:
        'Payment reference recorded (status: Submitted). EDFIC reception staff will manually verify the transaction before confirming your slot.',
    });
  }
);

// Record Manual / Desk Payment (UPI, Cash, Card, Bank Transfer) by Reception/Super Admin
router.post(
  '/manual',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = manualPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid appointmentId, method, reference, and amount required.' });
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: parsed.data.appointmentId },
      include: { service: true, patient: true },
    });
    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    const settings = await prisma.clinicSetting.findUnique({ where: { id: 'singleton' } });
    const expectedAdvanceInr =
      appointment.service.advanceAmountInr || settings?.defaultAdvanceAmountInr || 500;
    const payDate = parsed.data.paymentDate || new Date().toISOString().slice(0, 10);
    const receiptNumber = parsed.data.verifyImmediately ? nextReceiptNumber() : null;

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          receiptNumber,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          paymentMethod: parsed.data.paymentMethod,
          expectedAdvanceInr,
          amountSubmittedInr: parsed.data.amountSubmittedInr,
          totalServiceFeeInr: parsed.data.totalServiceFeeInr ?? 0,
          utrReference: parsed.data.utrReference.trim(),
          paymentDate: payDate,
          status: parsed.data.verifyImmediately ? 'VERIFIED' : 'UNDER_VERIFICATION',
          verifiedById: parsed.data.verifyImmediately ? req.auth!.userId : null,
          verifiedAt: parsed.data.verifyImmediately ? new Date() : null,
          notes: parsed.data.notes?.trim() || 'Recorded at EDFIC reception desk',
        },
      });

      if (parsed.data.verifyImmediately) {
        await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            status:
              appointment.status === 'PENDING_ADVANCE' ||
              appointment.status === 'ADVANCE_SUBMITTED'
                ? 'CONFIRMED'
                : appointment.status,
            reservationExpiresAt: null,
          },
        });
      }

      return created;
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'MANUAL_PAYMENT_RECORDED',
      resourceType: 'Payment',
      resourceId: payment.id,
      summary: `Recorded ${payment.paymentMethod} payment INR ${payment.amountSubmittedInr} (${payment.status}) for ${appointment.bookingReference}`,
      ipAddress: req.ip,
    });

    if (payment.status === 'VERIFIED') {
      await dispatchN8nEvent({
        eventId: `pay-verified-${payment.id}`,
        eventType: 'payment.verified',
        payload: {
          receiptNumber: payment.receiptNumber,
          bookingReference: appointment.bookingReference,
          amountVerifiedInr: payment.amountSubmittedInr,
          paymentMethod: payment.paymentMethod,
        },
      });

      await dispatchWhatsAppMessage({
        eventId: `wa-pay-verified-${payment.id}`,
        recipientPhone: appointment.patient.phone,
        templateKey: 'PAYMENT_ACKNOWLEDGED',
        appointmentId: appointment.id,
        templateVariables: [
          payment.receiptNumber || payment.utrReference,
          String(payment.amountSubmittedInr),
          appointment.bookingReference,
        ],
        messageBody: `EDFIC Payment Verified: INR ${payment.amountSubmittedInr} (Receipt ${payment.receiptNumber || payment.utrReference}) confirmed for booking ${appointment.bookingReference}.`,
      });

      if (
        appointment.status === 'PENDING_ADVANCE' ||
        appointment.status === 'ADVANCE_SUBMITTED'
      ) {
        await dispatchN8nEvent({
          eventId: `appt-confirmed-${appointment.id}`,
          eventType: 'appointment.confirmed',
          payload: {
            bookingReference: appointment.bookingReference,
            serviceName: appointment.service.name,
            appointmentDate: appointment.appointmentDate,
            startTime: appointment.startTime,
            patientPhone: appointment.patientPhone,
          },
        });

        await dispatchWhatsAppMessage({
          eventId: `wa-appt-confirmed-${appointment.id}`,
          recipientPhone: appointment.patientPhone,
          templateKey: 'APPOINTMENT_CONFIRMED',
          appointmentId: appointment.id,
          templateVariables: [
            appointment.bookingReference,
            appointment.service.name,
            appointment.appointmentDate,
            appointment.startTime,
          ],
          messageBody: `EDFIC Confirmation: Your appointment ${appointment.bookingReference} for ${appointment.service.name} is confirmed on ${appointment.appointmentDate} at ${appointment.startTime}.`,
        });
      }
    }

    res.status(201).json({ payment });
  }
);

router.get(
  '/',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const payments = await prisma.payment.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        appointment: {
          select: {
            id: true,
            bookingReference: true,
            appointmentDate: true,
            startTime: true,
            status: true,
            service: { select: { name: true } },
          },
        },
        patient: {
          select: {
            id: true,
            patientCode: true,
            fullName: true,
            phone: true,
          },
        },
        verifiedBy: {
          select: { fullName: true },
        },
      },
    });
    res.json({ payments });
  }
);

router.get(
  '/:id/evidence',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment || !payment.evidenceFilePath) {
      res.status(404).json({ error: 'Payment evidence file not found.' });
      return;
    }
    const fullPath = resolvePrivateFile(EVIDENCE_DIR, payment.evidenceFilePath);
    if (!fullPath) {
      res.status(404).json({ error: 'Stored evidence file missing on disk.' });
      return;
    }
    res.setHeader('Content-Type', payment.evidenceMimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(fullPath);
  }
);

router.get('/:id/receipt', requireAuth, async (req: AuthenticatedRequest, res) => {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    include: {
      appointment: {
        include: {
          service: { select: { name: true, code: true } },
          payments: { where: { status: 'VERIFIED' }, select: { amountSubmittedInr: true } },
        },
      },
      patient: {
        select: {
          userId: true,
          patientCode: true,
          fullName: true,
          phone: true,
        },
      },
      verifiedBy: { select: { fullName: true } },
    },
  });

  if (!payment) {
    res.status(404).json({ error: 'Payment receipt not found.' });
    return;
  }

  const isStaff = ['SUPER_ADMIN', 'RECEPTION'].includes(req.auth!.role);
  const isOwner = payment.patient.userId === req.auth!.userId;
  if (!isStaff && !isOwner) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const totalVerifiedForAppt = payment.appointment.payments.reduce(
    (sum, p) => sum + p.amountSubmittedInr,
    0
  );
  const balanceDueInr =
    payment.totalServiceFeeInr > 0
      ? Math.max(0, payment.totalServiceFeeInr - totalVerifiedForAppt)
      : 0;

  res.json({
    receipt: {
      receiptNumber: payment.receiptNumber,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      utrReference: payment.utrReference,
      paymentDate: payment.paymentDate,
      amountPaidInr: payment.amountSubmittedInr,
      totalServiceFeeInr: payment.totalServiceFeeInr,
      totalVerifiedPaidInr: totalVerifiedForAppt,
      balanceDueInr,
      verifiedAt: payment.verifiedAt,
      verifiedBy: payment.verifiedBy?.fullName || null,
      bookingReference: payment.appointment.bookingReference,
      appointmentDate: payment.appointment.appointmentDate,
      startTime: payment.appointment.startTime,
      serviceName: payment.appointment.service.name,
      patient: {
        patientCode: payment.patient.patientCode,
        fullName: payment.patient.fullName,
        phone: payment.patient.phone,
      },
    },
  });
});

router.post(
  '/:id/under-verification',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const existing = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { appointment: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }

    const updated = await prisma.payment.update({
      where: { id: existing.id },
      data: { status: 'UNDER_VERIFICATION' },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'PAYMENT_UNDER_VERIFICATION',
      resourceType: 'Payment',
      resourceId: updated.id,
      summary: `Marked UTR ${updated.utrReference} as Under Verification for ${existing.appointment.bookingReference}`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `pay-review-${updated.id}-${Date.now()}`,
      eventType: 'payment.under_verification',
      payload: {
        bookingReference: existing.appointment.bookingReference,
        utrReference: updated.utrReference,
      },
    });

    res.json({ payment: updated });
  }
);

router.post(
  '/:id/verify',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid verification payload.' });
      return;
    }

    const existing = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        appointment: { include: { service: true } },
        patient: true,
      },
    });
    if (!existing) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }

    const receiptNumber = existing.receiptNumber || nextReceiptNumber();

    const updated = await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: 'VERIFIED',
          receiptNumber,
          totalServiceFeeInr: parsed.data.totalServiceFeeInr ?? existing.totalServiceFeeInr,
          verifiedById: req.auth!.userId,
          verifiedAt: new Date(),
          notes: parsed.data.notes?.trim() || existing.notes,
        },
      });

      await tx.appointment.update({
        where: { id: existing.appointmentId },
        data: {
          status: 'CONFIRMED',
          reservationExpiresAt: null,
        },
      });

      return pay;
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'PAYMENT_VERIFIED',
      resourceType: 'Payment',
      resourceId: updated.id,
      summary: `Verified UTR ${updated.utrReference} (${receiptNumber}) for ${existing.appointment.bookingReference}`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `pay-verified-${updated.id}`,
      eventType: 'payment.verified',
      payload: {
        receiptNumber,
        bookingReference: existing.appointment.bookingReference,
        amountVerifiedInr: updated.amountSubmittedInr,
        appointmentDate: existing.appointment.appointmentDate,
        startTime: existing.appointment.startTime,
      },
    });

    await dispatchWhatsAppMessage({
      eventId: `wa-pay-verified-${updated.id}`,
      recipientPhone: existing.patient.phone,
      templateKey: 'PAYMENT_ACKNOWLEDGED',
      appointmentId: existing.appointmentId,
      templateVariables: [
        receiptNumber,
        String(updated.amountSubmittedInr),
        existing.appointment.bookingReference,
      ],
      messageBody: `EDFIC Payment Verified: Advance payment INR ${updated.amountSubmittedInr} (Receipt ${receiptNumber}) verified for ${existing.appointment.bookingReference}.`,
    });

    await dispatchN8nEvent({
      eventId: `appt-confirmed-${existing.appointmentId}`,
      eventType: 'appointment.confirmed',
      payload: {
        bookingReference: existing.appointment.bookingReference,
        serviceName: existing.appointment.service.name,
        appointmentDate: existing.appointment.appointmentDate,
        startTime: existing.appointment.startTime,
        patientPhone: existing.appointment.patientPhone,
        patientEmail: existing.appointment.patientEmail,
      },
    });

    await dispatchWhatsAppMessage({
      eventId: `wa-appt-confirmed-${existing.appointmentId}`,
      recipientPhone: existing.patient.phone,
      templateKey: 'APPOINTMENT_CONFIRMED',
      appointmentId: existing.appointmentId,
      templateVariables: [
        existing.appointment.bookingReference,
        existing.appointment.service.name,
        existing.appointment.appointmentDate,
        existing.appointment.startTime,
      ],
      messageBody: `EDFIC Confirmation: Your appointment ${existing.appointment.bookingReference} for ${existing.appointment.service.name} is confirmed on ${existing.appointment.appointmentDate} at ${existing.appointment.startTime}.`,
    });

    res.json({ payment: updated });
  }
);

router.post(
  '/:id/reject',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Rejection reason is required.' });
      return;
    }

    const existing = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { appointment: true, patient: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: 'REJECTED',
          rejectionReason: parsed.data.rejectionReason.trim(),
          verifiedById: req.auth!.userId,
          verifiedAt: new Date(),
        },
      });
      await tx.appointment.update({
        where: { id: existing.appointmentId },
        data: { status: 'PENDING_ADVANCE' },
      });
      return pay;
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'PAYMENT_REJECTED',
      resourceType: 'Payment',
      resourceId: updated.id,
      summary: `Rejected UTR ${updated.utrReference} for ${existing.appointment.bookingReference}: ${parsed.data.rejectionReason}`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `pay-rejected-${updated.id}-${Date.now()}`,
      eventType: 'payment.rejected',
      payload: {
        bookingReference: existing.appointment.bookingReference,
        utrReference: updated.utrReference,
        rejectionReason: updated.rejectionReason,
      },
    });

    await dispatchWhatsAppMessage({
      recipientPhone: existing.patient.phone,
      templateKey: 'PAYMENT_REJECTED',
      appointmentId: existing.appointmentId,
      messageBody: `EDFIC Payment Notice: Reference ${updated.utrReference} for ${existing.appointment.bookingReference} could not be verified (${parsed.data.rejectionReason.trim()}). Please re-submit a valid UTR on the booking portal.`,
    });

    res.json({ payment: updated });
  }
);

router.post(
  '/:id/refund',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Refund reason is required.' });
      return;
    }

    const existing = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { appointment: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }
    if (existing.status !== 'VERIFIED') {
      res.status(422).json({ error: 'Only verified payments can be marked as refunded.' });
      return;
    }

    const updated = await prisma.payment.update({
      where: { id: existing.id },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        refundReason: parsed.data.refundReason.trim(),
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'PAYMENT_REFUNDED',
      resourceType: 'Payment',
      resourceId: updated.id,
      summary: `Refunded payment ${updated.receiptNumber || updated.utrReference} for ${existing.appointment.bookingReference}: ${parsed.data.refundReason}`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `pay-refunded-${updated.id}`,
      eventType: 'payment.refunded',
      payload: {
        receiptNumber: updated.receiptNumber,
        bookingReference: existing.appointment.bookingReference,
        amountRefundedInr: updated.amountSubmittedInr,
        refundReason: updated.refundReason,
      },
    });

    res.json({ payment: updated });
  }
);

export default router;
