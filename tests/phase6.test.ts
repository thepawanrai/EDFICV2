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
import { EVIDENCE_DIR, REPORTS_DIR, resolvePrivateFile, savePrivateFile } from '../src/server/lib/storage';
import { scanMedicalContentCompliance } from '../src/server/services/compliance';
import { validateOutboundUrl } from '../src/server/services/automation';
import { expireStaleReservations } from '../src/server/services/scheduling';

const PHASE6_PHONES = ['9666110001', '9666110002', '9666110003'];
const PHASE6_DATE = '2099-10-18';

interface AuthBundle {
  userId: string;
  cookie: string;
  csrf: string;
}

let server: http.Server;
let baseUrl = '';
let superAdminAuth: AuthBundle;
let receptionAuth: AuthBundle;
let generalServiceId = '';

const createdTestEmails: string[] = [];
const createdReportFiles: string[] = [];
const createdEvidenceFiles: string[] = [];
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
  reqPath: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: AuthBundle;
    headers?: Record<string, string>;
    omitCsrf?: boolean;
  } = {}
): Promise<{ status: number; data: T; headers: Headers }> {
  const csrf = options.omitCsrf ? '' : options.auth?.csrf || generateCsrfToken();
  const cookie = options.auth?.cookie || `${CSRF_COOKIE_NAME}=${csrf}`;
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: cookie,
    ...(options.omitCsrf ? {} : { 'X-CSRF-Token': csrf }),
    ...(options.headers || {}),
  };
  const res = await fetch(`${baseUrl}${reqPath}`, {
    method: options.method || 'GET',
    headers: reqHeaders,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data = {} as T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = { raw: text } as unknown as T;
  }
  return { status: res.status, data, headers: res.headers };
}

async function cleanupPhase6Data() {
  const testUsers = await prisma.user.findMany({
    where: { email: { in: createdTestEmails } },
    select: { id: true },
  });
  const userIds = testUsers.map((u) => u.id);

  const testPatients = await prisma.patient.findMany({
    where: {
      OR: [
        { phone: { in: PHASE6_PHONES } },
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
        { patientPhone: { in: PHASE6_PHONES } },
        { appointmentDate: PHASE6_DATE },
      ],
    },
    select: { id: true },
  });
  const apptIds = testAppts.map((a) => a.id);

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
  if (apptIds.length > 0) {
    await prisma.payment.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.whatsAppMessageLog.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
  }
  await prisma.whatsAppMessageLog.deleteMany({
    where: { recipientPhone: { in: PHASE6_PHONES } },
  });
  await prisma.crmLead.deleteMany({
    where: { phone: { in: PHASE6_PHONES } },
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
    if (resolved && fs.existsSync(resolved)) fs.unlinkSync(resolved);
  }
  for (const rel of createdEvidenceFiles) {
    const resolved = resolvePrivateFile(EVIDENCE_DIR, rel);
    if (resolved && fs.existsSync(resolved)) fs.unlinkSync(resolved);
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

  await cleanupPhase6Data();

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
});

afterAll(async () => {
  await cleanupPhase6Data();
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('Phase 6: Security Audit, Healthcare Compliance & Website QA', () => {
  it('blocks SSRF metadata/private URLs, path traversal, CSRF bypass, and invalid file uploads', async () => {
    // 1. SSRF validation on outbound URLs and Admin settings save
    expect(validateOutboundUrl('http://169.254.169.254/latest/meta-data/').valid).toBe(false);
    expect(validateOutboundUrl('http://metadata.google.internal/computeMetadata/v1/').valid).toBe(false);
    expect(validateOutboundUrl('file:///etc/passwd').valid).toBe(false);
    expect(validateOutboundUrl('https://user:pass@example.com/hook').valid).toBe(false);

    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(validateOutboundUrl('http://hooks.example.com/n8n').valid).toBe(false);
    expect(validateOutboundUrl('https://127.0.0.1:5678/webhook').valid).toBe(false);
    expect(validateOutboundUrl('https://192.168.1.50/webhook').valid).toBe(false);
    expect(validateOutboundUrl('https://n8n.edfic.in/webhook').valid).toBe(true);
    process.env.NODE_ENV = prevEnv;

    const ssrfSave = await apiJson('/api/v1/admin/settings', {
      method: 'PUT',
      auth: superAdminAuth,
      body: { n8nWebhookUrl: 'http://169.254.169.254/latest/meta-data/' },
    });
    expect(ssrfSave.status).toBe(400);

    // 2. Path traversal checks in private storage resolver
    expect(resolvePrivateFile(REPORTS_DIR, '../../package.json')).toBeNull();
    expect(resolvePrivateFile(REPORTS_DIR, '../evidence/secret.png')).toBeNull();
    expect(resolvePrivateFile(REPORTS_DIR, '')).toBeNull();

    // 3. CSRF enforcement on mutating API calls
    const csrfBlocked = await apiJson('/api/v1/public/inquiries', {
      method: 'POST',
      omitCsrf: true,
      body: {
        fullName: 'No CSRF Tester',
        phone: PHASE6_PHONES[0],
        message: 'Attempting state change without CSRF token',
      },
    });
    expect(csrfBlocked.status).toBe(403);

    // 4. Reject forged PDF upload with executable magic bytes
    const form = new FormData();
    form.append('appointmentId', 'nonexistent');
    form.append('title', 'Forged File');
    form.append(
      'reportPdf',
      new Blob([Buffer.from('MZ\x90\x00not-a-pdf')], { type: 'application/pdf' }),
      'forged.pdf'
    );
    const uploadRes = await fetch(`${baseUrl}/api/v1/reports/upload`, {
      method: 'POST',
      headers: {
        Cookie: superAdminAuth.cookie,
        'X-CSRF-Token': superAdminAuth.csrf,
      },
      body: form,
    });
    expect(uploadRes.status).toBe(400);

    // 5. Embedded iframe behind nginx reverse proxy (Host rewritten, X-Forwarded-Proto=http, Origin=https://*.run.app)
    const proxyHost = 'ais-dev-preview.asia-northeast1.run.app';
    const csrfFetch = await fetch(`${baseUrl}/api/v1/auth/csrf`, {
      headers: {
        'X-Forwarded-Host': proxyHost,
        'X-Forwarded-Proto': 'http',
        Referer: `https://${proxyHost}/login`,
      },
    });
    expect(csrfFetch.status).toBe(200);
    const setCookieHeader = csrfFetch.headers.get('set-cookie') || '';
    expect(setCookieHeader).toContain('SameSite=None');
    expect(setCookieHeader).toContain('Secure');
    const csrfJson = (await csrfFetch.json()) as { csrfToken: string };

    // Even if browser drops third-party cookies inside iframe, same-origin Origin + signed X-CSRF-Token succeeds
    const iframeLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-Host': proxyHost,
        'X-Forwarded-Proto': 'http',
        Origin: `https://${proxyHost}`,
        'X-CSRF-Token': csrfJson.csrfToken,
      },
      body: JSON.stringify({
        email: 'admin@edfic.local',
        password: process.env.DEV_SEED_PASSWORD || 'Edfic@2026!',
      }),
    });
    expect(iframeLogin.status).toBe(200);
    const iframeLoginJson = (await iframeLogin.json()) as {
      user: { role: string };
      sessionToken?: string;
    };
    expect(iframeLoginJson.user.role).toBe('SUPER_ADMIN');
    expect(iframeLoginJson.sessionToken).toBeTruthy();

    // Bearer fallback authorizes /api/v1/auth/me even without cookies
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${iframeLoginJson.sessionToken}` },
    });
    expect(meRes.status).toBe(200);
  });

  it('prevents guest patient email-only hijacking and sets no-store/nosniff headers on private files', async () => {
    const guestEmail = `guest.victim.${Date.now()}@edfic-test.local`;
    const attackerEmail = guestEmail;
    createdTestEmails.push(attackerEmail);

    // Create an unlinked guest patient booking under phone A + guestEmail
    const guestPatient = await prisma.patient.create({
      data: {
        patientCode: `EDF-PT-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        userId: null,
        fullName: 'Guest Victim Patient',
        phone: PHASE6_PHONES[0],
        email: guestEmail,
        consentAccepted: true,
        consentTimestamp: new Date(),
      },
    });

    // Attacker registers with guestEmail but a DIFFERENT phone number
    const hijackAttempt = await apiJson<{
      user: { patientId: string; patientCode: string };
    }>('/api/v1/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Different Phone User',
        email: attackerEmail,
        phone: PHASE6_PHONES[1],
        password: 'StrongPassword#2026',
      },
    });
    expect(hijackAttempt.status).toBe(201);
    // Must create a brand-new separate Patient record rather than claiming guestPatient
    expect(hijackAttempt.data.user.patientId).not.toBe(guestPatient.id);
    expect(hijackAttempt.data.user.patientCode).not.toBe(guestPatient.patientCode);

    // Verify private report download & payment evidence download enforce Cache-Control: no-store, private & nosniff
    const pdfFile = savePrivateFile(
      REPORTS_DIR,
      '.pdf',
      Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')
    );
    createdReportFiles.push(pdfFile);

    const pngFile = savePrivateFile(
      EVIDENCE_DIR,
      '.png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    createdEvidenceFiles.push(pngFile);

    const appt = await prisma.appointment.create({
      data: {
        bookingReference: `EDF-PH6-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        patientId: guestPatient.id,
        serviceId: generalServiceId,
        appointmentDate: PHASE6_DATE,
        startTime: '11:00',
        endTime: '11:30',
        status: 'CONFIRMED',
        patientName: guestPatient.fullName,
        patientPhone: guestPatient.phone,
        patientEmail: guestEmail,
      },
    });

    const visit = await prisma.visit.create({
      data: {
        visitNumber: `VIS-PH6-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        appointmentId: appt.id,
        patientId: guestPatient.id,
        doctorId: superAdminAuth.userId,
        status: 'COMPLETED',
      },
    });

    const report = await prisma.diagnosticReport.create({
      data: {
        reportCode: `RPT-PH6-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        patientId: guestPatient.id,
        visitId: visit.id,
        uploadedById: superAdminAuth.userId,
        reviewedById: superAdminAuth.userId,
        title: 'Phase 6 Private Download Test',
        revisionNumber: 1,
        fileName: 'phase6-report.pdf',
        storedFilePath: pdfFile,
        fileSizeBytes: 64,
        mimeType: 'application/pdf',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    const payment = await prisma.payment.create({
      data: {
        appointmentId: appt.id,
        patientId: guestPatient.id,
        paymentMethod: 'UPI',
        expectedAdvanceInr: 500,
        amountSubmittedInr: 500,
        utrReference: 'UTRPHASE6TEST01',
        paymentDate: '2026-11-20',
        evidenceFilePath: pngFile,
        evidenceMimeType: 'image/png',
        status: 'SUBMITTED',
      },
    });

    // Attacker (same email, different userId) must be denied (403) downloading guestPatient's report
    const attackerUser = await prisma.user.findUniqueOrThrow({ where: { email: attackerEmail } });
    const attackerBundle = makeAuthBundle(attackerUser);
    const hijackedDownload = await fetch(`${baseUrl}/api/v1/reports/${report.id}/download`, {
      headers: { Cookie: attackerBundle.cookie },
    });
    expect(hijackedDownload.status).toBe(403);

    // Super Admin download succeeds with strict security headers
    const adminDownload = await fetch(`${baseUrl}/api/v1/reports/${report.id}/download`, {
      headers: { Cookie: superAdminAuth.cookie },
    });
    expect(adminDownload.status).toBe(200);
    expect(adminDownload.headers.get('cache-control')).toContain('no-store');
    expect(adminDownload.headers.get('x-content-type-options')).toBe('nosniff');

    // Reception download of payment evidence succeeds with strict security headers
    const evidenceRes = await fetch(`${baseUrl}/api/v1/payments/${payment.id}/evidence`, {
      headers: { Cookie: receptionAuth.cookie },
    });
    expect(evidenceRes.status).toBe(200);
    expect(evidenceRes.headers.get('cache-control')).toContain('no-store');
    expect(evidenceRes.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('automatically expires stale unpaid reservations and enforces NMC/PCPNDT compliance & public zero-pricing QA', async () => {
    // 1. Stale unpaid reservation expiry releases slot cleanly
    const staleAppt = await prisma.appointment.create({
      data: {
        bookingReference: `EDF-EXP-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        patientId: (
          await prisma.patient.findFirstOrThrow({ where: { phone: PHASE6_PHONES[0] } })
        ).id,
        serviceId: generalServiceId,
        appointmentDate: PHASE6_DATE,
        startTime: '14:00',
        endTime: '14:30',
        status: 'PENDING_ADVANCE',
        patientName: 'Expired Slot Tester',
        patientPhone: PHASE6_PHONES[2],
        reservationExpiresAt: new Date(Date.now() - 60_000),
      },
    });

    const expiryRes = await expireStaleReservations();
    expect(expiryRes.expiredAppointments).toBeGreaterThanOrEqual(1);
    const afterExpiry = await prisma.appointment.findUniqueOrThrow({ where: { id: staleAppt.id } });
    expect(afterExpiry.status).toBe('CANCELLED');

    // 2. Public SEO & clinical endpoints QA
    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    expect(robotsRes.status).toBe(200);
    const robotsText = await robotsRes.text();
    expect(robotsText).toContain('Disallow: /staff');
    expect(robotsText).toContain('Disallow: /portal');

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    expect(sitemapRes.status).toBe(200);
    const sitemapXml = await sitemapRes.text();
    expect(sitemapXml).toContain('<urlset');
    expect(sitemapXml).toContain('/fetal-imaging');
    expect(sitemapXml).toContain('/services/');

    const publicServicesRes = await apiJson<{
      categories: Array<{ services: Array<Record<string, unknown>> }>;
    }>('/api/v1/public/services');
    expect(publicServicesRes.status).toBe(200);
    const serialized = JSON.stringify(publicServicesRes.data);
    expect(serialized).not.toMatch(/advanceAmountInr|internalBaseFeeInr|₹/);

    // 3. Compliance scanner blocks PCPNDT & NMC violations
    expect(scanMedicalContentCompliance('Gender prediction and sex determination available').passed).toBe(false);
    expect(scanMedicalContentCompliance('100% accurate result at Rs. 999 with 5-star rating').passed).toBe(false);
    expect(
      scanMedicalContentCompliance(
        'Fetal echocardiography is performed for detailed cardiac anatomical assessment during pregnancy.'
      ).passed
    ).toBe(true);

    // 4. Unknown API route returns clean JSON 404 without stack trace
    const unknownApi = await apiJson<{ error: string }>('/api/v1/nonexistent-route-qa');
    expect(unknownApi.status).toBe(404);
    expect(unknownApi.data.error).toBe('API endpoint not found.');
  });
});
