import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { logAudit } from '../lib/security.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { dispatchN8nEvent, dispatchWhatsAppMessage } from '../services/automation.ts';
import { generateNextPatientCode } from '../services/scheduling.ts';

const router = Router();

const LEAD_STATUS_VALUES = [
  'NEW',
  'CONTACTED',
  'INFORMATION_PROVIDED',
  'APPOINTMENT_REQUESTED',
  'APPOINTMENT_CONFIRMED',
  'VISITED',
  'FOLLOW_UP',
  'SCHEDULED',
  'CONVERTED',
  'CLOSED',
] as const;

const createLeadSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal('')),
  source: z
    .enum(['WEBSITE_CONTACT', 'BOOKING_INQUIRY', 'WHATSAPP', 'REFERRAL', 'WALK_IN'])
    .default('WALK_IN'),
  interestedService: z.string().max(160).optional(),
  message: z.string().max(1500).optional(),
  notes: z.string().max(1500).optional(),
  assignedToId: z.string().optional(),
  followUpDueAt: z.string().optional(),
});

const updateLeadSchema = z.object({
  status: z.enum(LEAD_STATUS_VALUES).optional(),
  assignedToId: z.string().nullable().optional(),
  linkedAppointmentId: z.string().nullable().optional(),
  notes: z.string().max(2000).optional(),
  followUpDueAt: z.string().nullable().optional(),
});

const createTaskSchema = z.object({
  title: z.string().min(3).max(200),
  dueAt: z.string().optional(),
  assignedToId: z.string().optional(),
});

const linkAppointmentSchema = z.object({
  bookingReference: z.string().min(4).max(40).optional(),
  appointmentId: z.string().min(1).optional(),
});

// List assignable staff (Reception & Super Admin) for lead/follow-up assignment
router.get(
  '/assignees',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (_req, res) => {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['RECEPTION', 'SUPER_ADMIN'] },
      },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, role: true, email: true },
    });
    res.json({ users });
  }
);

router.get(
  '/',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const source = req.query.source ? String(req.query.source) : undefined;
    const assignedToId = req.query.assignedToId ? String(req.query.assignedToId) : undefined;
    const q = req.query.q ? String(req.query.q).trim() : '';

    const leads = await prisma.crmLead.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(source ? { source: source as never } : {}),
        ...(assignedToId ? { assignedToId } : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q } },
                { phone: { contains: q } },
                { leadCode: { contains: q } },
                { interestedService: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, fullName: true, role: true } },
        convertedPatient: { select: { id: true, patientCode: true, fullName: true } },
        linkedAppointment: {
          select: {
            id: true,
            bookingReference: true,
            appointmentDate: true,
            startTime: true,
            status: true,
            service: { select: { name: true } },
          },
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignedTo: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    res.json({ leads });
  }
);

router.post(
  '/',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid name and phone number required.' });
      return;
    }

    const leadCode = `CRM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const lead = await prisma.crmLead.create({
      data: {
        leadCode,
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone.trim(),
        email: parsed.data.email?.trim() || null,
        source: parsed.data.source,
        interestedService: parsed.data.interestedService?.trim() || null,
        message: parsed.data.message?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        assignedToId: parsed.data.assignedToId || req.auth!.userId,
        followUpDueAt: parsed.data.followUpDueAt ? new Date(parsed.data.followUpDueAt) : null,
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'CRM_LEAD_CREATED',
      resourceType: 'CrmLead',
      resourceId: lead.id,
      summary: `Created CRM lead ${lead.leadCode} (${lead.source})`,
      ipAddress: req.ip,
    });

    await dispatchN8nEvent({
      eventId: `crm-inquiry-${lead.id}`,
      eventType: 'crm.inquiry_created',
      payload: {
        leadCode: lead.leadCode,
        fullName: lead.fullName,
        source: lead.source,
        interestedService: lead.interestedService,
        assignedToId: lead.assignedToId,
      },
    });

    await dispatchWhatsAppMessage({
      eventId: `wa-inquiry-${lead.id}`,
      recipientPhone: lead.phone,
      templateKey: 'INQUIRY_ACKNOWLEDGMENT',
      messageBody: `EDFIC (A Unit of EWA DERMA): Your inquiry (${lead.leadCode}) has been registered with EDFIC Reception, Sushant Golf City, Lucknow.`,
    });

    res.status(201).json({ lead });
  }
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid CRM lead update payload.' });
      return;
    }

    const existing = await prisma.crmLead.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'CRM lead not found.' });
      return;
    }

    const lead = await prisma.crmLead.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.assignedToId !== undefined
          ? { assignedToId: parsed.data.assignedToId }
          : {}),
        ...(parsed.data.linkedAppointmentId !== undefined
          ? { linkedAppointmentId: parsed.data.linkedAppointmentId }
          : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.followUpDueAt !== undefined
          ? {
              followUpDueAt: parsed.data.followUpDueAt
                ? new Date(parsed.data.followUpDueAt)
                : null,
            }
          : {}),
      },
    });

    if (parsed.data.assignedToId && parsed.data.assignedToId !== existing.assignedToId) {
      await dispatchN8nEvent({
        eventId: `crm-assign-${lead.id}-${parsed.data.assignedToId}-${Date.now()}`,
        eventType: 'crm.lead_assigned',
        payload: {
          leadCode: lead.leadCode,
          assignedToId: parsed.data.assignedToId,
        },
      });
    }

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'CRM_LEAD_UPDATED',
      resourceType: 'CrmLead',
      resourceId: lead.id,
      summary: `Updated CRM lead ${lead.leadCode} (${lead.status})`,
      ipAddress: req.ip,
    });

    res.json({ lead });
  }
);

router.post(
  '/:id/link-appointment',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = linkAppointmentSchema.safeParse(req.body);
    if (!parsed.success || (!parsed.data.bookingReference && !parsed.data.appointmentId)) {
      res.status(400).json({ error: 'Provide bookingReference or appointmentId to link.' });
      return;
    }

    const lead = await prisma.crmLead.findUnique({ where: { id: req.params.id } });
    if (!lead) {
      res.status(404).json({ error: 'CRM lead not found.' });
      return;
    }

    const appointment = await prisma.appointment.findFirst({
      where: parsed.data.appointmentId
        ? { id: parsed.data.appointmentId }
        : { bookingReference: parsed.data.bookingReference!.trim().toUpperCase() },
      include: { service: { select: { name: true } } },
    });

    if (!appointment) {
      res.status(404).json({ error: 'Matching appointment not found.' });
      return;
    }

    const derivedStatus =
      appointment.status === 'COMPLETED'
        ? 'VISITED'
        : appointment.status === 'CONFIRMED' || appointment.status === 'CHECKED_IN'
          ? 'APPOINTMENT_CONFIRMED'
          : 'APPOINTMENT_REQUESTED';

    const updated = await prisma.crmLead.update({
      where: { id: lead.id },
      data: {
        linkedAppointmentId: appointment.id,
        convertedPatientId: lead.convertedPatientId || appointment.patientId,
        status: derivedStatus,
      },
      include: {
        linkedAppointment: {
          select: {
            id: true,
            bookingReference: true,
            appointmentDate: true,
            startTime: true,
            status: true,
            service: { select: { name: true } },
          },
        },
        convertedPatient: { select: { id: true, patientCode: true, fullName: true } },
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'CRM_APPOINTMENT_LINKED',
      resourceType: 'CrmLead',
      resourceId: lead.id,
      summary: `Linked appointment ${appointment.bookingReference} to CRM lead ${lead.leadCode}`,
      ipAddress: req.ip,
    });

    res.json({ lead: updated });
  }
);

router.post(
  '/:id/tasks',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Task title is required.' });
      return;
    }

    const task = await prisma.crmTask.create({
      data: {
        leadId: req.params.id,
        title: parsed.data.title.trim(),
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        assignedToId: parsed.data.assignedToId || req.auth!.userId,
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'CRM_TASK_CREATED',
      resourceType: 'CrmTask',
      resourceId: task.id,
      summary: `Created follow-up task "${task.title}" on lead ${req.params.id}`,
      ipAddress: req.ip,
    });

    res.status(201).json({ task });
  }
);

router.patch(
  '/tasks/:taskId/toggle',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const existing = await prisma.crmTask.findUnique({ where: { id: req.params.taskId } });
    if (!existing) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    const task = await prisma.crmTask.update({
      where: { id: existing.id },
      data: {
        isCompleted: !existing.isCompleted,
        completedAt: !existing.isCompleted ? new Date() : null,
      },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'CRM_TASK_TOGGLED',
      resourceType: 'CrmTask',
      resourceId: task.id,
      summary: `Marked follow-up task ${task.isCompleted ? 'completed' : 'reopened'}`,
      ipAddress: req.ip,
    });

    res.json({ task });
  }
);

router.post(
  '/:id/convert',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const lead = await prisma.crmLead.findUnique({ where: { id: req.params.id } });
    if (!lead) {
      res.status(404).json({ error: 'CRM lead not found.' });
      return;
    }

    if (lead.convertedPatientId) {
      const existingPatient = await prisma.patient.findUnique({
        where: { id: lead.convertedPatientId },
      });
      res.json({ patient: existingPatient, lead });
      return;
    }

    const patientCode = await generateNextPatientCode();
    const result = await prisma.$transaction(async (tx) => {
      let patient = await tx.patient.findFirst({ where: { phone: lead.phone } });
      if (!patient) {
        patient = await tx.patient.create({
          data: {
            patientCode,
            fullName: lead.fullName,
            phone: lead.phone,
            email: lead.email,
            consentAccepted: false,
          },
        });
      }

      const updatedLead = await tx.crmLead.update({
        where: { id: lead.id },
        data: {
          status: 'CONVERTED',
          convertedPatientId: patient.id,
        },
      });

      return { patient, lead: updatedLead };
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'CRM_LEAD_CONVERTED',
      resourceType: 'Patient',
      resourceId: result.patient.id,
      summary: `Converted CRM lead ${lead.leadCode} into patient ${result.patient.patientCode}`,
      ipAddress: req.ip,
    });

    res.json(result);
  }
);

export default router;
