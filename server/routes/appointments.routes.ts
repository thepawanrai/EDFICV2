import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { logAudit } from '../lib/security.ts';
import {
  AuthenticatedRequest,
  authenticateOptional,
  requireAuth,
  requireRole,
} from '../middleware/auth.ts';
import {
  dispatchEmailNotification,
  dispatchN8nEvent,
  dispatchWhatsAppMessage,
} from '../services/automation.ts';
import {
  bookAppointmentAtomic,
  expireStaleReservations,
  getAvailableSlots,
  holdSlotAtomic,
  minutesToTime,
  timeToMinutes,
  withDateLock,
} from '../services/scheduling.ts';

const router = Router();

const holdSchema = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  sessionToken: z.string().min(8).max(80),
});

const bookSchema = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  sessionToken: z.string().optional(),
  patientName: z.string().min(2).max(120),
  patientPhone: z.string().min(10).max(15),
  patientEmail: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  clinicalIndication: z.string().max(600).optional(),
  referringDoctor: z.string().max(120).optional(),
  bookingChannel: z.enum(['ONLINE', 'PHONE', 'WALK_IN']).optional(),
  consentAccepted: z.literal(true, {
    message: 'Patient consent and PCPNDT notice acknowledgment required.',
  }),
  isReceptionOverride: z.boolean().optional(),
  overrideReason: z.string().max(300).optional(),
  notes: z.string().max(600).optional(),
});

const lookupSchema = z.object({
  bookingReference: z.string().min(6).max(32),
  phone: z.string().min(10).max(15),
});

const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  isReceptionOverride: z.boolean().optional(),
  reason: z.string().max(300).optional(),
});

router.get('/slots', async (req, res) => {
  const date = String(req.query.date || '');
  const serviceId = String(req.query.serviceId || '');
  const sessionToken = req.query.sessionToken ? String(req.query.sessionToken) : undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceId) {
    res.status(400).json({ error: 'Valid date (YYYY-MM-DD) and serviceId are required.' });
    return;
  }

  try {
    const result = await getAvailableSlots({ date, serviceId, sessionToken });
    res.json(result);
  } catch (err: unknown) {
    res.status(404).json({
      error: err instanceof Error ? err.message : 'Unable to compute slots.',
    });
  }
});

router.post('/hold', async (req, res) => {
  const parsed = holdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid slot hold parameters.' });
    return;
  }

  try {
    const held = await holdSlotAtomic(parsed.data);
    res.json({
      heldUntil: held.heldUntil.toISOString(),
      startTime: held.startTime,
      date: held.date,
    });
  } catch (err: unknown) {
    res.status(409).json({
      error: err instanceof Error ? err.message : 'This time slot is no longer available.',
    });
  }
});

router.post('/book', authenticateOptional, async (req: AuthenticatedRequest, res) => {
  const parsed = bookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid appointment booking details.',
    });
    return;
  }

  const data = parsed.data;
  const isStaff = Boolean(
    req.auth && ['SUPER_ADMIN', 'RECEPTION'].includes(req.auth.role)
  );
  const bookingChannel = isStaff ? data.bookingChannel || 'PHONE' : 'ONLINE';

  try {
    const result = await bookAppointmentAtomic({
      ...data,
      bookingChannel,
      actorUserId: req.auth?.userId,
      actorRole: req.auth?.role,
    });

    await logAudit({
      actorUserId: req.auth?.userId ?? null,
      actorRole: req.auth?.role ?? 'PUBLIC',
      action:
        bookingChannel === 'PHONE' ? 'PHONE_APPOINTMENT_CREATED' : 'APPOINTMENT_CREATED',
      resourceType: 'Appointment',
      resourceId: result.appointment.id,
      summary: `Booked ${result.appointment.bookingReference} (${bookingChannel}) for ${result.appointment.service.name} on ${result.appointment.appointmentDate} ${result.appointment.startTime}`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `appt-created-${result.appointment.id}`,
      eventType: 'appointment.created',
      payload: {
        bookingReference: result.appointment.bookingReference,
        bookingChannel,
        serviceName: result.appointment.service.name,
        appointmentDate: result.appointment.appointmentDate,
        startTime: result.appointment.startTime,
        patientPhone: result.appointment.patientPhone,
        patientEmail: result.appointment.patientEmail,
      },
    });

    await dispatchWhatsAppMessage({
      eventId: `wa-appt-ack-${result.appointment.id}`,
      recipientPhone: result.appointment.patientPhone,
      templateKey: 'APPOINTMENT_ACKNOWLEDGMENT',
      appointmentId: result.appointment.id,
      templateVariables: [
        result.appointment.bookingReference,
        result.appointment.service.name,
        result.appointment.appointmentDate,
        result.appointment.startTime,
      ],
      messageBody: `EDFIC (A Unit of EWA DERMA): Appointment request ${result.appointment.bookingReference} received for ${result.appointment.service.name} on ${result.appointment.appointmentDate} at ${result.appointment.startTime}.`,
    });

    if (result.appointment.status === 'PENDING_ADVANCE') {
      await dispatchWhatsAppMessage({
        eventId: `wa-pay-instr-${result.appointment.id}`,
        recipientPhone: result.appointment.patientPhone,
        templateKey: 'PAYMENT_INSTRUCTIONS',
        appointmentId: result.appointment.id,
        templateVariables: [
          result.appointment.bookingReference,
          String(result.upiPayment.expectedAdvanceInr),
          result.upiPayment.upiId,
        ],
        messageBody: `EDFIC UPI Instructions (${result.appointment.bookingReference}): Please pay advance INR ${result.upiPayment.expectedAdvanceInr} to UPI ID ${result.upiPayment.upiId} (${result.upiPayment.merchantName}) and submit your UTR on the EDFIC booking portal for manual reception verification.`,
      });
    }

    await dispatchEmailNotification({
      eventId: `appt-created-${result.appointment.id}`,
      recipientEmail: result.appointment.patientEmail,
      templateKey: 'APPOINTMENT_ACKNOWLEDGMENT',
      bookingReference: result.appointment.bookingReference,
      subject: `EDFIC Appointment Request ${result.appointment.bookingReference}`,
      bodyText: `Your appointment request ${result.appointment.bookingReference} for ${result.appointment.service.name} on ${result.appointment.appointmentDate} at ${result.appointment.startTime} has been registered.`,
    });

    res.status(201).json(result);
  } catch (err: unknown) {
    res.status(409).json({
      error: err instanceof Error ? err.message : 'Unable to book appointment.',
    });
  }
});

router.post('/lookup', async (req, res) => {
  const parsed = lookupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Booking reference and 10-digit phone number required.' });
    return;
  }

  await expireStaleReservations();

  const appointment = await prisma.appointment.findFirst({
    where: {
      bookingReference: parsed.data.bookingReference.trim().toUpperCase(),
      patientPhone: parsed.data.phone.trim(),
    },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          preparationNotes: true,
          durationMinutes: true,
          advanceAmountInr: true,
        },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          receiptNumber: true,
          paymentMethod: true,
          expectedAdvanceInr: true,
          amountSubmittedInr: true,
          totalServiceFeeInr: true,
          utrReference: true,
          paymentDate: true,
          status: true,
          rejectionReason: true,
          verifiedAt: true,
        },
      },
    },
  });

  if (!appointment) {
    res.status(404).json({
      error: 'No matching appointment found for that booking reference and phone number.',
    });
    return;
  }

  const settings = await prisma.clinicSetting.findUnique({ where: { id: 'singleton' } });

  res.json({
    appointment,
    upiPayment: {
      upiId: settings?.upiId || 'edfic.lucknow@upi',
      merchantName:
        settings?.upiMerchantName || 'EWA Diagnostic & Fetal Imaging Centre',
      expectedAdvanceInr:
        appointment.service.advanceAmountInr || settings?.defaultAdvanceAmountInr || 500,
    },
  });
});

router.get(
  '/',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req, res) => {
    await expireStaleReservations();
    const date = req.query.date ? String(req.query.date) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    const appointments = await prisma.appointment.findMany({
      where: {
        ...(date ? { appointmentDate: date } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            fullName: true,
            phone: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            requiresDoctorMorning: true,
            advanceAmountInr: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            receiptNumber: true,
            paymentMethod: true,
            expectedAdvanceInr: true,
            amountSubmittedInr: true,
            totalServiceFeeInr: true,
            utrReference: true,
            paymentDate: true,
            status: true,
            verifiedAt: true,
          },
        },
        visit: {
          select: {
            id: true,
            visitNumber: true,
            status: true,
          },
        },
      },
    });

    res.json({ appointments });
  }
);

router.post(
  '/:id/confirm',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { payments: true, service: true },
    });
    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    const hasVerifiedPayment = appointment.payments.some((p) => p.status === 'VERIFIED');
    const override = Boolean(req.body?.isReceptionOverride);
    if (!hasVerifiedPayment && !override) {
      res.status(422).json({
        error:
          'Appointment requires a verified advance payment before confirmation unless Reception Override is explicitly authorized.',
      });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: 'CONFIRMED',
        reservationExpiresAt: null,
        isReceptionOverride: appointment.isReceptionOverride || override,
        overrideReason: override
          ? String(req.body?.overrideReason || 'Confirmed by reception override')
          : appointment.overrideReason,
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'APPOINTMENT_CONFIRMED',
      resourceType: 'Appointment',
      resourceId: updated.id,
      summary: `Confirmed ${updated.bookingReference} (override: ${override})`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `appt-confirmed-${updated.id}`,
      eventType: 'appointment.confirmed',
      payload: {
        bookingReference: updated.bookingReference,
        serviceName: appointment.service.name,
        appointmentDate: updated.appointmentDate,
        startTime: updated.startTime,
        patientPhone: updated.patientPhone,
        patientEmail: updated.patientEmail,
      },
    });

    await dispatchWhatsAppMessage({
      recipientPhone: updated.patientPhone,
      templateKey: 'APPOINTMENT_CONFIRMED',
      appointmentId: updated.id,
      messageBody: `EDFIC Confirmation: Your appointment ${updated.bookingReference} for ${appointment.service.name} is confirmed on ${updated.appointmentDate} at ${updated.startTime}.`,
    });

    await dispatchEmailNotification({
      eventId: `appt-confirmed-${updated.id}`,
      recipientEmail: updated.patientEmail,
      templateKey: 'APPOINTMENT_CONFIRMED',
      bookingReference: updated.bookingReference,
      subject: `EDFIC Appointment Confirmed: ${updated.bookingReference}`,
      bodyText: `Your appointment ${updated.bookingReference} for ${appointment.service.name} is confirmed on ${updated.appointmentDate} at ${updated.startTime}.`,
    });

    res.json({ appointment: updated });
  }
);

router.patch(
  '/:id/notes',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 1200) : '';
    const existing = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: { notes },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'APPOINTMENT_NOTES_UPDATED',
      resourceType: 'Appointment',
      resourceId: updated.id,
      summary: `Updated operational notes on ${updated.bookingReference}`,
      ipAddress: req.ip,
    });

    res.json({ appointment: updated });
  }
);

router.patch('/:id/reschedule', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid target date and time are required.' });
    return;
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { patient: true, service: true },
  });
  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  const isStaff = ['SUPER_ADMIN', 'RECEPTION'].includes(req.auth!.role);
  const isOwner = appointment.patient.userId === req.auth!.userId;
  if (!isStaff && !isOwner) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const allowOverride = Boolean(parsed.data.isReceptionOverride) && isStaff;

  try {
    const updated = await withDateLock(parsed.data.date, async () => {
      if (!allowOverride) {
        const avail = await getAvailableSlots({
          date: parsed.data.date,
          serviceId: appointment.serviceId,
        });
        const slot = avail.slots.find((s) => s.startTime === parsed.data.startTime);
        if (!slot || !slot.available) {
          throw new Error(slot?.reason || 'Requested reschedule slot is not available.');
        }
      }

      const endTime = minutesToTime(
        timeToMinutes(parsed.data.startTime) + (appointment.service.durationMinutes || 30)
      );

      return prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          appointmentDate: parsed.data.date,
          startTime: parsed.data.startTime,
          endTime,
          isReceptionOverride: allowOverride,
          notes: parsed.data.reason
            ? `${appointment.notes ? appointment.notes + '\n' : ''}Rescheduled: ${parsed.data.reason}`
            : appointment.notes,
        },
      });
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'APPOINTMENT_RESCHEDULED',
      resourceType: 'Appointment',
      resourceId: updated.id,
      summary: `Rescheduled ${updated.bookingReference} to ${updated.appointmentDate} ${updated.startTime}`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `appt-rescheduled-${updated.id}-${Date.now()}`,
      eventType: 'appointment.rescheduled',
      payload: {
        bookingReference: updated.bookingReference,
        appointmentDate: updated.appointmentDate,
        startTime: updated.startTime,
        patientPhone: updated.patientPhone,
        patientEmail: updated.patientEmail,
      },
    });

    await dispatchWhatsAppMessage({
      recipientPhone: updated.patientPhone,
      templateKey: 'APPOINTMENT_RESCHEDULED',
      appointmentId: updated.id,
      messageBody: `EDFIC Update: Appointment ${updated.bookingReference} has been rescheduled to ${updated.appointmentDate} at ${updated.startTime}.`,
    });

    await dispatchEmailNotification({
      eventId: `appt-rescheduled-${updated.id}-${Date.now()}`,
      recipientEmail: updated.patientEmail,
      templateKey: 'APPOINTMENT_RESCHEDULED',
      bookingReference: updated.bookingReference,
      subject: `EDFIC Appointment Rescheduled: ${updated.bookingReference}`,
      bodyText: `Your appointment ${updated.bookingReference} has been rescheduled to ${updated.appointmentDate} at ${updated.startTime}.`,
    });

    res.json({ appointment: updated });
  } catch (err: unknown) {
    res.status(409).json({
      error: err instanceof Error ? err.message : 'Unable to reschedule appointment.',
    });
  }
});

router.patch('/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { patient: true },
  });
  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  const isStaff = ['SUPER_ADMIN', 'RECEPTION'].includes(req.auth!.role);
  const isOwner = appointment.patient.userId === req.auth!.userId;
  if (!isStaff && !isOwner) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const reason =
    typeof req.body?.reason === 'string'
      ? req.body.reason.slice(0, 300)
      : 'Cancelled by request';
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: 'CANCELLED',
      cancelledReason: reason,
    },
  });

  await logAudit({
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: 'APPOINTMENT_CANCELLED',
    resourceType: 'Appointment',
    resourceId: updated.id,
    summary: `Cancelled ${updated.bookingReference}: ${reason}`,
    ipAddress: req.ip,
  });

  await dispatchN8nEvent({
    eventId: `appt-cancelled-${updated.id}-${Date.now()}`,
    eventType: 'appointment.cancelled',
    payload: {
      bookingReference: updated.bookingReference,
      reason,
      patientPhone: updated.patientPhone,
    },
  });

  await dispatchWhatsAppMessage({
    eventId: `wa-appt-cancel-${updated.id}`,
    recipientPhone: updated.patientPhone,
    templateKey: 'APPOINTMENT_CANCELLED',
    appointmentId: updated.id,
    templateVariables: [updated.bookingReference],
    messageBody: `EDFIC Notice: Appointment ${updated.bookingReference} has been cancelled (${reason}). Please contact EDFIC Reception to schedule another visit.`,
  });

  res.json({ appointment: updated });
});

router.post(
  '/:id/check-in',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { visit: true },
    });
    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }
    if (appointment.visit) {
      res.json({ visit: appointment.visit });
      return;
    }

    const visitNumber = `VIS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    const visit = await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: 'CHECKED_IN' },
      });
      return tx.visit.create({
        data: {
          visitNumber,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId ?? null,
          status: 'WAITING',
        },
      });
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'PATIENT_CHECKED_IN',
      resourceType: 'Visit',
      resourceId: visit.id,
      summary: `Checked in ${appointment.bookingReference} as visit ${visit.visitNumber}`,
      ipAddress: req.ip,
    });

    res.status(201).json({ visit });
  }
);

export default router;
