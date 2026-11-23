import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEdficApp } from '../server';
import { prisma } from '../src/server/lib/prisma';
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  signSessionToken,
} from '../src/server/lib/security';
import { REPORTS_DIR, resolvePrivateFile } from '../src/server/lib/storage';
import { dispatchN8nEvent, dispatchWhatsAppMessage } from '../src/server/services/automation';

const PHASE5_PHONES = ['9777110001', '9777110002', '9777110003'];
const PHASE5_TEST_DATE = '2099-09-12';
const PHASE5_RESCHEDULE_DATE = '2099-09-15';
const N8N_TEST_SECRET = 'phase5-n8n-hmac-secret-9988';
const N8N_TEST_API_KEY = 'phase5-n8n-api-key-7766';
const WA_TEST_TOKEN = 'phase5-wa-bearer-token-5544';
const WA_WEBHOOK_SECRET = 'phase5-wa-webhook-secret-3322';

interface AuthBundle {
  userId: string;
  cookie: string;
  csrf: string;
}

interface CapturedN8nCall {
  headers: http.IncomingHttpHeaders;
  rawBody: string;
  body: {
    eventId: string;
    eventType: string;
    timestamp: string;
    source: string;
    data: Record<string, unknown>;
  };
}

interface CapturedWaCall {
  headers: http.IncomingHttpHeaders;
  body: Record<string, unknown>;
  externalId: string;
}

let server: http.Server;
let baseUrl = '';
let mockServer: http.Server;
let mockBaseUrl = '';
let n8nShouldFail = false;
let n8nExecCounter = 1;
let waMsgCounter = 1;
const capturedN8nCalls: CapturedN8nCall[] = [];
const capturedWaCalls: CapturedWaCall[] = [];

let superAdminAuth: AuthBundle;
let receptionAuth: AuthBundle;
let generalServiceId = '';

let originalSettings: Awaited<ReturnType<typeof prisma.clinicSetting.findUnique>> = null;
const createdTestEmails: string[] = [];
const createdReportFiles: string[] = [];
let suiteStartTime: Date;

function makeAuthBundle(user: {
  id: string;
  email: string;
  role: string;
  fullName: string;
}): AuthBundle {
  const jwt = signSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  });
  const csrf = generateCsrfToken();
  return {
    userId: user.id,
    cookie: `${AUTH_COOKIE_NAME}=${jwt}; ${CSRF_COOKIE_NAME}=${csrf}`,
    csrf,
  };
}

async function apiJson<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: AuthBundle;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; data: T }> {
  const csrf = options.auth?.csrf || generateCsrfToken();
  const cookie = options.auth?.cookie || `${CSRF_COOKIE_NAME}=${csrf}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'X-CSRF-Token': csrf,
      ...(options.headers || {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data = {} as T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = { raw: text } as unknown as T;
  }
  return { status: res.status, data };
}

async function cleanupPhase5TestData() {
  const testUsers = await prisma.user.findMany({
    where: { email: { in: createdTestEmails } },
    select: { id: true },
  });
  const userIds = testUsers.map((u) => u.id);

  const testPatients = await prisma.patient.findMany({
    where: {
      OR: [
        { phone: { in: PHASE5_PHONES } },
        { email: { in: createdTestEmails } },
        ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const patientIds = testPatients.map((p) => p.id);

  const testAppts = await prisma.appointment.findMany({
    where: {
      OR: [
        ...(patientIds.length > 0 ? [{ patientId: { in: patientIds } }] : []),
        { patientPhone: { in: PHASE5_PHONES } },
        { appointmentDate: { in: [PHASE5_TEST_DATE, PHASE5_RESCHEDULE_DATE] } },
      ],
    },
    select: { id: true },
  });
  const apptIds = testAppts.map((a) => a.id);

  const testLeads = await prisma.crmLead.findMany({
    where: { phone: { in: PHASE5_PHONES } },
    select: { id: true },
  });
  const leadIds = testLeads.map((l) => l.id);

  const testVisits = await prisma.visit.findMany({
    where: {
      OR: [
        ...(apptIds.length > 0 ? [{ appointmentId: { in: apptIds } }] : []),
        ...(patientIds.length > 0 ? [{ patientId: { in: patientIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const visitIds = testVisits.map((v) => v.id);

  const testReports = await prisma.diagnosticReport.findMany({
    where: {
      OR: [
        ...(visitIds.length > 0 ? [{ visitId: { in: visitIds } }] : []),
        ...(patientIds.length > 0 ? [{ patientId: { in: patientIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const reportIds = testReports.map((r) => r.id);

  if (reportIds.length > 0) {
    await prisma.reportDownloadLog.deleteMany({ where: { reportId: { in: reportIds } } });
    await prisma.diagnosticReport.deleteMany({ where: { id: { in: reportIds } } });
  }
  if (visitIds.length > 0) {
    await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
  }
  if (leadIds.length > 0) {
    await prisma.crmTask.deleteMany({ where: { leadId: { in: leadIds } } });
    await prisma.crmLead.deleteMany({ where: { id: { in: leadIds } } });
  }
  if (apptIds.length > 0) {
    await prisma.payment.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.whatsAppMessageLog.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
  }
  await prisma.whatsAppMessageLog.deleteMany({
    where: { recipientPhone: { in: PHASE5_PHONES } },
  });
  await prisma.webhookEvent.deleteMany({
    where: { createdAt: { gte: suiteStartTime } },
  });
  await prisma.auditLog.deleteMany({
    where: { createdAt: { gte: suiteStartTime } },
  });
  if (patientIds.length > 0) {
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  }
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  for (const rel of createdReportFiles) {
    const resolved = resolvePrivateFile(REPORTS_DIR, rel);
    if (resolved && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
  }
}

beforeAll(async () => {
  suiteStartTime = new Date(Date.now() - 1000);

  const app = await createEdficApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr !== 'string') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  await cleanupPhase5TestData();
  originalSettings = await prisma.clinicSetting.findUnique({ where: { id: 'singleton' } });

  const [superAdmin, reception, service] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: 'SUPER_ADMIN', isActive: true } }),
    prisma.user.findFirstOrThrow({ where: { role: 'RECEPTION', isActive: true } }),
    prisma.diagnosticService.findFirstOrThrow({
      where: { isVisiblePublic: true, approvalStatus: 'PUBLISHED', requiresDoctorMorning: false },
    }),
  ]);

  superAdminAuth = makeAuthBundle(superAdmin);
  receptionAuth = makeAuthBundle(reception);
  generalServiceId = service.id;

  // Start mock receiver for n8n + WhatsApp API calls
  mockServer = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      if (req.url === '/n8n-webhook' && req.method === 'POST') {
        const parsed = JSON.parse(rawBody || '{}') as CapturedN8nCall['body'];
        capturedN8nCalls.push({ headers: req.headers, rawBody, body: parsed });
        if (n8nShouldFail) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Simulated n8n downstream outage' }));
          return;
        }
        const executionId = `n8n-exec-${n8nExecCounter++}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, executionId }));
        return;
      }

      if (req.url === '/whatsapp-send') {
        if (req.method === 'GET') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'POST expected for messages' }));
          return;
        }
        const parsed = JSON.parse(rawBody || '{}') as Record<string, unknown>;
        const externalId = `wamid.test.${waMsgCounter++}`;
        capturedWaCalls.push({ headers: req.headers, body: parsed, externalId });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ messages: [{ id: externalId }] }));
        return;
      }

      res.writeHead(404);
      res.end();
    });
  });

  await new Promise<void>((resolve) => {
    mockServer.listen(0, '127.0.0.1', () => {
      const addr = mockServer.address();
      if (addr && typeof addr !== 'string') {
        mockBaseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await cleanupPhase5TestData();
  if (originalSettings) {
    const { id: _id, updatedAt: _u, ...rest } = originalSettings;
    await prisma.clinicSetting
      .update({
        where: { id: 'singleton' },
        data: rest,
      })
      .catch(() => {});
  }
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (mockServer) {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  }
});

describe('Phase 5: n8n, WhatsApp Business API & Restricted Hermes Integration', () => {
  it('configures credentials securely, masks secrets in GET responses, and verifies connectivity', async () => {
    const updateRes = await apiJson<{
      settings: Record<string, unknown>;
    }>('/api/v1/admin/settings', {
      method: 'PUT',
      auth: superAdminAuth,
      body: {
        n8nWebhookUrl: `${mockBaseUrl}/n8n-webhook`,
        n8nWebhookSecret: N8N_TEST_SECRET,
        n8nApiKey: N8N_TEST_API_KEY,
        whatsappProvider: 'meta_cloud',
        whatsappApiUrl: `${mockBaseUrl}/whatsapp-send`,
        whatsappPhoneNumberId: '109988776655',
        whatsappAccessToken: WA_TEST_TOKEN,
        whatsappWebhookSecret: WA_WEBHOOK_SECRET,
        whatsappTemplates: {
          PAYMENT_INSTRUCTIONS: 'edfic_custom_upi_v2',
          REPORT_PORTAL_NOTICE: 'edfic_portal_ready_v2',
        },
      },
    });
    expect(updateRes.status).toBe(200);
    // Secrets must NEVER be leaked in plaintext back to frontend
    expect(updateRes.data.settings.n8nWebhookSecret).toBeUndefined();
    expect(updateRes.data.settings.n8nApiKey).toBeUndefined();
    expect(updateRes.data.settings.whatsappAccessToken).toBeUndefined();
    expect(updateRes.data.settings.whatsappWebhookSecret).toBeUndefined();
    expect(updateRes.data.settings.hasN8nWebhookSecret).toBe(true);
    expect(updateRes.data.settings.hasWhatsappAccessToken).toBe(true);
    expect(updateRes.data.settings.n8nWebhookSecretHint).toBe(`••••${N8N_TEST_SECRET.slice(-4)}`);

    // Subsequent save without secrets must keep stored secrets intact
    const getRes = await apiJson<{ settings: Record<string, unknown> }>(
      '/api/v1/admin/settings',
      { auth: superAdminAuth }
    );
    expect(getRes.status).toBe(200);
    expect(getRes.data.settings.whatsappAccessToken).toBeUndefined();
    expect(getRes.data.settings.hasWhatsappWebhookSecret).toBe(true);

    // Test n8n connection
    const n8nPing = await apiJson<{ status: string; eventId: string }>(
      '/api/v1/admin/integrations/test-n8n',
      { method: 'POST', auth: superAdminAuth }
    );
    expect(n8nPing.status).toBe(200);
    expect(n8nPing.data.status).toBe('SENT');

    const lastPing = capturedN8nCalls[capturedN8nCalls.length - 1];
    const expectedSig = crypto
      .createHmac('sha256', N8N_TEST_SECRET)
      .update(lastPing.rawBody)
      .digest('hex');
    expect(lastPing.headers['x-edfic-signature']).toBe(expectedSig);
    expect(lastPing.headers['x-n8n-api-key']).toBe(N8N_TEST_API_KEY);

    // Test WhatsApp connection
    const waPing = await apiJson<{ connectionStatus: string; provider: string }>(
      '/api/v1/admin/integrations/test-whatsapp',
      { method: 'POST', auth: superAdminAuth }
    );
    expect(waPing.status).toBe(200);
    expect(waPing.data.connectionStatus).toBe('CONNECTED');
    expect(waPing.data.provider).toBe('meta_cloud');
  });

  it('delivers all lifecycle n8n events & compliant WhatsApp notifications across Inquiry, Patient, Booking, Payment, Report, Reminder, Daily Summary & Cancellation', async () => {
    const patientEmail = `phase5.patient.${Date.now()}@edfic-test.local`;
    createdTestEmails.push(patientEmail);

    // 1. Patient Registration -> patient.registered
    const regRes = await apiJson<{
      user: { id: string; patientId: string; patientCode: string };
    }>('/api/v1/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Phase5 Integration Patient',
        email: patientEmail,
        phone: PHASE5_PHONES[0],
        password: 'PatientUser#2026!',
      },
    });
    expect(regRes.status).toBe(201);
    expect(
      capturedN8nCalls.some((c) => c.body.eventType === 'patient.registered')
    ).toBe(true);

    // 2. Public Inquiry -> crm.inquiry_created + INQUIRY_ACKNOWLEDGMENT WhatsApp
    const inqRes = await apiJson<{ leadCode: string }>('/api/v1/public/inquiries', {
      method: 'POST',
      body: {
        fullName: 'Phase5 Inquiry Caller',
        phone: PHASE5_PHONES[1],
        email: 'inquiry5@edfic-test.local',
        interestedService: 'Growth Scan',
        message: 'Checking morning slot availability for next week.',
      },
    });
    expect(inqRes.status).toBe(201);
    expect(
      capturedN8nCalls.some((c) => c.body.eventType === 'crm.inquiry_created')
    ).toBe(true);
    expect(
      capturedWaCalls.some(
        (w) =>
          w.body.to === PHASE5_PHONES[1] && w.body.template_name === 'edfic_inquiry_ack'
      )
    ).toBe(true);

    // Assign lead -> crm.lead_assigned
    const createdLead = await prisma.crmLead.findFirstOrThrow({
      where: { phone: PHASE5_PHONES[1] },
    });
    const assignRes = await apiJson('/api/v1/crm/' + createdLead.id, {
      method: 'PATCH',
      auth: receptionAuth,
      body: { assignedToId: superAdminAuth.userId, status: 'CONTACTED' },
    });
    expect(assignRes.status).toBe(200);
    expect(
      capturedN8nCalls.some((c) => c.body.eventType === 'crm.lead_assigned')
    ).toBe(true);

    // 3. Online Booking -> appointment.created + APPOINTMENT_ACKNOWLEDGMENT + custom PAYMENT_INSTRUCTIONS
    const bookRes = await apiJson<{
      appointment: { id: string; bookingReference: string };
    }>('/api/v1/appointments/book', {
      method: 'POST',
      body: {
        serviceId: generalServiceId,
        date: PHASE5_TEST_DATE,
        startTime: '10:00',
        patientName: 'Phase5 Integration Patient',
        patientPhone: PHASE5_PHONES[0],
        patientEmail,
        consentAccepted: true,
      },
    });
    expect(bookRes.status).toBe(201);
    const apptId = bookRes.data.appointment.id;
    const bookingRef = bookRes.data.appointment.bookingReference;

    expect(
      capturedN8nCalls.some(
        (c) =>
          c.body.eventType === 'appointment.created' &&
          c.body.data.bookingReference === bookingRef
      )
    ).toBe(true);
    expect(
      capturedWaCalls.some(
        (w) =>
          w.body.to === PHASE5_PHONES[0] &&
          w.body.template_name === 'edfic_appointment_ack'
      )
    ).toBe(true);
    expect(
      capturedWaCalls.some(
        (w) =>
          w.body.to === PHASE5_PHONES[0] &&
          w.body.template_name === 'edfic_custom_upi_v2'
      )
    ).toBe(true);

    // 4. UTR Submission -> payment.submitted
    const utrRes = await apiJson<{ payment: { id: string } }>(
      '/api/v1/payments/submit-utr',
      {
        method: 'POST',
        body: {
          bookingReference: bookingRef,
          phone: PHASE5_PHONES[0],
          utrReference: 'UTRPHASE50001122',
          amountSubmittedInr: 500,
          paymentDate: '2026-11-20',
        },
      }
    );
    expect(utrRes.status).toBe(201);
    expect(
      capturedN8nCalls.some(
        (c) =>
          c.body.eventType === 'payment.submitted' &&
          c.body.data.bookingReference === bookingRef
      )
    ).toBe(true);

    // 5. Payment Verify -> payment.verified + appointment.confirmed + PAYMENT_ACKNOWLEDGED + APPOINTMENT_CONFIRMED
    const verifyRes = await apiJson(`/api/v1/payments/${utrRes.data.payment.id}/verify`, {
      method: 'POST',
      auth: receptionAuth,
      body: { totalServiceFeeInr: 1200 },
    });
    expect(verifyRes.status).toBe(200);
    expect(
      capturedN8nCalls.some(
        (c) =>
          c.body.eventType === 'payment.verified' &&
          c.body.data.bookingReference === bookingRef
      )
    ).toBe(true);
    expect(
      capturedN8nCalls.some(
        (c) =>
          c.body.eventType === 'appointment.confirmed' &&
          c.body.data.bookingReference === bookingRef
      )
    ).toBe(true);
    expect(
      capturedWaCalls.some(
        (w) =>
          w.body.to === PHASE5_PHONES[0] &&
          w.body.template_name === 'edfic_payment_verified'
      )
    ).toBe(true);
    expect(
      capturedWaCalls.some(
        (w) =>
          w.body.to === PHASE5_PHONES[0] &&
          w.body.template_name === 'edfic_appointment_confirmed'
      )
    ).toBe(true);

    // 6. Reschedule -> appointment.rescheduled + APPOINTMENT_RESCHEDULED
    const reschRes = await apiJson(`/api/v1/appointments/${apptId}/reschedule`, {
      method: 'PATCH',
      auth: receptionAuth,
      body: { date: PHASE5_RESCHEDULE_DATE, startTime: '11:00', reason: 'Patient request' },
    });
    expect(reschRes.status).toBe(200);
    expect(
      capturedN8nCalls.some(
        (c) =>
          c.body.eventType === 'appointment.rescheduled' &&
          c.body.data.appointmentDate === PHASE5_RESCHEDULE_DATE
      )
    ).toBe(true);
    expect(
      capturedWaCalls.some(
        (w) => w.body.template_name === 'edfic_appointment_rescheduled'
      )
    ).toBe(true);

    // 7. Signed n8n trigger for upcoming reminders -> appointment.reminder + idempotency
    const reminderPayload = JSON.stringify({ targetDate: PHASE5_RESCHEDULE_DATE });
    const reminderSig = crypto
      .createHmac('sha256', N8N_TEST_SECRET)
      .update(reminderPayload)
      .digest('hex');

    const rem1 = await apiJson<{
      matchedAppointments: number;
      dispatchedWebhooks: number;
      dispatchedWhatsApp: number;
    }>('/api/v1/integrations/n8n/trigger-reminders', {
      method: 'POST',
      body: { targetDate: PHASE5_RESCHEDULE_DATE },
      headers: { 'X-EDFIC-Signature': reminderSig },
    });
    expect(rem1.status).toBe(200);
    expect(rem1.data.matchedAppointments).toBe(1);
    expect(rem1.data.dispatchedWebhooks).toBe(1);
    expect(rem1.data.dispatchedWhatsApp).toBe(1);

    // Re-running reminders for the same date must deduplicate cleanly
    const rem2 = await apiJson<{
      dispatchedWebhooks: number;
      dispatchedWhatsApp: number;
    }>('/api/v1/integrations/n8n/trigger-reminders', {
      method: 'POST',
      body: { targetDate: PHASE5_RESCHEDULE_DATE },
      headers: { 'X-EDFIC-Signature': reminderSig },
    });
    expect(rem2.status).toBe(200);
    expect(rem2.data.dispatchedWebhooks).toBe(0);
    expect(rem2.data.dispatchedWhatsApp).toBe(0);

    // 8. Check-in, upload PDF report & publish -> report.published + portal-link-only WhatsApp
    const checkinRes = await apiJson<{ visit: { id: string } }>(
      `/api/v1/appointments/${apptId}/check-in`,
      { method: 'POST', auth: receptionAuth }
    );
    expect(checkinRes.status).toBe(201);

    const form = new FormData();
    form.append('visitId', checkinRes.data.visit.id);
    form.append('title', 'Phase5 Diagnostic Report');
    form.append(
      'reportPdf',
      new Blob([Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')], {
        type: 'application/pdf',
      }),
      'phase5-test.pdf'
    );
    const uploadHttp = await fetch(`${baseUrl}/api/v1/reports/upload`, {
      method: 'POST',
      headers: {
        Cookie: superAdminAuth.cookie,
        'X-CSRF-Token': superAdminAuth.csrf,
      },
      body: form,
    });
    const uploadJson = (await uploadHttp.json()) as {
      report: { id: string; storedFilePath: string };
    };
    expect(uploadHttp.status).toBe(201);
    createdReportFiles.push(uploadJson.report.storedFilePath);

    const publishRes = await apiJson(`/api/v1/reports/${uploadJson.report.id}/publish`, {
      method: 'POST',
      auth: superAdminAuth,
    });
    expect(publishRes.status).toBe(200);
    expect(
      capturedN8nCalls.some((c) => c.body.eventType === 'report.published')
    ).toBe(true);

    const portalWa = capturedWaCalls.find(
      (w) => w.body.template_name === 'edfic_portal_ready_v2'
    );
    expect(portalWa).toBeDefined();
    const portalText = String((portalWa?.body.text as { body?: string })?.body || '');
    expect(portalText).toContain('/patient/portal');
    expect(portalText).not.toMatch(/\.pdf|findings|impression|diagnosis/i);

    // Enforce PHI filter throws on clinical findings or PDF filenames
    await expect(
      dispatchWhatsAppMessage({
        recipientPhone: PHASE5_PHONES[0],
        templateKey: 'REPORT_PORTAL_NOTICE',
        messageBody: 'Your findings show normal result attached report.pdf',
      })
    ).rejects.toThrow(/Compliance block/i);

    // 9. Signed n8n trigger for Daily Reception Summary -> reception.daily_summary (zero PII)
    const dailyBody = JSON.stringify({ date: PHASE5_RESCHEDULE_DATE });
    const dailySig = crypto
      .createHmac('sha256', N8N_TEST_SECRET)
      .update(dailyBody)
      .digest('hex');
    const dailyRes = await apiJson<{ status: string; eventId: string }>(
      '/api/v1/integrations/n8n/trigger-daily-summary',
      {
        method: 'POST',
        body: { date: PHASE5_RESCHEDULE_DATE },
        headers: { 'X-EDFIC-Signature': dailySig },
      }
    );
    expect(dailyRes.status).toBe(200);
    expect(dailyRes.data.status).toBe('SENT');
    const summaryEvent = capturedN8nCalls.find(
      (c) => c.body.eventId === dailyRes.data.eventId
    );
    expect(summaryEvent?.body.eventType).toBe('reception.daily_summary');
    expect(summaryEvent?.body.data.patientName).toBeUndefined();

    // 10. Cancel a booking -> appointment.cancelled + APPOINTMENT_CANCELLED
    const book2 = await apiJson<{ appointment: { id: string; bookingReference: string } }>(
      '/api/v1/appointments/book',
      {
        method: 'POST',
        body: {
          serviceId: generalServiceId,
          date: PHASE5_TEST_DATE,
          startTime: '15:00',
          patientName: 'Phase5 Cancel Patient',
          patientPhone: PHASE5_PHONES[2],
          consentAccepted: true,
        },
      }
    );
    expect(book2.status).toBe(201);
    const cancelRes = await apiJson(
      `/api/v1/appointments/${book2.data.appointment.id}/cancel`,
      {
        method: 'PATCH',
        auth: receptionAuth,
        body: { reason: 'Rescheduled separately' },
      }
    );
    expect(cancelRes.status).toBe(200);
    expect(
      capturedN8nCalls.some(
        (c) =>
          c.body.eventType === 'appointment.cancelled' &&
          c.body.data.bookingReference === book2.data.appointment.bookingReference
      )
    ).toBe(true);
    expect(
      capturedWaCalls.some(
        (w) => w.body.template_name === 'edfic_appointment_cancelled'
      )
    ).toBe(true);
  });

  it('prevents duplicate eventId delivery, handles failures with batch retry, and verifies WhatsApp/n8n callbacks', async () => {
    // 1. Idempotency check
    const idemId = `idem-test-${Date.now()}`;
    const first = await dispatchN8nEvent({
      eventId: idemId,
      eventType: 'integration.test_ping',
      payload: { seq: 1 },
    });
    const second = await dispatchN8nEvent({
      eventId: idemId,
      eventType: 'integration.test_ping',
      payload: { seq: 2 },
    });
    expect(first.status).toBe('SENT');
    expect(second.duplicate).toBe(true);
    expect(capturedN8nCalls.filter((c) => c.body.eventId === idemId)).toHaveLength(1);

    // 2. Simulate n8n outage -> FAILED -> Batch Retry recovers to SENT
    n8nShouldFail = true;
    const failId = `fail-retry-${Date.now()}`;
    const failedDispatch = await dispatchN8nEvent({
      eventId: failId,
      eventType: 'appointment.reminder',
      payload: { bookingReference: 'EDF-RETRY-001' },
    });
    expect(failedDispatch.status).toBe('FAILED');
    const failedRow = await prisma.webhookEvent.findUniqueOrThrow({
      where: { eventId: failId },
    });
    expect(failedRow.lastError).toBe('HTTP 500');
    expect(failedRow.responseStatus).toBe(500);

    n8nShouldFail = false;
    const batchRes = await apiJson<{ retried: number; succeeded: number; failed: number }>(
      '/api/v1/admin/webhooks/retry-failed',
      { method: 'POST', auth: superAdminAuth }
    );
    expect(batchRes.status).toBe(200);
    expect(batchRes.data.succeeded).toBeGreaterThanOrEqual(1);

    const recoveredRow = await prisma.webhookEvent.findUniqueOrThrow({
      where: { eventId: failId },
    });
    expect(recoveredRow.status).toBe('SENT');
    expect(recoveredRow.attempts).toBe(2);
    expect(recoveredRow.executionId).toBeTruthy();

    // 3. Unsigned n8n callback must be rejected (401); signed callback updates executionId
    const unsignedCb = await apiJson('/api/v1/integrations/n8n/execution-callback', {
      method: 'POST',
      body: { eventId: failId, executionId: 'ext-cb-99', status: 'SENT' },
    });
    expect(unsignedCb.status).toBe(401);

    const cbBody = JSON.stringify({
      eventId: failId,
      executionId: 'n8n-exec-callback-888',
      status: 'SENT',
      detail: 'Workflow completed successfully',
    });
    const cbSig = crypto
      .createHmac('sha256', N8N_TEST_SECRET)
      .update(cbBody)
      .digest('hex');
    const signedCb = await apiJson<{ ok: boolean }>('/api/v1/integrations/n8n/execution-callback', {
      method: 'POST',
      body: JSON.parse(cbBody),
      headers: { 'X-EDFIC-Signature': cbSig },
    });
    expect(signedCb.status).toBe(200);
    const afterCb = await prisma.webhookEvent.findUniqueOrThrow({ where: { eventId: failId } });
    expect(afterCb.executionId).toBe('n8n-exec-callback-888');

    // 4. WhatsApp Webhook Challenge & Delivery Status Callback
    const badChallenge = await fetch(
      `${baseUrl}/api/v1/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345`
    );
    expect(badChallenge.status).toBe(403);

    const goodChallenge = await fetch(
      `${baseUrl}/api/v1/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${WA_WEBHOOK_SECRET}&hub.challenge=CHALLENGE_OK_99`
    );
    expect(goodChallenge.status).toBe(200);
    expect(await goodChallenge.text()).toBe('CHALLENGE_OK_99');

    const latestWaLog = await prisma.whatsAppMessageLog.findFirstOrThrow({
      where: { externalMessageId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    const waPayloadObj = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: latestWaLog.externalMessageId,
                    status: 'delivered',
                    timestamp: '1763610000',
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const waPayloadRaw = JSON.stringify(waPayloadObj);
    const waHubSig =
      'sha256=' +
      crypto.createHmac('sha256', WA_WEBHOOK_SECRET).update(waPayloadRaw).digest('hex');

    const badWaHook = await apiJson('/api/v1/integrations/whatsapp/webhook', {
      method: 'POST',
      body: waPayloadObj,
      headers: { 'X-Hub-Signature-256': 'sha256=invalid' },
    });
    expect(badWaHook.status).toBe(401);

    const goodWaHook = await apiJson<{ ok: boolean; logId: string; status: string }>(
      '/api/v1/integrations/whatsapp/webhook',
      {
        method: 'POST',
        body: waPayloadObj,
        headers: { 'X-Hub-Signature-256': waHubSig },
      }
    );
    expect(goodWaHook.status).toBe(200);
    expect(goodWaHook.data.ok).toBe(true);
    expect(goodWaHook.data.status).toBe('DELIVERED');

    const updatedWaLog = await prisma.whatsAppMessageLog.findUniqueOrThrow({
      where: { id: latestWaLog.id },
    });
    expect(updatedWaLog.status).toBe('DELIVERED');
    expect(updatedWaLog.webhookVerified).toBe(true);
    expect(updatedWaLog.deliveredAt).toBeTruthy();
  });

  it('enforces strict Hermes API read-only summary permissions and blocks mutations, PII, reports & payments', async () => {
    const hermesKey = process.env.HERMES_API_KEY || 'edfic-hermes-restricted-readonly-key';

    // 1. Missing or invalid key rejected (401)
    const noKey = await apiJson('/api/v1/hermes/summary/appointments');
    expect(noKey.status).toBe(401);

    const wrongKey = await apiJson('/api/v1/hermes/summary/appointments', {
      headers: { 'X-Hermes-Api-Key': 'wrong-key-123' },
    });
    expect(wrongKey.status).toBe(401);

    // 2. Allowed read-only summary endpoints succeed with zero PII & zero pricing
    const apptSummary = await apiJson<{
      date: string;
      summaryByStatus: Array<{ status: string; count: number }>;
      summaryByChannel: Array<{ channel: string; count: number }>;
    }>(`/api/v1/hermes/summary/appointments?date=${PHASE5_RESCHEDULE_DATE}`, {
      headers: { 'X-Hermes-Api-Key': hermesKey },
    });
    expect(apptSummary.status).toBe(200);
    expect(Array.isArray(apptSummary.data.summaryByStatus)).toBe(true);
    expect(JSON.stringify(apptSummary.data)).not.toMatch(/Phase5|patientPhone|patientName/i);

    const inqSummary = await apiJson<{
      byStatus: Array<{ status: string; count: number }>;
      bySource: Array<{ source: string; count: number }>;
      openFollowUpTasks: number;
    }>('/api/v1/hermes/summary/inquiries', {
      headers: { 'X-Hermes-Api-Key': hermesKey },
    });
    expect(inqSummary.status).toBe(200);
    expect(Array.isArray(inqSummary.data.byStatus)).toBe(true);
    expect(typeof inqSummary.data.openFollowUpTasks).toBe('number');
    expect(JSON.stringify(inqSummary.data)).not.toMatch(/9777110002|Caller/i);

    const tasksSummary = await apiJson<{ pendingPaymentVerifications: number }>(
      '/api/v1/hermes/summary/tasks',
      { headers: { 'X-Hermes-Api-Key': hermesKey } }
    );
    expect(tasksSummary.status).toBe(200);
    expect(typeof tasksSummary.data.pendingPaymentVerifications).toBe('number');

    const svcSummary = await apiJson<{
      services: Array<Record<string, unknown>>;
    }>('/api/v1/hermes/services', {
      headers: { 'X-Hermes-Api-Key': hermesKey },
    });
    expect(svcSummary.status).toBe(200);
    expect(svcSummary.data.services.length).toBeGreaterThan(0);
    expect(svcSummary.data.services[0].advanceAmountInr).toBeUndefined();
    expect(svcSummary.data.services[0].internalBaseFeeInr).toBeUndefined();

    const opsSummary = await apiJson<{
      privacyGuarantee: string;
      aggregates: { appointmentsTotal: number; inquiriesTotal: number };
    }>('/api/v1/hermes/summary/operations', {
      headers: { 'X-Hermes-Api-Key': hermesKey },
    });
    expect(opsSummary.status).toBe(200);
    expect(opsSummary.data.privacyGuarantee).toBe('AGGREGATE_NON_PHI_ONLY');
    expect(typeof opsSummary.data.aggregates.appointmentsTotal).toBe('number');

    // 3. Reject ALL mutations and forbidden clinical/patient/report/payment routes (403)
    const mutateRes = await apiJson('/api/v1/hermes/summary/appointments', {
      method: 'POST',
      body: { confirm: true },
      headers: { 'X-Hermes-Api-Key': hermesKey },
    });
    expect(mutateRes.status).toBe(403);

    const blockedPaths = [
      '/api/v1/hermes/patients',
      '/api/v1/hermes/reports',
      '/api/v1/hermes/payments/verify',
      '/api/v1/hermes/diagnosis',
    ];
    for (const p of blockedPaths) {
      const blocked = await apiJson(p, {
        headers: { 'X-Hermes-Api-Key': hermesKey },
      });
      expect(blocked.status).toBe(403);
    }

    // Hermes key cannot bypass staff auth on patient/report endpoints
    const bypassPatients = await apiJson('/api/v1/patients', {
      headers: { 'X-Hermes-Api-Key': hermesKey },
    });
    expect(bypassPatients.status).toBe(401);

    const deniedLogs = await prisma.auditLog.count({
      where: {
        action: 'HERMES_PERMISSION_DENIED',
        createdAt: { gte: suiteStartTime },
      },
    });
    expect(deniedLogs).toBeGreaterThanOrEqual(5);
  });
});
