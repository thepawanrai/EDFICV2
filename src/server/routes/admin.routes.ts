import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { hashPassword, logAudit } from '../lib/security.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  dispatchDailyReceptionSummary,
  resolveWhatsAppTemplates,
  retryFailedWebhooks,
  retryWebhookEvent,
  testN8nConnection,
  testWhatsAppConnection,
  triggerUpcomingAppointmentReminders,
  validateOutboundUrl,
} from '../services/automation.ts';

const router = Router();

const templateMapSchema = z
  .object({
    INQUIRY_ACKNOWLEDGMENT: z.string().max(120).optional(),
    APPOINTMENT_ACKNOWLEDGMENT: z.string().max(120).optional(),
    BOOKING_REFERENCE: z.string().max(120).optional(),
    PAYMENT_INSTRUCTIONS: z.string().max(120).optional(),
    PAYMENT_ACKNOWLEDGED: z.string().max(120).optional(),
    PAYMENT_REJECTED: z.string().max(120).optional(),
    APPOINTMENT_CONFIRMED: z.string().max(120).optional(),
    APPOINTMENT_REMINDER: z.string().max(120).optional(),
    APPOINTMENT_RESCHEDULED: z.string().max(120).optional(),
    APPOINTMENT_CANCELLED: z.string().max(120).optional(),
    REPORT_PORTAL_NOTICE: z.string().max(120).optional(),
  })
  .optional();

const settingsSchema = z.object({
  primaryPhone: z.string().max(40).optional(),
  secondaryPhone: z.string().max(40).optional(),
  whatsappNumber: z.string().max(40).optional(),
  officialEmail: z.string().max(120).optional(),
  weekdayHours: z.string().max(160).optional(),
  sundayHours: z.string().max(160).optional(),
  slotDurationMinutes: z.coerce.number().int().min(10).max(60).optional(),
  slotCapacityPerSlot: z.coerce.number().int().min(1).max(10).optional(),
  maxDailyAppointments: z.coerce.number().int().min(5).max(200).optional(),
  reservationExpiryMinutes: z.coerce.number().int().min(5).max(180).optional(),
  morningSessionStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  morningSessionEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  upiId: z.string().min(3).max(120).optional(),
  upiMerchantName: z.string().min(2).max(160).optional(),
  defaultAdvanceAmountInr: z.coerce.number().int().min(100).max(20000).optional(),
  n8nWebhookUrl: z.string().max(300).optional(),
  n8nWebhookSecret: z.string().max(200).optional(),
  n8nApiKey: z.string().max(200).optional(),
  whatsappProvider: z.string().max(60).optional(),
  whatsappApiUrl: z.string().max(300).optional(),
  whatsappPhoneNumberId: z.string().max(100).optional(),
  whatsappAccessToken: z.string().max(400).optional(),
  whatsappWebhookSecret: z.string().max(200).optional(),
  whatsappTemplates: templateMapSchema,
});

function maskHint(val?: string | null): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  return trimmed.length <= 4 ? '••••' : `••••${trimmed.slice(-4)}`;
}

function sanitizeSettings(settings: Awaited<ReturnType<typeof prisma.clinicSetting.findUnique>>) {
  if (!settings) return null;
  const {
    n8nWebhookSecret,
    n8nApiKey,
    whatsappAccessToken,
    whatsappWebhookSecret,
    ...safeFields
  } = settings;

  const effectiveN8nSecret = n8nWebhookSecret || process.env.N8N_WEBHOOK_SECRET || '';
  const effectiveN8nApiKey = n8nApiKey || process.env.N8N_API_KEY || '';
  const effectiveWaToken = whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
  const effectiveWaWebhookSecret =
    whatsappWebhookSecret || process.env.WHATSAPP_WEBHOOK_SECRET || '';

  return {
    ...safeFields,
    hasN8nWebhookSecret: Boolean(effectiveN8nSecret),
    n8nWebhookSecretHint: maskHint(effectiveN8nSecret),
    hasN8nApiKey: Boolean(effectiveN8nApiKey),
    n8nApiKeyHint: maskHint(effectiveN8nApiKey),
    hasWhatsappAccessToken: Boolean(effectiveWaToken),
    whatsappAccessTokenHint: maskHint(effectiveWaToken),
    hasWhatsappWebhookSecret: Boolean(effectiveWaWebhookSecret),
    whatsappWebhookSecretHint: maskHint(effectiveWaWebhookSecret),
    whatsappTemplates: resolveWhatsAppTemplates(settings.whatsappTemplatesJson),
  };
}

const createStaffSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  phone: z.string().max(20).optional(),
  role: z.enum(['SUPER_ADMIN', 'RECEPTION']),
  password: z.string().min(8).max(100),
});

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(2).max(160),
});

router.get(
  '/settings',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (_req, res) => {
    const settings = await prisma.clinicSetting.findUnique({ where: { id: 'singleton' } });
    const holidays = await prisma.clinicHoliday.findMany({ orderBy: { date: 'asc' } });
    res.json({ settings: sanitizeSettings(settings), holidays });
  }
);

router.put(
  '/settings',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid clinic settings payload.' });
      return;
    }

    const {
      n8nWebhookSecret,
      n8nApiKey,
      whatsappAccessToken,
      whatsappWebhookSecret,
      whatsappTemplates,
      ...rest
    } = parsed.data;

    if (rest.n8nWebhookUrl) {
      const n8nCheck = validateOutboundUrl(rest.n8nWebhookUrl);
      if (!n8nCheck.valid) {
        res.status(400).json({ error: `Invalid n8n webhook URL: ${n8nCheck.reason}` });
        return;
      }
    }
    if (rest.whatsappApiUrl) {
      const waCheck = validateOutboundUrl(rest.whatsappApiUrl);
      if (!waCheck.valid) {
        res.status(400).json({ error: `Invalid WhatsApp API URL: ${waCheck.reason}` });
        return;
      }
    }

    const updateData: Record<string, unknown> = { ...rest };

    // Never overwrite saved secrets when left empty in UI form
    if (typeof n8nWebhookSecret === 'string' && n8nWebhookSecret.trim().length > 0) {
      updateData.n8nWebhookSecret = n8nWebhookSecret.trim();
    }
    if (typeof n8nApiKey === 'string' && n8nApiKey.trim().length > 0) {
      updateData.n8nApiKey = n8nApiKey.trim();
    }
    if (typeof whatsappAccessToken === 'string' && whatsappAccessToken.trim().length > 0) {
      updateData.whatsappAccessToken = whatsappAccessToken.trim();
    }
    if (typeof whatsappWebhookSecret === 'string' && whatsappWebhookSecret.trim().length > 0) {
      updateData.whatsappWebhookSecret = whatsappWebhookSecret.trim();
    }
    if (whatsappTemplates) {
      const mergedTemplates = { ...DEFAULT_WHATSAPP_TEMPLATES };
      for (const key of Object.keys(mergedTemplates) as Array<keyof typeof DEFAULT_WHATSAPP_TEMPLATES>) {
        const val = whatsappTemplates[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          mergedTemplates[key] = val.trim();
        }
      }
      updateData.whatsappTemplatesJson = JSON.stringify(mergedTemplates);
    }

    const settings = await prisma.clinicSetting.update({
      where: { id: 'singleton' },
      data: updateData,
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'CLINIC_SETTINGS_UPDATED',
      resourceType: 'ClinicSetting',
      resourceId: 'singleton',
      summary: 'Updated clinic contact, schedule, UPI, or automation settings',
      ipAddress: req.ip,
    });

    res.json({ settings: sanitizeSettings(settings) });
  }
);

router.post(
  '/holidays',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = holidaySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid YYYY-MM-DD date and reason required.' });
      return;
    }
    const holiday = await prisma.clinicHoliday.upsert({
      where: { date: parsed.data.date },
      update: { reason: parsed.data.reason.trim() },
      create: { date: parsed.data.date, reason: parsed.data.reason.trim(), isFullDay: true },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'HOLIDAY_ADDED',
      resourceType: 'ClinicHoliday',
      resourceId: holiday.id,
      summary: `Marked clinic holiday ${holiday.date}: ${holiday.reason}`,
      ipAddress: req.ip,
    });

    res.status(201).json({ holiday });
  }
);

router.delete(
  '/holidays/:id',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req, res) => {
    await prisma.clinicHoliday.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }
);

router.get('/users', requireAuth, requireRole('SUPER_ADMIN'), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  res.json({ users });
});

router.post('/users', requireAuth, requireRole('SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid email, name, role, and password (min 8 chars) required.' });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'User with this email already exists.' });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: parsed.data.fullName.trim(),
      phone: parsed.data.phone?.trim() || null,
      role: parsed.data.role,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  await logAudit({
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: 'STAFF_USER_CREATED',
    resourceType: 'User',
    resourceId: user.id,
    summary: `Created ${user.role} account for ${user.email}`,
    ipAddress: req.ip,
  });

  res.status(201).json({ user });
});

router.patch(
  '/users/:id/toggle-active',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { isActive: !existing.isActive },
      select: { id: true, email: true, isActive: true, role: true },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'USER_STATUS_TOGGLED',
      resourceType: 'User',
      resourceId: updated.id,
      summary: `Set ${updated.email} active=${updated.isActive}`,
      ipAddress: req.ip,
    });

    res.json({ user: updated });
  }
);

const roleUpdateSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'RECEPTION']),
});

router.patch(
  '/users/:id/role',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const parsed = roleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid staff role is required.' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (existing.id === req.auth!.userId && parsed.data.role !== 'SUPER_ADMIN') {
      res.status(422).json({ error: 'You cannot downgrade your own active Super Admin role.' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { role: parsed.data.role },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });

    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'USER_ROLE_CHANGED',
      resourceType: 'User',
      resourceId: updated.id,
      summary: `Changed role for ${updated.email} from ${existing.role} to ${updated.role}`,
      ipAddress: req.ip,
    });

    res.json({ user: updated });
  }
);

router.get(
  '/overview',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (_req, res) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const now = new Date();

    const [appointments, pendingPayments, inquiries, dueTasks, pendingReports, failedWebhooks] =
      await Promise.all([
        prisma.appointment.findMany({
          orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
          include: {
            service: { select: { name: true } },
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { status: true, utrReference: true, amountSubmittedInr: true },
            },
          },
        }),
        prisma.payment.findMany({
          where: { status: { in: ['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION'] } },
          orderBy: { createdAt: 'desc' },
          include: {
            patient: { select: { patientCode: true, fullName: true, phone: true } },
            appointment: {
              select: { bookingReference: true, appointmentDate: true, startTime: true },
            },
          },
        }),
        prisma.crmLead.findMany({
          orderBy: { createdAt: 'desc' },
          take: 40,
          include: {
            assignedTo: { select: { fullName: true } },
          },
        }),
        prisma.crmTask.findMany({
          where: { isCompleted: false },
          orderBy: { dueAt: 'asc' },
          take: 25,
          include: {
            lead: { select: { leadCode: true, fullName: true, phone: true } },
          },
        }),
        prisma.diagnosticReport.findMany({
          where: { status: { in: ['DRAFT', 'UNDER_REVIEW', 'REVISED'] } },
          select: { id: true, reportCode: true, status: true, title: true },
        }),
        prisma.webhookEvent.count({ where: { status: 'FAILED' } }),
      ]);

    const todayAppointmentsList = appointments.filter(
      (a) => a.appointmentDate === todayStr && a.status !== 'CANCELLED'
    );
    const upcomingAppointmentsList = appointments.filter(
      (a) => a.appointmentDate > todayStr && a.status !== 'CANCELLED'
    );
    const confirmedAppointments = appointments.filter((a) => a.status === 'CONFIRMED').length;
    const completedAppointments = appointments.filter((a) => a.status === 'COMPLETED').length;
    const cancellations = appointments.filter((a) => a.status === 'CANCELLED').length;
    const newInquiriesList = inquiries.filter((l) =>
      ['NEW', 'FOLLOW_UP', 'APPOINTMENT_REQUESTED'].includes(l.status)
    );

    const operationalAlerts: Array<{
      id: string;
      severity: 'high' | 'medium' | 'info';
      title: string;
      detail: string;
      linkTo: string;
    }> = [];

    const awaitingUtrVerify = pendingPayments.filter((p) =>
      ['SUBMITTED', 'UNDER_VERIFICATION'].includes(p.status)
    );
    if (awaitingUtrVerify.length > 0) {
      operationalAlerts.push({
        id: 'utr-verification',
        severity: 'high',
        title: `${awaitingUtrVerify.length} UPI payment submission(s) awaiting manual verification`,
        detail: 'Verify UTR references against bank records before confirming slots.',
        linkTo: '/staff/payments',
      });
    }

    const newLeadCount = inquiries.filter((l) => l.status === 'NEW').length;
    if (newLeadCount > 0) {
      operationalAlerts.push({
        id: 'new-inquiries',
        severity: 'medium',
        title: `${newLeadCount} new inquiry lead(s) require reception contact`,
        detail: 'Assign and contact website/walk-in inquiries from the CRM pipeline.',
        linkTo: '/staff/crm',
      });
    }

    const overdueTasks = dueTasks.filter((t) => t.dueAt && t.dueAt < now);
    if (overdueTasks.length > 0) {
      operationalAlerts.push({
        id: 'overdue-followups',
        severity: 'medium',
        title: `${overdueTasks.length} CRM follow-up task(s) past due`,
        detail: 'Review pending callbacks and appointment follow-ups.',
        linkTo: '/staff/crm',
      });
    }

    if (failedWebhooks > 0) {
      operationalAlerts.push({
        id: 'failed-webhooks',
        severity: 'medium',
        title: `${failedWebhooks} automation webhook delivery(s) failed`,
        detail: 'Inspect and retry n8n webhook deliveries under Automation Logs.',
        linkTo: '/staff/admin',
      });
    }

    res.json({
      todayDate: todayStr,
      counts: {
        todayAppointments: todayAppointmentsList.length,
        upcomingAppointments: upcomingAppointmentsList.length,
        newInquiries: newInquiriesList.length,
        pendingPaymentVerifications: pendingPayments.length,
        confirmedAppointments,
        completedAppointments,
        cancellations,
        dueFollowUps: dueTasks.length,
        unpublishedReports: pendingReports.length,
      },
      todayAppointmentsList: todayAppointmentsList.slice(0, 15),
      upcomingAppointmentsList: upcomingAppointmentsList.slice(0, 15),
      newInquiriesList: newInquiriesList.slice(0, 12),
      pendingPaymentsList: pendingPayments.slice(0, 12),
      dueTasks: dueTasks.slice(0, 10),
      operationalAlerts,
    });
  }
);

router.get(
  '/audit-logs',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req, res) => {
    const actionFilter = req.query.action ? String(req.query.action).trim() : '';
    const resourceTypeFilter = req.query.resourceType
      ? String(req.query.resourceType).trim()
      : '';
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(actionFilter ? { action: { contains: actionFilter } } : {}),
        ...(resourceTypeFilter ? { resourceType: resourceTypeFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: {
        actor: { select: { fullName: true, email: true } },
      },
    });
    res.json({ logs });
  }
);

router.get(
  '/automation-logs',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (_req, res) => {
    const webhooks = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    const whatsappLogs = await prisma.whatsAppMessageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    res.json({ webhooks, whatsappLogs });
  }
);

router.post(
  '/webhooks/:id/retry',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req, res) => {
    try {
      const result = await retryWebhookEvent(req.params.id);
      res.json(result);
    } catch (err: unknown) {
      res.status(404).json({
        error: err instanceof Error ? err.message : 'Unable to retry webhook.',
      });
    }
  }
);

router.post(
  '/webhooks/retry-failed',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const result = await retryFailedWebhooks(25);
    await logAudit({
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: 'WEBHOOKS_BATCH_RETRIED',
      resourceType: 'WebhookEvent',
      summary: `Batch retried ${result.retried} failed webhooks (succeeded: ${result.succeeded}, failed: ${result.failed})`,
      ipAddress: req.ip,
    });
    res.json(result);
  }
);

router.post(
  '/integrations/test-n8n',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const result = await testN8nConnection(req.auth!.userId);
    res.json(result);
  }
);

router.post(
  '/integrations/test-whatsapp',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const result = await testWhatsAppConnection(req.auth!.userId);
    res.json(result);
  }
);

router.post(
  '/integrations/trigger-reminders',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const targetDate =
      typeof req.body?.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.targetDate)
        ? req.body.targetDate
        : undefined;
    const result = await triggerUpcomingAppointmentReminders({
      targetDate,
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
    });
    res.json(result);
  }
);

router.post(
  '/integrations/trigger-daily-summary',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (req: AuthenticatedRequest, res) => {
    const date =
      typeof req.body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)
        ? req.body.date
        : undefined;
    const result = await dispatchDailyReceptionSummary({
      date,
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
    });
    res.json(result);
  }
);

// Analytics & Reporting aggregates for Super Admin / Reception
router.get(
  '/analytics',
  requireAuth,
  requireRole('SUPER_ADMIN', 'RECEPTION'),
  async (_req, res) => {
    const [appointments, payments, leads, reports] = await Promise.all([
      prisma.appointment.findMany({
        include: { service: { include: { category: true } } },
      }),
      prisma.payment.findMany(),
      prisma.crmLead.findMany(),
      prisma.diagnosticReport.findMany({ select: { status: true } }),
    ]);

    const statusCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const dailyTrendMap: Record<string, { date: string; appointments: number; verifiedInr: number }> =
      {};

    for (const appt of appointments) {
      statusCounts[appt.status] = (statusCounts[appt.status] || 0) + 1;
      const catName = appt.service?.category?.name || 'Uncategorized';
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
      if (!dailyTrendMap[appt.appointmentDate]) {
        dailyTrendMap[appt.appointmentDate] = {
          date: appt.appointmentDate,
          appointments: 0,
          verifiedInr: 0,
        };
      }
      dailyTrendMap[appt.appointmentDate].appointments += 1;
    }

    let verifiedTotalInr = 0;
    let pendingTotalInr = 0;
    for (const p of payments) {
      if (p.status === 'VERIFIED') {
        verifiedTotalInr += p.amountSubmittedInr;
        if (!dailyTrendMap[p.paymentDate]) {
          dailyTrendMap[p.paymentDate] = {
            date: p.paymentDate,
            appointments: 0,
            verifiedInr: 0,
          };
        }
        dailyTrendMap[p.paymentDate].verifiedInr += p.amountSubmittedInr;
      } else if (['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION'].includes(p.status)) {
        pendingTotalInr += p.amountSubmittedInr;
      }
    }

    const dailyTrend = Object.values(dailyTrendMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    const byCategory = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count,
    }));

    const byStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));

    res.json({
      totals: {
        totalAppointments: appointments.length,
        verifiedTotalInr,
        pendingTotalInr,
        totalLeads: leads.length,
        convertedLeads: leads.filter((l) => l.status === 'CONVERTED').length,
        publishedReports: reports.filter((r) => r.status === 'PUBLISHED').length,
      },
      dailyTrend,
      byCategory,
      byStatus,
    });
  }
);

export default router;
