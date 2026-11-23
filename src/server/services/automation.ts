import crypto from 'crypto';
import net from 'net';
import { prisma } from '../lib/prisma.ts';
import { logAudit } from '../lib/security.ts';

export function validateOutboundUrl(rawUrl: string): { valid: boolean; reason?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { valid: true };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Invalid URL format.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Embedded credentials in integration URLs are not allowed.' };
  }

  const isProd = process.env.NODE_ENV === 'production';
  const allowedProtocols = isProd ? ['https:'] : ['https:', 'http:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      valid: false,
      reason: isProd
        ? 'Production integration URLs must use HTTPS.'
        : 'Only HTTP(S) URLs are permitted.',
    };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'metadata.google.internal' ||
    host === 'metadata.goog' ||
    host === '0.0.0.0' ||
    host.startsWith('169.254.') ||
    host.startsWith('fe80:')
  ) {
    return { valid: false, reason: 'Metadata and link-local addresses are blocked.' };
  }

  if (isProd) {
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === '::1'
    ) {
      return { valid: false, reason: 'Local/internal integration hosts are blocked in production.' };
    }
    if (net.isIPv4(host)) {
      const octets = host.split('.').map(Number);
      if (
        octets[0] === 127 ||
        octets[0] === 10 ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
        (octets[0] === 192 && octets[1] === 168)
      ) {
        return { valid: false, reason: 'Private IP ranges are blocked in production.' };
      }
    }
  }

  return { valid: true };
}

export type AutomationEventType =
  | 'appointment.created'
  | 'appointment.confirmed'
  | 'appointment.rescheduled'
  | 'appointment.cancelled'
  | 'appointment.reservation_expired'
  | 'appointment.reminder'
  | 'payment.submitted'
  | 'payment.under_verification'
  | 'payment.verified'
  | 'payment.rejected'
  | 'payment.refunded'
  | 'crm.inquiry_created'
  | 'crm.lead_assigned'
  | 'patient.registered'
  | 'report.published'
  | 'reception.daily_summary'
  | 'notification.email_queued'
  | 'integration.test_ping';

export type WhatsAppTemplateKey =
  | 'INQUIRY_ACKNOWLEDGMENT'
  | 'APPOINTMENT_ACKNOWLEDGMENT'
  | 'BOOKING_REFERENCE'
  | 'PAYMENT_INSTRUCTIONS'
  | 'PAYMENT_ACKNOWLEDGED'
  | 'PAYMENT_REJECTED'
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_REMINDER'
  | 'APPOINTMENT_RESCHEDULED'
  | 'APPOINTMENT_CANCELLED'
  | 'REPORT_PORTAL_NOTICE';

export const DEFAULT_WHATSAPP_TEMPLATES: Record<WhatsAppTemplateKey, string> = {
  INQUIRY_ACKNOWLEDGMENT: 'edfic_inquiry_ack',
  APPOINTMENT_ACKNOWLEDGMENT: 'edfic_appointment_ack',
  BOOKING_REFERENCE: 'edfic_booking_reference',
  PAYMENT_INSTRUCTIONS: 'edfic_upi_instructions',
  PAYMENT_ACKNOWLEDGED: 'edfic_payment_verified',
  PAYMENT_REJECTED: 'edfic_payment_rejected',
  APPOINTMENT_CONFIRMED: 'edfic_appointment_confirmed',
  APPOINTMENT_REMINDER: 'edfic_appointment_reminder',
  APPOINTMENT_RESCHEDULED: 'edfic_appointment_rescheduled',
  APPOINTMENT_CANCELLED: 'edfic_appointment_cancelled',
  REPORT_PORTAL_NOTICE: 'edfic_report_portal_notice',
};

export function resolveWhatsAppTemplates(
  rawJson?: string | null
): Record<WhatsAppTemplateKey, string> {
  const base = { ...DEFAULT_WHATSAPP_TEMPLATES };
  if (!rawJson) return base;
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    for (const key of Object.keys(base) as WhatsAppTemplateKey[]) {
      const val = parsed[key];
      if (typeof val === 'string' && val.trim().length > 0) {
        base[key] = val.trim();
      }
    }
  } catch {
    // Fallback cleanly to defaults if malformed JSON stored
  }
  return base;
}

export async function dispatchN8nEvent(params: {
  eventId: string;
  eventType: AutomationEventType;
  payload: Record<string, unknown>;
}): Promise<{ status: string; eventId: string; duplicate?: boolean }> {
  // Idempotency: prevent duplicate event execution for the same eventId
  const existing = await prisma.webhookEvent.findUnique({
    where: { eventId: params.eventId },
  });
  if (existing) {
    return { status: existing.status, eventId: existing.eventId, duplicate: true };
  }

  const settings = await prisma.clinicSetting.findUnique({
    where: { id: 'singleton' },
  });

  const webhookUrl = settings?.n8nWebhookUrl || process.env.N8N_WEBHOOK_URL || '';
  const webhookSecret = settings?.n8nWebhookSecret || process.env.N8N_WEBHOOK_SECRET || '';
  const n8nApiKey = settings?.n8nApiKey || process.env.N8N_API_KEY || '';

  const payloadString = JSON.stringify({
    eventId: params.eventId,
    eventType: params.eventType,
    timestamp: new Date().toISOString(),
    source: 'edfic-platform',
    data: params.payload,
  });

  const record = await prisma.webhookEvent.create({
    data: {
      eventId: params.eventId,
      eventType: params.eventType,
      targetSystem: 'N8N',
      payloadJson: payloadString,
      status: webhookUrl ? 'PENDING' : 'SKIPPED_UNCONFIGURED',
      attempts: 0,
    },
  });

  if (!webhookUrl) {
    return { status: 'SKIPPED_UNCONFIGURED', eventId: record.eventId };
  }

  return attemptN8nDelivery(record.id, webhookUrl, webhookSecret, n8nApiKey, payloadString);
}

export async function retryWebhookEvent(webhookRecordId: string): Promise<{
  status: string;
  eventId?: string;
  lastError?: string | null;
}> {
  const record = await prisma.webhookEvent.findUnique({
    where: { id: webhookRecordId },
  });
  if (!record) {
    throw new Error('Webhook event not found.');
  }
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: 'singleton' },
  });
  const webhookUrl = settings?.n8nWebhookUrl || process.env.N8N_WEBHOOK_URL || '';
  const webhookSecret = settings?.n8nWebhookSecret || process.env.N8N_WEBHOOK_SECRET || '';
  const n8nApiKey = settings?.n8nApiKey || process.env.N8N_API_KEY || '';

  if (!webhookUrl) {
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: 'SKIPPED_UNCONFIGURED', lastAttemptAt: new Date() },
    });
    return { status: 'SKIPPED_UNCONFIGURED', eventId: record.eventId };
  }
  return attemptN8nDelivery(record.id, webhookUrl, webhookSecret, n8nApiKey, record.payloadJson);
}

export async function retryFailedWebhooks(limit = 25): Promise<{
  retried: number;
  succeeded: number;
  failed: number;
}> {
  const failedEvents = await prisma.webhookEvent.findMany({
    where: { status: 'FAILED', attempts: { lt: 5 } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let succeeded = 0;
  let failed = 0;
  for (const evt of failedEvents) {
    const res = await retryWebhookEvent(evt.id);
    if (res.status === 'SENT') succeeded += 1;
    else if (res.status === 'FAILED') failed += 1;
  }

  return { retried: failedEvents.length, succeeded, failed };
}

async function attemptN8nDelivery(
  id: string,
  webhookUrl: string,
  webhookSecret: string,
  n8nApiKey: string,
  payloadString: string
): Promise<{ status: string; eventId: string; lastError?: string | null }> {
  const signature = webhookSecret
    ? crypto.createHmac('sha256', webhookSecret).update(payloadString).digest('hex')
    : '';

  const parsedMeta = JSON.parse(payloadString) as { eventId?: string; eventType?: string };
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-EDFIC-Event-Id': parsedMeta.eventId || '',
    'X-EDFIC-Event-Type': parsedMeta.eventType || '',
  };
  if (signature) {
    headers['X-EDFIC-Signature'] = signature;
  }
  if (n8nApiKey) {
    headers['X-N8N-API-KEY'] = n8nApiKey;
  }

  const urlCheck = validateOutboundUrl(webhookUrl);
  if (!urlCheck.valid) {
    const updated = await prisma.webhookEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        lastError: `Blocked URL: ${urlCheck.reason}`,
        lastAttemptAt: new Date(),
      },
    });
    return { status: updated.status, eventId: updated.eventId, lastError: updated.lastError };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const rawBody = await res.text().catch(() => '');
    let executionId: string | null = res.headers.get('x-n8n-execution-id');
    if (!executionId && rawBody) {
      try {
        const json = JSON.parse(rawBody) as { executionId?: string };
        if (typeof json.executionId === 'string') executionId = json.executionId;
      } catch {
        // non-JSON webhook response
      }
    }

    const status = res.ok ? 'SENT' : 'FAILED';
    const updated = await prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        attempts: { increment: 1 },
        executionId,
        responseStatus: res.status,
        responseBody: rawBody.slice(0, 500) || null,
        lastError: res.ok ? null : `HTTP ${res.status}`,
        lastAttemptAt: new Date(),
      },
    });

    await prisma.clinicSetting
      .update({
        where: { id: 'singleton' },
        data: {
          n8nConnectionStatus: res.ok ? 'CONNECTED' : 'ERROR',
          n8nLastCheckedAt: new Date(),
        },
      })
      .catch(() => {});

    return { status: updated.status, eventId: updated.eventId, lastError: updated.lastError };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    const updated = await prisma.webhookEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        lastError: message,
        lastAttemptAt: new Date(),
      },
    });

    await prisma.clinicSetting
      .update({
        where: { id: 'singleton' },
        data: {
          n8nConnectionStatus: 'ERROR',
          n8nLastCheckedAt: new Date(),
        },
      })
      .catch(() => {});

    return { status: updated.status, eventId: updated.eventId, lastError: message };
  }
}

// Enforce strict policy: never transmit diagnostic findings or report attachments via WhatsApp
const BLOCKED_PHI_PATTERNS = [
  /\.pdf\b/i,
  /\bfindings\b/i,
  /\bimpression\b/i,
  /\bdiagnosis\b/i,
  /\bfetal\s*anomaly\b/i,
];

export async function dispatchWhatsAppMessage(params: {
  eventId?: string;
  recipientPhone: string;
  templateKey: WhatsAppTemplateKey;
  messageBody: string;
  appointmentId?: string;
  templateVariables?: string[];
}): Promise<{ status: string; logId: string; duplicate?: boolean }> {
  if (BLOCKED_PHI_PATTERNS.some((p) => p.test(params.messageBody))) {
    throw new Error(
      'Compliance block: Diagnostic reports or clinical findings cannot be sent over WhatsApp.'
    );
  }

  if (params.eventId) {
    const existingLog = await prisma.whatsAppMessageLog.findUnique({
      where: { eventId: params.eventId },
    });
    if (existingLog) {
      return { status: existingLog.status, logId: existingLog.id, duplicate: true };
    }
  }

  const settings = await prisma.clinicSetting.findUnique({
    where: { id: 'singleton' },
  });

  const provider = settings?.whatsappProvider || process.env.WHATSAPP_PROVIDER || 'meta_cloud';
  const apiUrl = settings?.whatsappApiUrl || process.env.WHATSAPP_API_URL || '';
  const phoneId = settings?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const accessToken =
    settings?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
  const templates = resolveWhatsAppTemplates(settings?.whatsappTemplatesJson);
  const templateName = templates[params.templateKey] || params.templateKey;

  if (!apiUrl || !accessToken) {
    const log = await prisma.whatsAppMessageLog.create({
      data: {
        eventId: params.eventId ?? null,
        recipientPhone: params.recipientPhone,
        templateKey: params.templateKey,
        templateName,
        messageBody: params.messageBody,
        appointmentId: params.appointmentId ?? null,
        status: 'SKIPPED_UNCONFIGURED',
        provider,
        errorMessage: 'WhatsApp provider endpoint or access token not configured.',
      },
    });
    return { status: log.status, logId: log.id };
  }

  const urlCheck = validateOutboundUrl(apiUrl);
  if (!urlCheck.valid) {
    const log = await prisma.whatsAppMessageLog.create({
      data: {
        eventId: params.eventId ?? null,
        recipientPhone: params.recipientPhone,
        templateKey: params.templateKey,
        templateName,
        messageBody: params.messageBody,
        appointmentId: params.appointmentId ?? null,
        status: 'FAILED',
        provider,
        errorMessage: `Blocked URL: ${urlCheck.reason}`,
      },
    });
    return { status: log.status, logId: log.id };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const requestBody =
      provider === 'meta_cloud'
        ? {
            messaging_product: 'whatsapp',
            phone_number_id: phoneId,
            to: params.recipientPhone,
            type: 'text',
            template_name: templateName,
            text: { body: params.messageBody },
          }
        : {
            provider,
            phoneNumberId: phoneId,
            to: params.recipientPhone,
            templateName,
            variables: params.templateVariables ?? [],
            message: params.messageBody,
          };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      messageId?: string;
      id?: string;
    };

    const externalId = data?.messages?.[0]?.id ?? data?.messageId ?? data?.id ?? null;

    const log = await prisma.whatsAppMessageLog.create({
      data: {
        eventId: params.eventId ?? null,
        recipientPhone: params.recipientPhone,
        templateKey: params.templateKey,
        templateName,
        messageBody: params.messageBody,
        appointmentId: params.appointmentId ?? null,
        status: response.ok ? 'SENT' : 'FAILED',
        provider,
        externalMessageId: externalId,
        errorMessage: response.ok ? null : `HTTP ${response.status}`,
      },
    });

    await prisma.clinicSetting
      .update({
        where: { id: 'singleton' },
        data: {
          whatsappConnectionStatus: response.ok
            ? 'CONNECTED'
            : response.status === 401 || response.status === 403
              ? 'AUTH_ERROR'
              : 'ERROR',
          whatsappLastCheckedAt: new Date(),
        },
      })
      .catch(() => {});

    return { status: log.status, logId: log.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    const log = await prisma.whatsAppMessageLog.create({
      data: {
        eventId: params.eventId ?? null,
        recipientPhone: params.recipientPhone,
        templateKey: params.templateKey,
        templateName,
        messageBody: params.messageBody,
        appointmentId: params.appointmentId ?? null,
        status: 'FAILED',
        provider,
        errorMessage: message,
      },
    });

    await prisma.clinicSetting
      .update({
        where: { id: 'singleton' },
        data: {
          whatsappConnectionStatus: 'ERROR',
          whatsappLastCheckedAt: new Date(),
        },
      })
      .catch(() => {});

    return { status: log.status, logId: log.id };
  }
}

export async function dispatchEmailNotification(params: {
  eventId: string;
  recipientEmail?: string | null;
  subject: string;
  templateKey: WhatsAppTemplateKey;
  bodyText: string;
  bookingReference?: string;
}): Promise<{ status: string }> {
  if (!params.recipientEmail || !params.recipientEmail.includes('@')) {
    return { status: 'SKIPPED_NO_EMAIL' };
  }
  if (BLOCKED_PHI_PATTERNS.some((p) => p.test(params.bodyText) || p.test(params.subject))) {
    throw new Error(
      'Compliance block: Diagnostic reports or clinical findings cannot be emailed outside the authenticated portal.'
    );
  }
  const result = await dispatchN8nEvent({
    eventId: `email-${params.eventId}`,
    eventType: 'notification.email_queued',
    payload: {
      channel: 'EMAIL',
      recipientEmail: params.recipientEmail,
      templateKey: params.templateKey,
      subject: params.subject,
      bodyText: params.bodyText,
      bookingReference: params.bookingReference || null,
    },
  });
  return { status: result.status };
}

export async function triggerUpcomingAppointmentReminders(params?: {
  targetDate?: string;
  actorUserId?: string | null;
  actorRole?: string | null;
}): Promise<{
  targetDate: string;
  matchedAppointments: number;
  dispatchedWebhooks: number;
  dispatchedWhatsApp: number;
}> {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const targetDate = params?.targetDate || tomorrow;

  const appointments = await prisma.appointment.findMany({
    where: {
      appointmentDate: targetDate,
      status: { in: ['CONFIRMED', 'PENDING_ADVANCE', 'ADVANCE_SUBMITTED'] },
    },
    include: {
      service: { select: { name: true } },
    },
  });

  let dispatchedWebhooks = 0;
  let dispatchedWhatsApp = 0;

  for (const appt of appointments) {
    const n8nRes = await dispatchN8nEvent({
      eventId: `appt-reminder-${appt.id}-${targetDate}`,
      eventType: 'appointment.reminder',
      payload: {
        bookingReference: appt.bookingReference,
        serviceName: appt.service.name,
        appointmentDate: appt.appointmentDate,
        startTime: appt.startTime,
        status: appt.status,
        patientPhone: appt.patientPhone,
      },
    });
    if (!n8nRes.duplicate) dispatchedWebhooks += 1;

    const waRes = await dispatchWhatsAppMessage({
      eventId: `wa-reminder-${appt.id}-${targetDate}`,
      recipientPhone: appt.patientPhone,
      templateKey: 'APPOINTMENT_REMINDER',
      appointmentId: appt.id,
      messageBody: `EDFIC Reminder: Your upcoming visit (${appt.bookingReference}) for ${appt.service.name} is scheduled on ${appt.appointmentDate} at ${appt.startTime}. Location: Unit 10, Millennium Place, Sushant Golf City (Near Lulu Mall), Lucknow.`,
    });
    if (!waRes.duplicate) dispatchedWhatsApp += 1;
  }

  await logAudit({
    actorUserId: params?.actorUserId ?? null,
    actorRole: params?.actorRole ?? 'SYSTEM',
    action: 'APPOINTMENT_REMINDERS_TRIGGERED',
    resourceType: 'Appointment',
    summary: `Triggered upcoming reminders for ${targetDate} (${appointments.length} appointments)`,
  });

  return {
    targetDate,
    matchedAppointments: appointments.length,
    dispatchedWebhooks,
    dispatchedWhatsApp,
  };
}

export async function dispatchDailyReceptionSummary(params?: {
  date?: string;
  actorUserId?: string | null;
  actorRole?: string | null;
}): Promise<{
  date: string;
  eventId: string;
  status: string;
  summary: {
    todaysAppointmentsTotal: number;
    confirmedAppointments: number;
    pendingAdvanceAppointments: number;
    pendingPaymentVerifications: number;
    newInquiries: number;
    openFollowUpTasks: number;
  };
}> {
  const date = params?.date || new Date().toISOString().slice(0, 10);

  const [
    todaysAppointmentsTotal,
    confirmedAppointments,
    pendingAdvanceAppointments,
    pendingPaymentVerifications,
    newInquiries,
    openFollowUpTasks,
  ] = await Promise.all([
    prisma.appointment.count({
      where: { appointmentDate: date, status: { not: 'CANCELLED' } },
    }),
    prisma.appointment.count({
      where: { appointmentDate: date, status: 'CONFIRMED' },
    }),
    prisma.appointment.count({
      where: {
        appointmentDate: date,
        status: { in: ['PENDING_ADVANCE', 'ADVANCE_SUBMITTED'] },
      },
    }),
    prisma.payment.count({
      where: { status: { in: ['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION'] } },
    }),
    prisma.crmLead.count({
      where: { status: { in: ['NEW', 'FOLLOW_UP', 'APPOINTMENT_REQUESTED'] } },
    }),
    prisma.crmTask.count({
      where: { isCompleted: false },
    }),
  ]);

  const summary = {
    todaysAppointmentsTotal,
    confirmedAppointments,
    pendingAdvanceAppointments,
    pendingPaymentVerifications,
    newInquiries,
    openFollowUpTasks,
  };

  // Non-PHI aggregated summary payload for n8n
  const eventId = `reception-daily-summary-${date}-${Date.now()}`;
  const res = await dispatchN8nEvent({
    eventId,
    eventType: 'reception.daily_summary',
    payload: {
      date,
      ...summary,
    },
  });

  await logAudit({
    actorUserId: params?.actorUserId ?? null,
    actorRole: params?.actorRole ?? 'SYSTEM',
    action: 'RECEPTION_DAILY_SUMMARY_DISPATCHED',
    resourceType: 'WebhookEvent',
    summary: `Dispatched non-PHI daily reception summary for ${date}`,
  });

  return {
    date,
    eventId: res.eventId,
    status: res.status,
    summary,
  };
}

export async function testN8nConnection(actorUserId: string): Promise<{
  status: string;
  eventId: string;
  lastError?: string | null;
}> {
  const res = await dispatchN8nEvent({
    eventId: `n8n-ping-${Date.now()}`,
    eventType: 'integration.test_ping',
    payload: {
      message: 'EDFIC connectivity verification ping',
    },
  });

  await logAudit({
    actorUserId,
    actorRole: 'SUPER_ADMIN',
    action: 'N8N_CONNECTION_TESTED',
    resourceType: 'ClinicSetting',
    resourceId: 'singleton',
    summary: `Tested n8n webhook connectivity (${res.status})`,
  });

  return res;
}

export async function testWhatsAppConnection(actorUserId: string): Promise<{
  connectionStatus: string;
  provider: string;
  detail: string;
}> {
  const settings = await prisma.clinicSetting.findUnique({
    where: { id: 'singleton' },
  });
  const provider = settings?.whatsappProvider || process.env.WHATSAPP_PROVIDER || 'meta_cloud';
  const apiUrl = settings?.whatsappApiUrl || process.env.WHATSAPP_API_URL || '';
  const accessToken =
    settings?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';

  let connectionStatus = 'NOT_CONFIGURED';
  let detail = 'Configure both WhatsApp API Endpoint URL and Access Token to verify connectivity.';

  if (apiUrl && accessToken) {
    const urlCheck = validateOutboundUrl(apiUrl);
    if (!urlCheck.valid) {
      connectionStatus = 'ERROR';
      detail = `Blocked URL: ${urlCheck.reason}`;
    } else {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(apiUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.status === 401 || res.status === 403) {
          connectionStatus = 'AUTH_ERROR';
          detail = `Provider rejected credential (HTTP ${res.status}).`;
        } else if (res.ok || res.status === 405 || res.status === 400) {
          // Endpoints accepting POST-only often respond 405/400 on GET ping while confirming reachability & auth
          connectionStatus = 'CONNECTED';
          detail = `Endpoint reachable under ${provider} (HTTP ${res.status}).`;
        } else {
          connectionStatus = 'ERROR';
          detail = `Endpoint returned HTTP ${res.status}.`;
        }
      } catch (err: unknown) {
        connectionStatus = 'ERROR';
        detail = err instanceof Error ? err.message : 'Unable to reach WhatsApp provider URL.';
      }
    }
  }

  await prisma.clinicSetting.update({
    where: { id: 'singleton' },
    data: {
      whatsappConnectionStatus: connectionStatus,
      whatsappLastCheckedAt: new Date(),
    },
  });

  await logAudit({
    actorUserId,
    actorRole: 'SUPER_ADMIN',
    action: 'WHATSAPP_CONNECTION_TESTED',
    resourceType: 'ClinicSetting',
    resourceId: 'singleton',
    summary: `Tested WhatsApp (${provider}) connectivity: ${connectionStatus}`,
  });

  return { connectionStatus, provider, detail };
}
