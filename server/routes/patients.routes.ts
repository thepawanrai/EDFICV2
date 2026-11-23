import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { logAudit } from '../lib/security.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { dispatchN8nEvent } from '../services/automation.ts';
import { generateNextPatientCode } from '../services/scheduling.ts';

const router = Router();

const createPatientSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  gender: z.string().max(30).optional(),
  address: z.string().max(400).optional(),
  emergencyContact: z.string().max(60).optional(),
  referredBy: z.string().max(120).optional(),
  consentAccepted: z.boolean().default(true),
  allowDuplicate: z.boolean().optional(),
});

const updatePatientSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().max(30).optional().nullable(),
  gender: z.string().max(30).optional().nullable(),
  address: z.string().max(400).optional().nullable(),
  emergencyContact: z.string().max(60).optional().nullable(),
  referredBy: z.string().max(120).optional().nullable(),
  consentAccepted: z.boolean().optional(),
});

const mergePatientsSchema = z.object({
  sourcePatientId: z.string().min(1),
  targetPatientId: z.string().min(1),
  reason: z.string().max(300).optional(),
});

function normalizePhoneTail(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

// Patient self-portal summary (strictly scoped to authenticated owner)
router.get('/me/portal', requireAuth, async (req: AuthenticatedRequest, res) => {
  const patient = await prisma.patient.findFirst({
    where: { userId: req.auth!.userId },
    include: {
      appointments: {
        orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
        include: {
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              preparationNotes: true,
              advanceAmountInr: true,
            },
          },
          payments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      visits: {
        orderBy: { checkedInAt: 'desc' },
        select: {
          id: true,
          visitNumber: true,
          checkedInAt: true,
          completedAt: true,
          status: true,
          appointment: {
            select: {
              bookingReference: true,
              service: { select: { name: true } },
            },
          },
        },
      },
      reports: {
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          reportCode: true,
          title: true,
          revisionNumber: true,
          fileName: true,
          fileSizeBytes: true,
          status: true,
          publishedAt: true,
          visit: { select: { visitNumber: true } },
        },
      },
    },
  });

  if (!patient) {
    res.json({ patient: null, appointments: [], visits: [], reports: [] });
    return;
  }

  const settings = await prisma.clinicSetting.findUnique({
    where: { id: 'singleton' },
    select: { upiId: true, upiMerchantName: true, defaultAdvanceAmountInr: true },
  });

  res.json({
    patient: {
      id: patient.id,
      patientCode: patient.patientCode,
      fullName: patient.fullName,
      phone: patient.phone,
      email: patient.email,
      dateOfBirth: patient.dateOfBirth,
      consentAccepted: patient.consentAccepted,
      consentTimestamp: patient.consentTimestamp,
    },
    appointments: patient.appointments,
    visits: patient.visits,
    reports: patient.reports,
    upiConfig: settings,
  });
});

// Duplicate detection across registered patients
router.get(
  '/duplicates',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (_req, res) => {
    const patients = await prisma.patient.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { appointments: true, visits: true, reports: true, payments: true } },
      },
    });

    const groupsMap = new Map<string, { matchReason: string; patients: typeof patients }>();

    const byPhone = new Map<string, typeof patients>();
    const byEmail = new Map<string, typeof patients>();

    for (const pt of patients) {
      const pKey = normalizePhoneTail(pt.phone);
      if (pKey) {
        const list = byPhone.get(pKey) ?? [];
        list.push(pt);
        byPhone.set(pKey, list);
      }
      const eKey = pt.email?.trim().toLowerCase();
      if (eKey) {
        const list = byEmail.get(eKey) ?? [];
        list.push(pt);
        byEmail.set(eKey, list);
      }
    }

    for (const [pKey, list] of byPhone.entries()) {
      if (list.length > 1) {
        groupsMap.set(`phone:${pKey}`, {
          matchReason: `Matching mobile number (${pKey})`,
          patients: list,
        });
      }
    }
    for (const [eKey, list] of byEmail.entries()) {
      if (list.length > 1) {
        const idsKey = list.map((x) => x.id).sort().join(',');
        const alreadyCovered = Array.from(groupsMap.values()).some(
          (g) => g.patients.map((x) => x.id).sort().join(',') === idsKey
        );
        if (!alreadyCovered) {
          groupsMap.set(`email:${eKey}`, {
            matchReason: `Matching email (${eKey})`,
            patients: list,
          });
        }
      }
    }

    res.json({ duplicateGroups: Array.from(groupsMap.values()) });
  }
);

// Staff patient search & listing
router.get(
  '/',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req, res) => {
    const q = String(req.query.q || '').trim();
    const patients = await prisma.patient.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q } },
              { phone: { contains: q } },
              { patientCode: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: {
        _count: {
          select: { appointments: true, visits: true, reports: true },
        },
      },
    });
    res.json({ patients });
  }
);

router.post(
  '/',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = createPatientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid patient full name and 10-digit phone are required.' });
      return;
    }

    const tail = normalizePhoneTail(parsed.data.phone);
    const emailNorm = parsed.data.email?.trim().toLowerCase() || null;

    if (!parsed.data.allowDuplicate) {
      const potentialDuplicates = await prisma.patient.findMany({
        where: {
          OR: [
            { phone: { contains: tail } },
            ...(emailNorm ? [{ email: emailNorm }] : []),
          ],
        },
        take: 5,
        select: { id: true, patientCode: true, fullName: true, phone: true, email: true },
      });

      if (potentialDuplicates.length > 0) {
        res.status(409).json({
          error: `Duplicate protection: found existing patient record (${potentialDuplicates[0].patientCode} - ${potentialDuplicates[0].fullName}).`,
          potentialDuplicates,
        });
        return;
      }
    }

    const patientCode = await generateNextPatientCode();
    const patient = await prisma.patient.create({
      data: {
        patientCode,
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone.trim(),
        email: emailNorm,
        dateOfBirth: parsed.data.dateOfBirth || null,
        gender: parsed.data.gender || null,
        address: parsed.data.address?.trim() || null,
        emergencyContact: parsed.data.emergencyContact?.trim() || null,
        referredBy: parsed.data.referredBy?.trim() || null,
        consentAccepted: parsed.data.consentAccepted,
        consentTimestamp: parsed.data.consentAccepted ? new Date() : null,
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'PATIENT_CREATED',
      resourceType: 'Patient',
      resourceId: patient.id,
      summary: `Created patient record ${patient.patientCode} (${patient.fullName})`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `patient-reg-${patient.id}`,
      eventType: 'patient.registered',
      payload: {
        patientCode: patient.patientCode,
        registrationChannel: 'STAFF_DESK',
        consentAccepted: patient.consentAccepted,
      },
    });

    res.status(201).json({ patient });
  }
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = updatePatientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid patient update payload.' });
      return;
    }

    const existing = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Patient record not found.' });
      return;
    }

    const patient = await prisma.patient.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.fullName ? { fullName: parsed.data.fullName.trim() } : {}),
        ...(parsed.data.phone ? { phone: parsed.data.phone.trim() } : {}),
        ...(parsed.data.email !== undefined
          ? { email: parsed.data.email ? parsed.data.email.trim().toLowerCase() : null }
          : {}),
        ...(parsed.data.dateOfBirth !== undefined
          ? { dateOfBirth: parsed.data.dateOfBirth }
          : {}),
        ...(parsed.data.gender !== undefined ? { gender: parsed.data.gender } : {}),
        ...(parsed.data.address !== undefined ? { address: parsed.data.address } : {}),
        ...(parsed.data.emergencyContact !== undefined
          ? { emergencyContact: parsed.data.emergencyContact }
          : {}),
        ...(parsed.data.referredBy !== undefined ? { referredBy: parsed.data.referredBy } : {}),
        ...(parsed.data.consentAccepted !== undefined
          ? {
              consentAccepted: parsed.data.consentAccepted,
              consentTimestamp: parsed.data.consentAccepted
                ? existing.consentTimestamp ?? new Date()
                : null,
            }
          : {}),
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'PATIENT_UPDATED',
      resourceType: 'Patient',
      resourceId: patient.id,
      summary: `Updated patient record ${patient.patientCode}`,
      ipAddress: req.ip,
    });

    res.json({ patient });
  }
);

// Authorized patient record merge (Super Admin & Reception)
router.post(
  '/merge',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = mergePatientsSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.sourcePatientId === parsed.data.targetPatientId) {
      res.status(400).json({ error: 'Select two distinct patient records to merge.' });
      return;
    }

    const [source, target] = await Promise.all([
      prisma.patient.findUnique({ where: { id: parsed.data.sourcePatientId } }),
      prisma.patient.findUnique({ where: { id: parsed.data.targetPatientId } }),
    ]);

    if (!source || !target) {
      res.status(404).json({ error: 'Source or target patient record not found.' });
      return;
    }

    if (source.userId && target.userId && source.userId !== target.userId) {
      res.status(409).json({
        error: 'Both patient records are linked to separate portal login accounts and cannot be auto-merged.',
      });
      return;
    }

    const merged = await prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: { patientId: source.id },
        data: { patientId: target.id },
      });
      await tx.payment.updateMany({
        where: { patientId: source.id },
        data: { patientId: target.id },
      });
      await tx.visit.updateMany({
        where: { patientId: source.id },
        data: { patientId: target.id },
      });
      await tx.diagnosticReport.updateMany({
        where: { patientId: source.id },
        data: { patientId: target.id },
      });
      await tx.reportDownloadLog.updateMany({
        where: { patientId: source.id },
        data: { patientId: target.id },
      });
      await tx.crmLead.updateMany({
        where: { convertedPatientId: source.id },
        data: { convertedPatientId: target.id },
      });

      const updatedTarget = await tx.patient.update({
        where: { id: target.id },
        data: {
          userId: target.userId ?? source.userId,
          email: target.email ?? source.email,
          dateOfBirth: target.dateOfBirth ?? source.dateOfBirth,
          gender: target.gender ?? source.gender,
          address: target.address ?? source.address,
          emergencyContact: target.emergencyContact ?? source.emergencyContact,
          referredBy: target.referredBy ?? source.referredBy,
          consentAccepted: target.consentAccepted || source.consentAccepted,
          consentTimestamp: target.consentTimestamp ?? source.consentTimestamp,
        },
      });

      await tx.patient.delete({ where: { id: source.id } });
      return updatedTarget;
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'PATIENT_RECORDS_MERGED',
      resourceType: 'Patient',
      resourceId: merged.id,
      summary: `Merged duplicate ${source.patientCode} into ${merged.patientCode}${parsed.data.reason ? ` (${parsed.data.reason})` : ''}`,
      ipAddress: req.ip,
    });

    res.json({ patient: merged, mergedFromCode: source.patientCode });
  }
);

router.get(
  '/:id',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        appointments: {
          orderBy: { appointmentDate: 'desc' },
          include: { service: { select: { name: true } } },
        },
        payments: { orderBy: { createdAt: 'desc' } },
        visits: {
          orderBy: { checkedInAt: 'desc' },
          include: {
            appointment: { include: { service: { select: { name: true } } } },
          },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reportCode: true,
            title: true,
            revisionNumber: true,
            status: true,
            publishedAt: true,
            createdAt: true,
            visit: { select: { visitNumber: true, appointment: { select: { bookingReference: true } } } },
          },
        },
      },
    });

    if (!patient) {
      res.status(404).json({ error: 'Patient record not found.' });
      return;
    }

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'PATIENT_RECORD_ACCESSED',
      resourceType: 'Patient',
      resourceId: patient.id,
      summary: `Accessed patient record ${patient.patientCode}`,
      ipAddress: req.ip,
    });

    // Restrict clinical visit notes & report details to SUPER_ADMIN
    const isClinical = req.auth!.role === 'SUPER_ADMIN';
    if (!isClinical) {
      patient.visits = patient.visits.map((v) => ({
        ...v,
        clinicalNotes: null,
      }));
    }

    res.json({ patient });
  }
);

export default router;
