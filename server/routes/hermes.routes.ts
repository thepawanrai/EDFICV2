import { Router } from 'express';
import { prisma } from '../lib/prisma.ts';
import { logAudit } from '../lib/security.ts';
import { requireHermesKey } from '../middleware/auth.ts';

const router = Router();

// Restricted Hermes Agent integration:
// - Read-only aggregated operational summaries and approved public service directory
// - Zero PII, zero clinical findings, zero medical recommendations, zero report access, zero database mutations
router.use(requireHermesKey);

router.use(async (req, res, next) => {
  if (req.method !== 'GET') {
    await logAudit({
      actorRole: 'HERMES_AGENT',
      action: 'HERMES_PERMISSION_DENIED',
      resourceType: 'HermesPolicy',
      summary: `Blocked non-GET mutation attempt ${req.method} ${req.originalUrl} (requires human approval)`,
      ipAddress: req.ip,
    });
    res.status(403).json({
      error:
        'Hermes Agent is restricted to read-only operational summaries. Consequential actions require authorized human staff approval.',
    });
    return;
  }
  next();
});

router.get('/summary/appointments', async (req, res) => {
  const date = req.query.date
    ? String(req.query.date)
    : new Date().toISOString().slice(0, 10);

  const [groupedByStatus, groupedByChannel] = await Promise.all([
    prisma.appointment.groupBy({
      by: ['status'],
      where: { appointmentDate: date },
      _count: { _all: true },
    }),
    prisma.appointment.groupBy({
      by: ['bookingChannel'],
      where: { appointmentDate: date },
      _count: { _all: true },
    }),
  ]);

  await logAudit({
    actorRole: 'HERMES_AGENT',
    action: 'HERMES_APPOINTMENT_SUMMARY',
    resourceType: 'Appointment',
    summary: `Hermes queried aggregated appointment counts for ${date}`,
    ipAddress: req.ip,
  });

  res.json({
    date,
    summaryByStatus: groupedByStatus.map((g) => ({
      status: g.status,
      count: g._count._all,
    })),
    summaryByChannel: groupedByChannel.map((g) => ({
      channel: g.bookingChannel,
      count: g._count._all,
    })),
  });
});

router.get('/summary/inquiries', async (req, res) => {
  const [byStatus, bySource, openFollowUps] = await Promise.all([
    prisma.crmLead.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.crmLead.groupBy({
      by: ['source'],
      _count: { _all: true },
    }),
    prisma.crmTask.count({ where: { isCompleted: false } }),
  ]);

  await logAudit({
    actorRole: 'HERMES_AGENT',
    action: 'HERMES_INQUIRY_SUMMARY',
    resourceType: 'CrmLead',
    summary: 'Hermes queried aggregated pending inquiry counts',
    ipAddress: req.ip,
  });

  res.json({
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    bySource: bySource.map((s) => ({ source: s.source, count: s._count._all })),
    openFollowUpTasks: openFollowUps,
  });
});

router.get('/summary/tasks', async (req, res) => {
  const [pendingPayments, openCrmTasks, newLeads, waitingVisits, unpublishedReports] =
    await Promise.all([
      prisma.payment.count({
        where: { status: { in: ['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION'] } },
      }),
      prisma.crmTask.count({ where: { isCompleted: false } }),
      prisma.crmLead.count({
        where: { status: { in: ['NEW', 'FOLLOW_UP', 'APPOINTMENT_REQUESTED'] } },
      }),
      prisma.visit.count({ where: { status: 'WAITING' } }),
      prisma.diagnosticReport.count({
        where: { status: { in: ['DRAFT', 'UNDER_REVIEW', 'REVISED'] } },
      }),
    ]);

  await logAudit({
    actorRole: 'HERMES_AGENT',
    action: 'HERMES_TASKS_SUMMARY',
    resourceType: 'OperationalTasks',
    summary: 'Hermes queried pending operational task counts',
    ipAddress: req.ip,
  });

  res.json({
    pendingPaymentVerifications: pendingPayments,
    openCrmFollowUpTasks: openCrmTasks,
    activeInquiries: newLeads,
    patientsWaitingInClinic: waitingVisits,
    reportsPendingDoctorReview: unpublishedReports,
  });
});

router.get('/services', async (req, res) => {
  const services = await prisma.diagnosticService.findMany({
    where: { isVisiblePublic: true, approvalStatus: 'PUBLISHED' },
    orderBy: { name: 'asc' },
    select: {
      code: true,
      slug: true,
      name: true,
      summary: true,
      preparationNotes: true,
      durationMinutes: true,
      requiresDoctorMorning: true,
      category: { select: { name: true } },
    },
  });

  await logAudit({
    actorRole: 'HERMES_AGENT',
    action: 'HERMES_SERVICES_READ',
    resourceType: 'DiagnosticService',
    summary: `Hermes retrieved approved non-priced service directory (${services.length} services)`,
    ipAddress: req.ip,
  });

  res.json({ services });
});

router.get('/summary/reception', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const [todaysTotal, confirmedToday, pendingVerification, openInquiries] = await Promise.all([
    prisma.appointment.count({ where: { appointmentDate: today, status: { not: 'CANCELLED' } } }),
    prisma.appointment.count({
      where: { appointmentDate: today, status: 'CONFIRMED' },
    }),
    prisma.payment.count({
      where: { status: { in: ['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION'] } },
    }),
    prisma.crmLead.count({ where: { status: { in: ['NEW', 'FOLLOW_UP'] } } }),
  ]);

  await logAudit({
    actorRole: 'HERMES_AGENT',
    action: 'HERMES_RECEPTION_SUMMARY',
    resourceType: 'Appointment',
    summary: `Hermes queried daily reception summary for ${today}`,
    ipAddress: req.ip,
  });

  res.json({
    date: today,
    todaysAppointmentsTotal: todaysTotal,
    confirmedToday,
    pendingPaymentVerifications: pendingVerification,
    openInquiries,
  });
});

router.get('/summary/operations', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const [
    appointmentsTotal,
    appointmentsToday,
    appointmentsCompleted,
    appointmentsCancelled,
    inquiriesTotal,
    leadsConverted,
    publishedReportsCount,
  ] = await Promise.all([
    prisma.appointment.count(),
    prisma.appointment.count({ where: { appointmentDate: today, status: { not: 'CANCELLED' } } }),
    prisma.appointment.count({ where: { status: 'COMPLETED' } }),
    prisma.appointment.count({ where: { status: 'CANCELLED' } }),
    prisma.crmLead.count(),
    prisma.crmLead.count({ where: { status: 'CONVERTED' } }),
    prisma.diagnosticReport.count({ where: { status: 'PUBLISHED' } }),
  ]);

  await logAudit({
    actorRole: 'HERMES_AGENT',
    action: 'HERMES_OPERATIONS_REPORT',
    resourceType: 'OperationalReport',
    summary: 'Hermes queried aggregated non-PHI operational report',
    ipAddress: req.ip,
  });

  res.json({
    date: today,
    aggregates: {
      appointmentsTotal,
      appointmentsToday,
      appointmentsCompleted,
      appointmentsCancelled,
      inquiriesTotal,
      leadsConverted,
      publishedReportsCount,
    },
    privacyGuarantee: 'AGGREGATE_NON_PHI_ONLY',
  });
});

// Explicit 403 boundary for any forbidden/unapproved Hermes endpoint (diagnosis, patients, reports, payments)
router.use(async (req, res) => {
  await logAudit({
    actorRole: 'HERMES_AGENT',
    action: 'HERMES_PERMISSION_DENIED',
    resourceType: 'HermesPolicy',
    summary: `Blocked restricted Hermes route access: ${req.originalUrl}`,
    ipAddress: req.ip,
  });

  res.status(403).json({
    error:
      'Access denied: Hermes Agent is strictly prohibited from accessing patient records, diagnostic reports, medical interpretation, or financial actions.',
  });
});

export default router;
