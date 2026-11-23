import crypto from 'crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { logAudit } from '../lib/security.ts';
import {
  isValidPdfBuffer,
  REPORTS_DIR,
  resolvePrivateFile,
  savePrivateFile,
} from '../lib/storage.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { dispatchN8nEvent, dispatchWhatsAppMessage } from '../services/automation.ts';

const router = Router();

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB PDF max
});

const uploadMetaSchema = z.object({
  visitId: z.string().min(1).optional(),
  appointmentId: z.string().min(1).optional(),
  title: z.string().min(3).max(160),
});

// Authenticated patient's own published diagnostic reports (strict owner scoping)
router.get('/my-reports', requireAuth, async (req: AuthenticatedRequest, res) => {
  const reports = await prisma.diagnosticReport.findMany({
    where: {
      status: 'PUBLISHED',
      patient: { userId: req.auth!.userId },
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    select: {
      id: true,
      reportCode: true,
      title: true,
      revisionNumber: true,
      fileName: true,
      fileSizeBytes: true,
      publishedAt: true,
      visit: {
        select: {
          visitNumber: true,
          appointment: {
            select: {
              bookingReference: true,
              service: { select: { name: true } },
            },
          },
        },
      },
      reviewedBy: {
        select: { fullName: true },
      },
    },
  });

  res.json({ reports });
});

// Comprehensive Doctor workspace: today's appointments, upcoming appointments, visits & report revisions, assigned patients
router.get(
  '/doctor-queue',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [visits, appointments] = await Promise.all([
      prisma.visit.findMany({
        orderBy: { checkedInAt: 'desc' },
        take: 80,
        include: {
          patient: {
            select: {
              id: true,
              patientCode: true,
              fullName: true,
              phone: true,
              dateOfBirth: true,
              gender: true,
              consentAccepted: true,
            },
          },
          appointment: {
            select: {
              id: true,
              bookingReference: true,
              appointmentDate: true,
              startTime: true,
              endTime: true,
              clinicalIndication: true,
              referringDoctor: true,
              service: { select: { id: true, name: true, code: true } },
            },
          },
          reports: {
            orderBy: { revisionNumber: 'desc' },
            include: {
              uploadedBy: { select: { fullName: true } },
              reviewedBy: { select: { fullName: true } },
              downloadLogs: {
                orderBy: { downloadedAt: 'desc' },
                take: 10,
                include: {
                  downloadedBy: { select: { fullName: true, role: true } },
                },
              },
            },
          },
        },
      }),
      prisma.appointment.findMany({
        where: {
          status: { notIn: ['CANCELLED'] },
          OR: [
            { doctorId: null },
            { service: { requiresDoctorMorning: true } },
          ],
        },
        orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
        take: 100,
        include: {
          patient: {
            select: {
              id: true,
              patientCode: true,
              fullName: true,
              phone: true,
              consentAccepted: true,
            },
          },
          service: {
            select: { id: true, name: true, code: true, requiresDoctorMorning: true },
          },
          visit: {
            select: {
              id: true,
              visitNumber: true,
              status: true,
              reports: {
                orderBy: { revisionNumber: 'desc' },
                select: {
                  id: true,
                  reportCode: true,
                  revisionNumber: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const todayAppointments = appointments.filter((a) => a.appointmentDate === todayStr);
    const upcomingAppointments = appointments.filter((a) => a.appointmentDate > todayStr);

    const assignedPatientsMap = new Map<
      string,
      {
        id: string;
        patientCode: string;
        fullName: string;
        phone: string;
        consentAccepted: boolean;
        lastAppointmentDate: string;
        appointmentCount: number;
      }
    >();
    for (const appt of appointments) {
      const existing = assignedPatientsMap.get(appt.patient.id);
      if (!existing) {
        assignedPatientsMap.set(appt.patient.id, {
          ...appt.patient,
          lastAppointmentDate: appt.appointmentDate,
          appointmentCount: 1,
        });
      } else {
        existing.appointmentCount += 1;
        if (appt.appointmentDate > existing.lastAppointmentDate) {
          existing.lastAppointmentDate = appt.appointmentDate;
        }
      }
    }

    res.json({
      todayDate: todayStr,
      visits,
      todayAppointments,
      upcomingAppointments,
      assignedPatients: Array.from(assignedPatientsMap.values()),
    });
  }
);

router.patch(
  '/visits/:visitId',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const status = req.body?.status;
    const clinicalNotes =
      typeof req.body?.clinicalNotes === 'string' ? req.body.clinicalNotes.slice(0, 2000) : undefined;

    const visit = await prisma.visit.update({
      where: { id: req.params.visitId },
      data: {
        ...(status ? { status } : {}),
        ...(clinicalNotes !== undefined ? { clinicalNotes } : {}),
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
    });

    if (status === 'COMPLETED') {
      await prisma.appointment.update({
        where: { id: visit.appointmentId },
        data: { status: 'COMPLETED' },
      });
    } else if (status === 'IN_SCAN') {
      await prisma.appointment.update({
        where: { id: visit.appointmentId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'VISIT_UPDATED',
      resourceType: 'Visit',
      resourceId: visit.id,
      summary: `Updated visit ${visit.visitNumber} status to ${visit.status}`,
      ipAddress: req.ip,
    });

    res.json({ visit });
  }
);

// Upload report PDF (associated with Visit AND Appointment; creates next revision)
router.post(
  '/upload',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  uploadPdf.single('reportPdf'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = uploadMetaSchema.safeParse(req.body);
    if (!parsed.success || (!parsed.data.visitId && !parsed.data.appointmentId) || !req.file) {
      res.status(400).json({
        error: 'Visit ID or Appointment ID, report title, and a valid PDF file are required.',
      });
      return;
    }

    if (req.file.mimetype !== 'application/pdf' || !isValidPdfBuffer(req.file.buffer)) {
      res.status(400).json({ error: 'Invalid file format. Only verified PDF reports are accepted.' });
      return;
    }

    let visit = parsed.data.visitId
      ? await prisma.visit.findUnique({
          where: { id: parsed.data.visitId },
          include: { reports: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
        })
      : await prisma.visit.findUnique({
          where: { appointmentId: parsed.data.appointmentId! },
          include: { reports: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
        });

    if (!visit && parsed.data.appointmentId) {
      const appt = await prisma.appointment.findUnique({
        where: { id: parsed.data.appointmentId },
      });
      if (!appt) {
        res.status(404).json({ error: 'Associated appointment not found.' });
        return;
      }
      const visitNumber = `VIS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
        .randomBytes(2)
        .toString('hex')
        .toUpperCase()}`;
      visit = await prisma.visit.create({
        data: {
          visitNumber,
          appointmentId: appt.id,
          patientId: appt.patientId,
          doctorId: appt.doctorId ?? req.auth!.userId,
          status: 'IN_SCAN',
        },
        include: { reports: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
      });
    }

    if (!visit) {
      res.status(404).json({ error: 'Clinical visit record not found.' });
      return;
    }

    const nextRevision = (visit.reports[0]?.revisionNumber ?? 0) + 1;
    const storedFilePath = savePrivateFile(REPORTS_DIR, '.pdf', req.file.buffer);
    const reportCode = `RPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    const report = await prisma.diagnosticReport.create({
      data: {
        reportCode,
        patientId: visit.patientId,
        visitId: visit.id,
        uploadedById: req.auth!.userId,
        title: parsed.data.title.trim(),
        revisionNumber: nextRevision,
        fileName: req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'),
        storedFilePath,
        fileSizeBytes: req.file.size,
        mimeType: 'application/pdf',
        status: nextRevision > 1 ? 'REVISED' : 'UNDER_REVIEW',
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'REPORT_UPLOADED',
      resourceType: 'DiagnosticReport',
      resourceId: report.id,
      summary: `Uploaded ${report.reportCode} (Rev ${report.revisionNumber}) for visit ${visit.visitNumber}`,
      ipAddress: req.ip,
    });

    res.status(201).json({ report });
  }
);

router.post(
  '/:id/review',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const existing = await prisma.diagnosticReport.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Diagnostic report not found.' });
      return;
    }

    const updated = await prisma.diagnosticReport.update({
      where: { id: existing.id },
      data: {
        reviewedById: req.auth!.userId,
        status: existing.status === 'DRAFT' ? 'UNDER_REVIEW' : existing.status,
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'REPORT_REVIEWED',
      resourceType: 'DiagnosticReport',
      resourceId: updated.id,
      summary: `Medical staff reviewed ${updated.reportCode} (Rev ${updated.revisionNumber})`,
      ipAddress: req.ip,
    });

    res.json({ report: updated });
  }
);

router.post(
  '/:id/publish',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const existing = await prisma.diagnosticReport.findUnique({
      where: { id: req.params.id },
      include: { patient: true, visit: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Diagnostic report not found.' });
      return;
    }

    const report = await prisma.$transaction(async (tx) => {
      const updated = await tx.diagnosticReport.update({
        where: { id: existing.id },
        data: {
          status: 'PUBLISHED',
          reviewedById: req.auth!.userId,
          publishedAt: new Date(),
        },
      });
      await tx.visit.update({
        where: { id: existing.visitId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.appointment.update({
        where: { id: existing.visit.appointmentId },
        data: { status: 'COMPLETED' },
      });
      return updated;
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'REPORT_PUBLISHED',
      resourceType: 'DiagnosticReport',
      resourceId: report.id,
      summary: `Published diagnostic report ${report.reportCode} (Rev ${report.revisionNumber})`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `report-pub-${report.id}-rev${report.revisionNumber}`,
      eventType: 'report.published',
      payload: {
        reportCode: report.reportCode,
        patientCode: existing.patient.patientCode,
        visitNumber: existing.visit.visitNumber,
      },
    });

    // Strict Compliance: send ONLY portal access notice; NEVER send report PDF or clinical findings via WhatsApp
    await dispatchWhatsAppMessage({
      eventId: `wa-report-pub-${report.id}-rev${report.revisionNumber}`,
      recipientPhone: existing.patient.phone,
      templateKey: 'REPORT_PORTAL_NOTICE',
      appointmentId: existing.visit.appointmentId,
      templateVariables: [report.reportCode, '/patient/portal'],
      messageBody: `EDFIC Notice: Your diagnostic report (${report.reportCode}) is now available in your secure Patient Portal (/patient/portal). Sign in with your registered EDFIC account to access it.`,
    });

    res.json({ report });
  }
);

// Authenticated, private PDF download with download audit log - NO public report URLs
router.get('/:id/download', requireAuth, async (req: AuthenticatedRequest, res) => {
  const report = await prisma.diagnosticReport.findUnique({
    where: { id: req.params.id },
    include: { patient: true },
  });
  if (!report) {
    res.status(404).json({ error: 'Diagnostic report not found.' });
    return;
  }

  const isAdmin = req.auth!.role === 'SUPER_ADMIN';
  const isPatientOwner =
    report.patient.userId === req.auth!.userId && report.status === 'PUBLISHED';

  if (!isAdmin && !isPatientOwner) {
    res.status(403).json({
      error: 'Access denied: you are not authorized to download this diagnostic report.',
    });
    return;
  }

  const fullPath = resolvePrivateFile(REPORTS_DIR, report.storedFilePath);
  if (!fullPath) {
    res.status(404).json({ error: 'Report PDF file is unavailable in private storage.' });
    return;
  }

  await prisma.reportDownloadLog.create({
    data: {
      reportId: report.id,
      downloadedById: req.auth!.userId,
      patientId: report.patientId,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent']?.slice(0, 200) ?? null,
    },
  });

  await logAudit({
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: 'REPORT_DOWNLOADED',
    resourceType: 'DiagnosticReport',
    resourceId: report.id,
    summary: `Downloaded ${report.reportCode} (${report.fileName})`,
    ipAddress: req.ip,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${report.reportCode}-rev${report.revisionNumber}.pdf"`
  );
  res.setHeader('Cache-Control', 'no-store, private');
  res.sendFile(fullPath);
});

export default router;
