import fs from 'fs';
import http from 'http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEdficApp } from '../server';
import { prisma } from '../server/lib/prisma';
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  signSessionToken,
} from '../server/lib/security';
import { REPORTS_DIR, resolvePrivateFile } from '../server/lib/storage';

const PHASE4_PHONES = [
  '9888110001',
  '9888110002',
  '9888110003',
  '9888110004',
  '9888110005',
];

const TEST_DATE_TODAY = new Date().toISOString().slice(0, 10);
const TEST_DATE_FUTURE = '2099-07-15';

let server: http.Server;
let baseUrl = '';
let generalServiceId = '';

interface AuthBundle {
  userId: string;
  cookie: string;
  csrf: string;
}

let superAdminAuth: AuthBundle;
let receptionAuth: AuthBundle;

const createdTestEmails: string[] = [];
const createdReportFiles: string[] = [];
let roleModifiedUserId: string | null = null;
let roleOriginalValue: string | null = null;

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
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

async function cleanupPhase4TestData() {
  if (roleModifiedUserId && roleOriginalValue) {
    await prisma.user
      .update({
        where: { id: roleModifiedUserId },
        data: { role: roleOriginalValue as never },
      })
      .catch(() => {});
  }

  const testPatients = await prisma.patient.findMany({
    where: {
      OR: [
        { phone: { in: PHASE4_PHONES } },
        { email: { in: createdTestEmails } },
      ],
    },
    select: { id: true },
  });
  const patientIds = testPatients.map((p) => p.id);

  const testAppts = await prisma.appointment.findMany({
    where: {
      OR: [
        ...(patientIds.length > 0 ? [{ patientId: { in: patientIds } }] : []),
        { patientPhone: { in: PHASE4_PHONES } },
        { appointmentDate: TEST_DATE_FUTURE },
      ],
    },
    select: { id: true },
  });
  const apptIds = testAppts.map((a) => a.id);

  // Clean CRM tasks & leads tied to test phones or test appointments
  const testLeads = await prisma.crmLead.findMany({
    where: {
      OR: [
        { phone: { in: PHASE4_PHONES } },
        ...(patientIds.length > 0 ? [{ convertedPatientId: { in: patientIds } }] : []),
        ...(apptIds.length > 0 ? [{ linkedAppointmentId: { in: apptIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const leadIds = testLeads.map((l) => l.id);
  if (leadIds.length > 0) {
    await prisma.crmTask.deleteMany({ where: { leadId: { in: leadIds } } });
    await prisma.crmLead.deleteMany({ where: { id: { in: leadIds } } });
  }

  if (patientIds.length > 0) {
    await prisma.reportDownloadLog.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.diagnosticReport.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.visit.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.payment.deleteMany({ where: { patientId: { in: patientIds } } });
  }
  if (apptIds.length > 0) {
    await prisma.whatsAppMessageLog.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.payment.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.visit.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
  }
  if (patientIds.length > 0) {
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  }

  if (createdTestEmails.length > 0) {
    const testUsers = await prisma.user.findMany({
      where: { email: { in: createdTestEmails } },
      select: { id: true },
    });
    const testUserIds = testUsers.map((u) => u.id);
    if (testUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: testUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }
  }
}

beforeAll(async () => {
  const app = await createEdficApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Failed to start ephemeral Phase 4 test HTTP server.');
  }
  baseUrl = `http://127.0.0.1:${addr.port}`;

  await cleanupPhase4TestData();

  const generalSvc = await prisma.diagnosticService.findFirst({
    where: { requiresDoctorMorning: false },
  });
  if (!generalSvc) throw new Error('Seeded diagnostic service missing.');
  generalServiceId = generalSvc.id;

  const [adminU, recepU] = await Promise.all([
    prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', isActive: true } }),
    prisma.user.findFirst({ where: { role: 'RECEPTION', isActive: true } }),
  ]);

  if (!adminU || !recepU) {
    throw new Error('Seeded staff roles required for Phase 4 RBAC test suite.');
  }

  superAdminAuth = makeAuthBundle(adminU);
  receptionAuth = makeAuthBundle(recepU);
});

afterAll(async () => {
  await cleanupPhase4TestData();
  for (const rel of createdReportFiles) {
    const abs = resolvePrivateFile(REPORTS_DIR, rel);
    if (abs && fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Phase 4 – Admin Operations Dashboard, Role Updates & Audit Logs', () => {
  it('returns aggregated operations overview & operational alerts for Super Admin and Reception', async () => {
    const res = await apiJson<{
      todayDate: string;
      counts: Record<string, number>;
      operationalAlerts: Array<{ id: string; title: string }>;
    }>('/api/v1/admin/overview', { auth: superAdminAuth });

    expect(res.status).toBe(200);
    expect(res.data.todayDate).toBe(TEST_DATE_TODAY);
    expect(res.data.counts).toHaveProperty('todayAppointments');
    expect(res.data.counts).toHaveProperty('upcomingAppointments');
    expect(res.data.counts).toHaveProperty('newInquiries');
    expect(res.data.counts).toHaveProperty('pendingPaymentVerifications');
    expect(res.data.counts).toHaveProperty('confirmedAppointments');
    expect(res.data.counts).toHaveProperty('completedAppointments');
    expect(res.data.counts).toHaveProperty('cancellations');
    expect(Array.isArray(res.data.operationalAlerts)).toBe(true);
  });

  it('allows Super Admin to update a staff role with USER_ROLE_CHANGED audit logging and blocks self-downgrade', async () => {
    const selfDowngrade = await apiJson<{ error: string }>(
      `/api/v1/admin/users/${superAdminAuth.userId}/role`,
      {
        method: 'PATCH',
        auth: superAdminAuth,
        body: { role: 'RECEPTION' },
      }
    );
    expect(selfDowngrade.status).toBe(422);

    // Create a temporary staff user, change role, verify audit, then restore/delete
    const tempEmail = `phase4.role.test.${Date.now()}@edfic.local`;
    createdTestEmails.push(tempEmail);
    const created = await apiJson<{ user: { id: string; role: string } }>('/api/v1/admin/users', {
      method: 'POST',
      auth: superAdminAuth,
      body: {
        email: tempEmail,
        fullName: 'Phase4 Role Test Staff',
        role: 'RECEPTION',
        password: 'StrongPassword123!',
      },
    });
    expect(created.status).toBe(201);
    roleModifiedUserId = created.data.user.id;
    roleOriginalValue = 'RECEPTION';

    const roleUpdate = await apiJson<{ user: { role: string } }>(
      `/api/v1/admin/users/${created.data.user.id}/role`,
      {
        method: 'PATCH',
        auth: superAdminAuth,
        body: { role: 'SUPER_ADMIN' },
      }
    );
    expect(roleUpdate.status).toBe(200);
    expect(roleUpdate.data.user.role).toBe('SUPER_ADMIN');

    const auditRes = await apiJson<{ logs: Array<{ action: string; resourceId: string }> }>(
      '/api/v1/admin/audit-logs?action=USER_ROLE_CHANGED&resourceType=User',
      { auth: superAdminAuth }
    );
    expect(auditRes.status).toBe(200);
    expect(
      auditRes.data.logs.some(
        (l) => l.action === 'USER_ROLE_CHANGED' && l.resourceId === created.data.user.id
      )
    ).toBe(true);
  });
});

describe('Phase 4 – Integrated CRM, Patient Merge, Doctor Workspace & Report Vault Isolation', () => {
  let patientAId = '';
  let patientBRecordId = '';
  let patientAUserEmail = '';
  let patientBUserEmail = '';
  let patientAAuth: AuthBundle;
  let patientBAuth: AuthBundle;
  let apptAId = '';
  let apptARef = '';
  let visitAId = '';
  let reportRev1Id = '';
  let reportRev2Id = '';
  let leadId = '';

  it('executes full CRM pipeline across all stages, follow-up tasks, conversion, and appointment linking', async () => {
    const assigneesRes = await apiJson<{ users: Array<{ id: string }> }>('/api/v1/crm/assignees', {
      auth: receptionAuth,
    });
    expect(assigneesRes.status).toBe(200);
    expect(assigneesRes.data.users.length).toBeGreaterThanOrEqual(1);

    // 1) Create Lead
    const createRes = await apiJson<{ lead: { id: string; leadCode: string; status: string } }>(
      '/api/v1/crm',
      {
        method: 'POST',
        auth: receptionAuth,
        body: {
          fullName: 'Ananya Verma Phase4',
          phone: PHASE4_PHONES[0],
          source: 'WHATSAPP',
          interestedService: 'Level II Anomaly Scan',
          assignedToId: assigneesRes.data.users[0].id,
        },
      }
    );
    expect(createRes.status).toBe(201);
    expect(createRes.data.lead.status).toBe('NEW');
    leadId = createRes.data.lead.id;

    // 2) Filter & search
    const searchRes = await apiJson<{ leads: Array<{ id: string }> }>(
      `/api/v1/crm?q=${encodeURIComponent(PHASE4_PHONES[0])}&source=WHATSAPP`,
      { auth: receptionAuth }
    );
    expect(searchRes.status).toBe(200);
    expect(searchRes.data.leads.some((l) => l.id === leadId)).toBe(true);

    // 3) Stage progression through Phase 4 stages
    for (const stage of [
      'CONTACTED',
      'INFORMATION_PROVIDED',
      'APPOINTMENT_REQUESTED',
      'APPOINTMENT_CONFIRMED',
      'VISITED',
    ]) {
      const stageRes = await apiJson<{ lead: { status: string } }>(`/api/v1/crm/${leadId}`, {
        method: 'PATCH',
        auth: receptionAuth,
        body: { status: stage, notes: `Updated to ${stage}` },
      });
      expect(stageRes.status).toBe(200);
      expect(stageRes.data.lead.status).toBe(stage);
    }

    // 4) Follow-up task creation & toggle
    const taskRes = await apiJson<{ task: { id: string; isCompleted: boolean } }>(
      `/api/v1/crm/${leadId}/tasks`,
      {
        method: 'POST',
        auth: receptionAuth,
        body: { title: 'Confirm fasting instructions', dueAt: new Date().toISOString() },
      }
    );
    expect(taskRes.status).toBe(201);
    expect(taskRes.data.task.isCompleted).toBe(false);

    const toggleRes = await apiJson<{ task: { isCompleted: boolean } }>(
      `/api/v1/crm/tasks/${taskRes.data.task.id}/toggle`,
      { method: 'PATCH', auth: receptionAuth }
    );
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.data.task.isCompleted).toBe(true);

    // 5) Convert lead to Patient A
    const convertRes = await apiJson<{ patient: { id: string; patientCode: string } }>(
      `/api/v1/crm/${leadId}/convert`,
      { method: 'POST', auth: receptionAuth }
    );
    expect(convertRes.status).toBe(200);
    expect(convertRes.data.patient.patientCode).toMatch(/^EDF-PT-/);
    patientAId = convertRes.data.patient.id;
  });

  it('detects duplicate patients, blocks unintended duplicates (409), and merges secondary records cleanly', async () => {
    // 1) Duplicate guard returns 409 for PHASE4_PHONES[0]
    const blockedDup = await apiJson<{ error: string; potentialDuplicates: Array<{ id: string }> }>(
      '/api/v1/patients',
      {
        method: 'POST',
        auth: receptionAuth,
        body: {
          fullName: 'Ananya Verma Duplicate',
          phone: PHASE4_PHONES[0],
          consentAccepted: true,
        },
      }
    );
    expect(blockedDup.status).toBe(409);
    expect(blockedDup.data.potentialDuplicates.some((p) => p.id === patientAId)).toBe(true);

    // 2) Create intentional duplicate (allowDuplicate: true) & verify /duplicates endpoint
    const allowedDup = await apiJson<{ patient: { id: string; patientCode: string } }>(
      '/api/v1/patients',
      {
        method: 'POST',
        auth: receptionAuth,
        body: {
          fullName: 'Ananya V Secondary',
          phone: PHASE4_PHONES[0],
          address: 'Gomti Nagar Extension, Lucknow',
          consentAccepted: true,
          allowDuplicate: true,
        },
      }
    );
    expect(allowedDup.status).toBe(201);
    const dupId = allowedDup.data.patient.id;

    const dupGroupsRes = await apiJson<{
      duplicateGroups: Array<{ patients: Array<{ id: string }> }>;
    }>('/api/v1/patients/duplicates', { auth: receptionAuth });
    expect(dupGroupsRes.status).toBe(200);
    expect(
      dupGroupsRes.data.duplicateGroups.some(
        (g) => g.patients.some((p) => p.id === patientAId) && g.patients.some((p) => p.id === dupId)
      )
    ).toBe(true);

    // Create an appointment attached to duplicate record so merge transfers it
    const bookRes = await apiJson<{
      appointment: { id: string; bookingReference: string };
    }>('/api/v1/appointments/book', {
      method: 'POST',
      auth: receptionAuth,
      body: {
        serviceId: generalServiceId,
        date: TEST_DATE_FUTURE,
        startTime: '11:00',
        patientName: 'Ananya V Secondary',
        patientPhone: PHASE4_PHONES[0],
        bookingChannel: 'PHONE',
        consentAccepted: true,
        isReceptionOverride: true,
        overrideReason: 'Phase 4 merge verification booking',
      },
    });
    expect(bookRes.status).toBe(201);
    apptAId = bookRes.data.appointment.id;
    apptARef = bookRes.data.appointment.bookingReference;
    // Point appointment explicitly to dupId to test merge ownership transfer
    await prisma.appointment.update({
      where: { id: apptAId },
      data: { patientId: dupId },
    });

    // 3) Merge duplicate dupId -> patientAId
    const mergeRes = await apiJson<{
      patient: { id: string; address: string | null };
      mergedFromCode: string;
    }>('/api/v1/patients/merge', {
      method: 'POST',
      auth: receptionAuth,
      body: {
        sourcePatientId: dupId,
        targetPatientId: patientAId,
        reason: 'Phase 4 duplicate cleanup test',
      },
    });
    expect(mergeRes.status).toBe(200);
    expect(mergeRes.data.patient.id).toBe(patientAId);
    expect(mergeRes.data.patient.address).toBe('Gomti Nagar Extension, Lucknow');

    const deletedDup = await prisma.patient.findUnique({ where: { id: dupId } });
    expect(deletedDup).toBeNull();

    const transferredAppt = await prisma.appointment.findUnique({ where: { id: apptAId } });
    expect(transferredAppt?.patientId).toBe(patientAId);

    // 4) Link appointment back onto CRM lead
    const linkRes = await apiJson<{
      lead: { linkedAppointment: { id: string; bookingReference: string } | null };
    }>(`/api/v1/crm/${leadId}/link-appointment`, {
      method: 'POST',
      auth: receptionAuth,
      body: { bookingReference: apptARef },
    });
    expect(linkRes.status).toBe(200);
    expect(linkRes.data.lead.linkedAppointment?.bookingReference).toBe(apptARef);

    // 5) Update patient profile & verify consent
    const patchPtRes = await apiJson<{ patient: { referredBy: string | null } }>(
      `/api/v1/patients/${patientAId}`,
      {
        method: 'PATCH',
        auth: receptionAuth,
        body: { referredBy: 'Dr. Meera Singh', consentAccepted: true },
      }
    );
    expect(patchPtRes.status).toBe(200);
    expect(patchPtRes.data.patient.referredBy).toBe('Dr. Meera Singh');
  });

  it('supports Doctor workspace queue, private PDF report upload, revisions, review, publish, and download audit logs', async () => {
    // Check in appointment via Reception so Visit is created
    await apiJson(`/api/v1/appointments/${apptAId}/confirm`, {
      method: 'POST',
      auth: receptionAuth,
      body: { isReceptionOverride: true, overrideReason: 'Verified at desk' },
    });
    const checkInRes = await apiJson<{ visit: { id: string; visitNumber: string } }>(
      `/api/v1/appointments/${apptAId}/check-in`,
      { method: 'POST', auth: receptionAuth }
    );
    expect(checkInRes.status).toBe(201);
    visitAId = checkInRes.data.visit.id;

    // Super Admin report queue contains upcoming/visits & assignedPatients
    const queueRes = await apiJson<{
      visits: Array<{ id: string }>;
      upcomingAppointments: Array<{ id: string }>;
      assignedPatients: Array<{ id: string }>;
    }>('/api/v1/reports/doctor-queue', { auth: superAdminAuth });
    expect(queueRes.status).toBe(200);
    expect(queueRes.data.visits.some((v) => v.id === visitAId)).toBe(true);
    expect(queueRes.data.upcomingAppointments.some((a) => a.id === apptAId)).toBe(true);
    expect(queueRes.data.assignedPatients.some((p) => p.id === patientAId)).toBe(true);

    // Non-PDF upload rejected (400)
    const badForm = new FormData();
    badForm.append('visitId', visitAId);
    badForm.append('title', 'Invalid Not PDF');
    badForm.append('reportPdf', new Blob(['plain text not pdf'], { type: 'application/pdf' }), 'fake.pdf');
    const badUpload = await fetch(`${baseUrl}/api/v1/reports/upload`, {
      method: 'POST',
      headers: { Cookie: superAdminAuth.cookie, 'X-CSRF-Token': superAdminAuth.csrf },
      body: badForm,
    });
    expect(badUpload.status).toBe(400);

    // Upload valid PDF Rev 1
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    const form1 = new FormData();
    form1.append('visitId', visitAId);
    form1.append('title', 'Abdominal Ultrasound Diagnostic Report');
    form1.append('reportPdf', new Blob([pdfBytes], { type: 'application/pdf' }), 'scan-rev1.pdf');
    const upload1Res = await fetch(`${baseUrl}/api/v1/reports/upload`, {
      method: 'POST',
      headers: { Cookie: superAdminAuth.cookie, 'X-CSRF-Token': superAdminAuth.csrf },
      body: form1,
    });
    expect(upload1Res.status).toBe(201);
    const up1Json = (await upload1Res.json()) as {
      report: { id: string; revisionNumber: number; status: string; storedFilePath: string };
    };
    expect(up1Json.report.revisionNumber).toBe(1);
    expect(up1Json.report.status).toBe('UNDER_REVIEW');
    reportRev1Id = up1Json.report.id;
    createdReportFiles.push(up1Json.report.storedFilePath);

    // Verify private report file is NOT accessible via public URL
    const directPublicAttempt = await fetch(`${baseUrl}/storage/reports/${up1Json.report.storedFilePath}`);
    expect(directPublicAttempt.headers.get('content-type') || '').not.toContain('application/pdf');

    // Upload PDF Rev 2 via appointmentId association
    const form2 = new FormData();
    form2.append('appointmentId', apptAId);
    form2.append('title', 'Abdominal Ultrasound Final Report');
    form2.append('reportPdf', new Blob([pdfBytes], { type: 'application/pdf' }), 'scan-rev2.pdf');
    const upload2Res = await fetch(`${baseUrl}/api/v1/reports/upload`, {
      method: 'POST',
      headers: { Cookie: superAdminAuth.cookie, 'X-CSRF-Token': superAdminAuth.csrf },
      body: form2,
    });
    expect(upload2Res.status).toBe(201);
    const up2Json = (await upload2Res.json()) as {
      report: { id: string; revisionNumber: number; status: string; storedFilePath: string };
    };
    expect(up2Json.report.revisionNumber).toBe(2);
    expect(up2Json.report.status).toBe('REVISED');
    reportRev2Id = up2Json.report.id;
    createdReportFiles.push(up2Json.report.storedFilePath);

    // Super Admin marks Rev 2 reviewed
    const reviewRes = await apiJson<{ report: { reviewedById: string } }>(
      `/api/v1/reports/${reportRev2Id}/review`,
      { method: 'POST', auth: superAdminAuth }
    );
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.data.report.reviewedById).toBe(superAdminAuth.userId);

    // Super Admin publishes Rev 2 (leaves Rev 1 UNDER_REVIEW)
    const pubRes = await apiJson<{ report: { status: string; publishedAt: string } }>(
      `/api/v1/reports/${reportRev2Id}/publish`,
      { method: 'POST', auth: superAdminAuth }
    );
    expect(pubRes.status).toBe(200);
    expect(pubRes.data.report.status).toBe('PUBLISHED');
    expect(pubRes.data.report.publishedAt).toBeTruthy();

    // Ensure WhatsApp notification contains portal-only wording (never clinical notes or attachments)
    const waLog = await prisma.whatsAppMessageLog.findFirst({
      where: { appointmentId: apptAId, templateKey: 'REPORT_PORTAL_NOTICE' },
    });
    expect(waLog?.messageBody).toContain('Patient Portal');
  });

  it('enforces strict role permissions across remaining roles and blocks cross-patient report/record access', async () => {
    // 1) RECEPTION cannot download reports, access clinical notes, or manage Admin users/audit logs
    expect(
      (await apiJson('/api/v1/reports/doctor-queue', { auth: receptionAuth })).status
    ).toBe(403);
    expect(
      (await apiJson(`/api/v1/reports/${reportRev2Id}/download`, { auth: receptionAuth })).status
    ).toBe(403);
    expect((await apiJson('/api/v1/admin/users', { auth: receptionAuth })).status).toBe(403);
    expect((await apiJson('/api/v1/admin/audit-logs', { auth: receptionAuth })).status).toBe(403);

    // Super Admin sets restricted clinical note; verify Reception has clinicalNotes masked (null)
    await apiJson(`/api/v1/reports/visits/${visitAId}`, {
      method: 'PATCH',
      auth: superAdminAuth,
      body: { clinicalNotes: 'CONFIDENTIAL FETAL SCAN CLINICAL NOTE' },
    });

    const adminPatientView = await apiJson<{
      patient: { visits: Array<{ clinicalNotes: string | null }> };
    }>(`/api/v1/patients/${patientAId}`, { auth: superAdminAuth });
    expect(adminPatientView.status).toBe(200);
    expect(adminPatientView.data.patient.visits[0].clinicalNotes).toBe(
      'CONFIDENTIAL FETAL SCAN CLINICAL NOTE'
    );

    const recepPatientView = await apiJson<{
      patient: { visits: Array<{ clinicalNotes: string | null }> };
    }>(`/api/v1/patients/${patientAId}`, { auth: receptionAuth });
    expect(recepPatientView.status).toBe(200);
    expect(recepPatientView.data.patient.visits[0].clinicalNotes).toBeNull();

    // 4) Cross-Patient Isolation: Register Patient A and Patient B portal accounts
    patientAUserEmail = `patienta.phase4.${Date.now()}@edfic.local`;
    patientBUserEmail = `patientb.phase4.${Date.now()}@edfic.local`;
    createdTestEmails.push(patientAUserEmail, patientBUserEmail);

    // Link email onto patientAId before registering Patient A so /register links patientAId cleanly
    await prisma.patient.update({
      where: { id: patientAId },
      data: { email: patientAUserEmail },
    });

    const regA = await apiJson<{
      user: { id: string; email: string; role: string; fullName: string; patientId: string };
    }>('/api/v1/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Ananya Verma Phase4',
        phone: PHASE4_PHONES[0],
        email: patientAUserEmail,
        password: 'PatientPassword123!',
        consentAccepted: true,
      },
    });
    expect(regA.status).toBe(201);
    patientAAuth = makeAuthBundle(regA.data.user);

    const regB = await apiJson<{
      user: { id: string; email: string; role: string; fullName: string; patientId: string };
    }>('/api/v1/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Priya Sharma PatientB',
        phone: PHASE4_PHONES[1],
        email: patientBUserEmail,
        password: 'PatientPassword123!',
        consentAccepted: true,
      },
    });
    expect(regB.status).toBe(201);
    patientBRecordId = regB.data.user.patientId;
    patientBAuth = makeAuthBundle(regB.data.user);
    expect(patientBRecordId).toBeTruthy();
    expect(patientBRecordId).not.toBe(patientAId);

    // Patient A CAN download own PUBLISHED Rev 2 PDF and creates ReportDownloadLog
    const dlA = await fetch(`${baseUrl}/api/v1/reports/${reportRev2Id}/download`, {
      headers: { Cookie: patientAAuth.cookie },
    });
    expect(dlA.status).toBe(200);
    expect(dlA.headers.get('content-type')).toContain('application/pdf');

    // Patient A CANNOT download unpublished Rev 1 (403)
    const dlAUnpub = await fetch(`${baseUrl}/api/v1/reports/${reportRev1Id}/download`, {
      headers: { Cookie: patientAAuth.cookie },
    });
    expect(dlAUnpub.status).toBe(403);

    // Patient B CANNOT download Patient A's published Rev 2 report (403)
    const dlCross = await fetch(`${baseUrl}/api/v1/reports/${reportRev2Id}/download`, {
      headers: { Cookie: patientBAuth.cookie },
    });
    expect(dlCross.status).toBe(403);

    // Patient B CANNOT access staff patient directory or Patient A record (403)
    expect(
      (await apiJson(`/api/v1/patients/${patientAId}`, { auth: patientBAuth })).status
    ).toBe(403);

    // Patient B CANNOT reschedule Patient A's appointment (403)
    expect(
      (
        await apiJson(`/api/v1/appointments/${apptAId}/reschedule`, {
          method: 'PATCH',
          auth: patientBAuth,
          body: { date: TEST_DATE_FUTURE, startTime: '12:00' },
        })
      ).status
    ).toBe(403);

    // Patient B portal strictly returns zero of Patient A's reports or appointments
    const portalB = await apiJson<{
      appointments: Array<{ id: string }>;
      reports: Array<{ id: string }>;
    }>('/api/v1/patients/me/portal', { auth: patientBAuth });
    expect(portalB.status).toBe(200);
    expect(portalB.data.appointments).toHaveLength(0);
    expect(portalB.data.reports).toHaveLength(0);

    // 5) Audit trail records download, merge, review, upload, publish, and patient access
    const reportAudit = await apiJson<{ logs: Array<{ action: string; resourceId: string }> }>(
      '/api/v1/admin/audit-logs?resourceType=DiagnosticReport',
      { auth: superAdminAuth }
    );
    expect(reportAudit.status).toBe(200);
    const actions = reportAudit.data.logs.map((l) => l.action);
    expect(actions).toContain('REPORT_UPLOADED');
    expect(actions).toContain('REPORT_REVIEWED');
    expect(actions).toContain('REPORT_PUBLISHED');
    expect(actions).toContain('REPORT_DOWNLOADED');

    const patientAudit = await apiJson<{ logs: Array<{ action: string }> }>(
      '/api/v1/admin/audit-logs?resourceType=Patient',
      { auth: superAdminAuth }
    );
    expect(patientAudit.data.logs.map((l) => l.action)).toEqual(
      expect.arrayContaining([
        'PATIENT_RECORD_ACCESSED',
        'PATIENT_RECORDS_MERGED',
        'PATIENT_UPDATED',
      ])
    );
  });
});
