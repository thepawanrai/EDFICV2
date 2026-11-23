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
import { resolvePrivateFile, EVIDENCE_DIR } from '../server/lib/storage';
import {
  bookAppointmentAtomic,
  expireStaleReservations,
  getAvailableSlots,
  holdSlotAtomic,
} from '../server/services/scheduling';

// Far-future deterministic test dates so tests never collide with current clock or seeded rows
const TEST_MONDAY = '2099-06-15'; // Monday
const TEST_TUESDAY = '2099-06-16'; // Tuesday
const TEST_WEDNESDAY = '2099-06-17'; // Wednesday
const TEST_HOLIDAY = '2099-06-18'; // Thursday (Holiday)
const TEST_FRIDAY = '2099-06-19'; // Friday
const TEST_SUNDAY = '2099-06-21'; // Sunday

const TEST_PHONES = [
  '9999000001',
  '9999000002',
  '9999000003',
  '9999000004',
  '9999000005',
  '9999000006',
  '9999000007',
  '9999000008',
  '9999000009',
  '9999000010',
  '9999000011',
  '9999000012',
  '9999000013',
];

let server: http.Server;
let baseUrl = '';
let morningServiceId = '';
let generalServiceId = '';
let receptionCookie = '';
let receptionCsrf = '';
let superAdminCookie = '';
let superAdminCsrf = '';
let originalMaxDaily = 40;
const createdEvidencePaths: string[] = [];

async function cleanupTestData() {
  const testAppointments = await prisma.appointment.findMany({
    where: {
      OR: [
        { patientPhone: { in: TEST_PHONES } },
        {
          appointmentDate: {
            in: [
              TEST_MONDAY,
              TEST_TUESDAY,
              TEST_WEDNESDAY,
              TEST_HOLIDAY,
              TEST_FRIDAY,
              TEST_SUNDAY,
            ],
          },
        },
      ],
    },
    select: { id: true, patientId: true },
  });

  const apptIds = testAppointments.map((a) => a.id);
  const patientIds = Array.from(new Set(testAppointments.map((a) => a.patientId)));

  if (apptIds.length > 0) {
    await prisma.whatsAppMessageLog.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.payment.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.visit.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
  }

  await prisma.slotHold.deleteMany({
    where: {
      date: {
        in: [TEST_MONDAY, TEST_TUESDAY, TEST_WEDNESDAY, TEST_HOLIDAY, TEST_FRIDAY, TEST_SUNDAY],
      },
    },
  });

  await prisma.clinicHoliday.deleteMany({
    where: { date: TEST_HOLIDAY },
  });

  const extraPatients = await prisma.patient.findMany({
    where: {
      OR: [{ phone: { in: TEST_PHONES } }, { id: { in: patientIds } }],
    },
    select: { id: true },
  });
  const allPatientIds = extraPatients.map((p) => p.id);
  if (allPatientIds.length > 0) {
    await prisma.patient.deleteMany({ where: { id: { in: allPatientIds } } });
  }

  await prisma.webhookEvent.deleteMany({
    where: {
      eventId: {
        contains: 'test',
      },
    },
  });

  await prisma.clinicSetting.update({
    where: { id: 'singleton' },
    data: { maxDailyAppointments: originalMaxDaily },
  });
}

function makeStaffAuth(user: { id: string; email: string; role: string; fullName: string }) {
  const jwt = signSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  });
  const csrf = generateCsrfToken();
  return {
    cookie: `${AUTH_COOKIE_NAME}=${jwt}; ${CSRF_COOKIE_NAME}=${csrf}`,
    csrf,
  };
}

async function apiJson<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    csrf?: string;
  } = {}
): Promise<{ status: number; data: T }> {
  const csrf = options.csrf || generateCsrfToken();
  const cookie = options.cookie || `${CSRF_COOKIE_NAME}=${csrf}`;
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

beforeAll(async () => {
  const app = await createEdficApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Could not bind test HTTP server.');
  }
  baseUrl = `http://127.0.0.1:${addr.port}`;

  const settings = await prisma.clinicSetting.findUnique({ where: { id: 'singleton' } });
  originalMaxDaily = settings?.maxDailyAppointments ?? 40;

  await cleanupTestData();

  const morningSvc = await prisma.diagnosticService.findFirst({
    where: { requiresDoctorMorning: true },
  });
  const generalSvc = await prisma.diagnosticService.findFirst({
    where: { requiresDoctorMorning: false, durationMinutes: 30 },
  });
  if (!morningSvc || !generalSvc) {
    throw new Error('Seeded diagnostic services required for Phase 3 tests.');
  }
  morningServiceId = morningSvc.id;
  generalServiceId = generalSvc.id;

  const receptionUser = await prisma.user.findFirst({ where: { role: 'RECEPTION', isActive: true } });
  const superAdminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', isActive: true } });
  if (!receptionUser || !superAdminUser) {
    throw new Error('Seeded staff users required for Phase 3 tests.');
  }

  const rAuth = makeStaffAuth(receptionUser);
  receptionCookie = rAuth.cookie;
  receptionCsrf = rAuth.csrf;

  const aAuth = makeStaffAuth(superAdminUser);
  superAdminCookie = aAuth.cookie;
  superAdminCsrf = aAuth.csrf;
});

afterAll(async () => {
  await cleanupTestData();
  for (const relPath of createdEvidencePaths) {
    const abs = resolvePrivateFile(EVIDENCE_DIR, relPath);
    if (abs && fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Phase 3 – Automatic Appointment Scheduling & Concurrency', () => {
  it('computes available weekday, morning-restricted, and Sunday schedule windows accurately', async () => {
    const weekday = await getAvailableSlots({ date: TEST_MONDAY, serviceId: generalServiceId });
    expect(weekday.isHoliday).toBe(false);
    expect(weekday.isSunday).toBe(false);
    expect(weekday.slots[0].startTime).toBe('09:00');
    expect(weekday.slots[weekday.slots.length - 1].endTime).toBe('20:00');

    const morningOnly = await getAvailableSlots({ date: TEST_MONDAY, serviceId: morningServiceId });
    expect(morningOnly.slots[0].startTime).toBe('09:30');
    expect(morningOnly.slots.every((s) => s.endTime <= '13:30')).toBe(true);

    const sunday = await getAvailableSlots({ date: TEST_SUNDAY, serviceId: generalServiceId });
    expect(sunday.isSunday).toBe(true);
    expect(sunday.slots[0].startTime).toBe('10:00');
    expect(sunday.slots[sunday.slots.length - 1].endTime).toBe('14:00');
  });

  it('blocks unavailable slots: clinic holidays, outside operating hours, past slots, and daily capacity limit', async () => {
    await prisma.clinicHoliday.create({
      data: { date: TEST_HOLIDAY, reason: 'Annual Maintenance Closure', isFullDay: true },
    });

    const holidayAvail = await getAvailableSlots({ date: TEST_HOLIDAY, serviceId: generalServiceId });
    expect(holidayAvail.isHoliday).toBe(true);
    expect(holidayAvail.slots).toHaveLength(0);

    await expect(
      bookAppointmentAtomic({
        serviceId: generalServiceId,
        date: TEST_HOLIDAY,
        startTime: '10:00',
        patientName: 'Holiday Tester',
        patientPhone: TEST_PHONES[0],
      })
    ).rejects.toThrow(/closed/i);

    await expect(
      bookAppointmentAtomic({
        serviceId: morningServiceId,
        date: TEST_MONDAY,
        startTime: '15:30',
        patientName: 'Afternoon MorningScan',
        patientPhone: TEST_PHONES[0],
      })
    ).rejects.toThrow(/morning doctor session/i);

    await expect(
      bookAppointmentAtomic({
        serviceId: generalServiceId,
        date: '2020-01-10',
        startTime: '10:00',
        patientName: 'Past Tester',
        patientPhone: TEST_PHONES[0],
      })
    ).rejects.toThrow(/past time slot/i);

    // Verify daily capacity enforcement
    await prisma.clinicSetting.update({
      where: { id: 'singleton' },
      data: { maxDailyAppointments: 1 },
    });
    try {
      await bookAppointmentAtomic({
        serviceId: generalServiceId,
        date: TEST_FRIDAY,
        startTime: '10:00',
        patientName: 'Daily Cap First',
        patientPhone: TEST_PHONES[1],
      });
      await expect(
        bookAppointmentAtomic({
          serviceId: generalServiceId,
          date: TEST_FRIDAY,
          startTime: '11:00',
          patientName: 'Daily Cap Second',
          patientPhone: TEST_PHONES[2],
        })
      ).rejects.toThrow(/Daily clinic booking capacity/i);
    } finally {
      await prisma.clinicSetting.update({
        where: { id: 'singleton' },
        data: { maxDailyAppointments: originalMaxDaily },
      });
    }
  });

  it('prevents duplicate bookings for the same patient phone and service/slot on the same day', async () => {
    await bookAppointmentAtomic({
      serviceId: generalServiceId,
      date: TEST_MONDAY,
      startTime: '16:00',
      patientName: 'Duplicate Check Patient',
      patientPhone: TEST_PHONES[3],
    });

    await expect(
      bookAppointmentAtomic({
        serviceId: generalServiceId,
        date: TEST_MONDAY,
        startTime: '16:30',
        patientName: 'Duplicate Check Patient',
        patientPhone: TEST_PHONES[3],
      })
    ).rejects.toThrow(/duplicate active booking/i);
  });

  it('enforces slot capacity under simultaneous concurrent Promise.all booking requests', async () => {
    // 1) Morning doctor scan has effective capacity = 1: only 1 of 4 simultaneous callers should succeed
    const morningAttempts = [TEST_PHONES[4], TEST_PHONES[5], TEST_PHONES[6], TEST_PHONES[7]].map(
      (phone, idx) =>
        bookAppointmentAtomic({
          serviceId: morningServiceId,
          date: TEST_TUESDAY,
          startTime: '10:00',
          patientName: `Concurrent Morning ${idx + 1}`,
          patientPhone: phone,
        })
    );
    const morningResults = await Promise.allSettled(morningAttempts);
    const morningFulfilled = morningResults.filter((r) => r.status === 'fulfilled');
    const morningRejected = morningResults.filter((r) => r.status === 'rejected');
    expect(morningFulfilled).toHaveLength(1);
    expect(morningRejected).toHaveLength(3);

    // 2) General ultrasound has capacity = 2: exactly 2 of 4 simultaneous callers should succeed
    const generalAttempts = [TEST_PHONES[8], TEST_PHONES[9], TEST_PHONES[10], TEST_PHONES[11]].map(
      (phone, idx) =>
        bookAppointmentAtomic({
          serviceId: generalServiceId,
          date: TEST_TUESDAY,
          startTime: '17:00',
          patientName: `Concurrent General ${idx + 1}`,
          patientPhone: phone,
        })
    );
    const generalResults = await Promise.allSettled(generalAttempts);
    const generalFulfilled = generalResults.filter((r) => r.status === 'fulfilled');
    const generalRejected = generalResults.filter((r) => r.status === 'rejected');
    expect(generalFulfilled).toHaveLength(2);
    expect(generalRejected).toHaveLength(2);
  });

  it('expires both temporary SlotHolds and unpaid PENDING_ADVANCE reservations, freeing the slot', async () => {
    // Part A: SlotHold blocks other sessions until expired
    await holdSlotAtomic({
      serviceId: morningServiceId,
      date: TEST_WEDNESDAY,
      startTime: '11:00',
      sessionToken: 'sess-holder-active',
      holdMinutes: 5,
    });

    await expect(
      bookAppointmentAtomic({
        serviceId: morningServiceId,
        date: TEST_WEDNESDAY,
        startTime: '11:00',
        sessionToken: 'sess-intruder',
        patientName: 'Intruder During Hold',
        patientPhone: TEST_PHONES[12],
      })
    ).rejects.toThrow(/just reserved|another/i);

    // Expire the hold in DB and verify booking succeeds
    await prisma.slotHold.updateMany({
      where: { sessionToken: 'sess-holder-active' },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const booked = await bookAppointmentAtomic({
      serviceId: morningServiceId,
      date: TEST_WEDNESDAY,
      startTime: '11:00',
      sessionToken: 'sess-intruder',
      patientName: 'Unpaid Hold Patient',
      patientPhone: TEST_PHONES[12],
    });

    // Part B: Force appointment's unpaid reservationExpiresAt into the past and run expiry sweep
    await prisma.appointment.update({
      where: { id: booked.appointment.id },
      data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
    });

    const expirySummary = await expireStaleReservations();
    expect(expirySummary.expiredAppointments).toBeGreaterThanOrEqual(1);

    const refreshed = await prisma.appointment.findUnique({
      where: { id: booked.appointment.id },
    });
    expect(refreshed?.status).toBe('CANCELLED');

    const slotsAfterExpiry = await getAvailableSlots({
      date: TEST_WEDNESDAY,
      serviceId: morningServiceId,
    });
    const freedSlot = slotsAfterExpiry.slots.find((s) => s.startTime === '11:00');
    expect(freedSlot?.available).toBe(true);
  });
});

describe('Phase 3 – UPI Payments, Verification, Receipts, Confirmation & Rescheduling APIs', () => {
  let bookingId = '';
  let bookingReference = '';
  const patientPhone = TEST_PHONES[0];

  it('creates booking via HTTP, records UTR + PNG evidence as SUBMITTED without auto-verifying, rejects invalid UTR, then verifies with receipt & balance, and handles refund', async () => {
    // 1) Create online booking via API
    const createRes = await apiJson<{
      appointment: { id: string; bookingReference: string; status: string };
    }>('/api/v1/appointments/book', {
      method: 'POST',
      body: {
        serviceId: generalServiceId,
        date: TEST_WEDNESDAY,
        startTime: '15:00',
        patientName: 'Payment Flow Patient',
        patientPhone,
        consentAccepted: true,
      },
    });
    expect(createRes.status).toBe(201);
    expect(createRes.data.appointment.status).toBe('PENDING_ADVANCE');
    bookingId = createRes.data.appointment.id;
    bookingReference = createRes.data.appointment.bookingReference;

    // 2) Submit UTR + PNG evidence screenshot -> MUST become SUBMITTED (never VERIFIED!)
    const csrf = generateCsrfToken();
    const form = new FormData();
    form.append('bookingReference', bookingReference);
    form.append('phone', patientPhone);
    form.append('utrReference', 'UTR999900001');
    form.append('amountSubmittedInr', '500');
    form.append('paymentDate', TEST_WEDNESDAY);
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    form.append('evidence', new Blob([pngBytes], { type: 'image/png' }), 'upi-proof.png');

    const submitRes = await fetch(`${baseUrl}/api/v1/payments/submit-utr`, {
      method: 'POST',
      headers: {
        Cookie: `${CSRF_COOKIE_NAME}=${csrf}`,
        'X-CSRF-Token': csrf,
      },
      body: form,
    });
    expect(submitRes.status).toBe(201);
    const submitBody = (await submitRes.json()) as { payment: { id: string; status: string } };
    expect(submitBody.payment.status).toBe('SUBMITTED');

    const storedPay1 = await prisma.payment.findUnique({ where: { id: submitBody.payment.id } });
    if (storedPay1?.evidenceFilePath) {
      createdEvidencePaths.push(storedPay1.evidenceFilePath);
    }

    const apptAfterSubmit = await prisma.appointment.findUnique({ where: { id: bookingId } });
    expect(apptAfterSubmit?.status).toBe('ADVANCE_SUBMITTED');

    // 3) Reject invalid UTR -> Payment REJECTED, Appointment reverts to PENDING_ADVANCE
    const rejectRes = await apiJson<{ payment: { status: string; rejectionReason: string } }>(
      `/api/v1/payments/${submitBody.payment.id}/reject`,
      {
        method: 'POST',
        cookie: receptionCookie,
        csrf: receptionCsrf,
        body: { rejectionReason: 'UTR not credited in EDFIC statement' },
      }
    );
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.data.payment.status).toBe('REJECTED');

    const apptAfterReject = await prisma.appointment.findUnique({ where: { id: bookingId } });
    expect(apptAfterReject?.status).toBe('PENDING_ADVANCE');

    // 4) Re-submit valid UTR, move to UNDER_VERIFICATION, then VERIFY with total fee -> receipt + balance
    const csrf2 = generateCsrfToken();
    const form2 = new FormData();
    form2.append('bookingReference', bookingReference);
    form2.append('phone', patientPhone);
    form2.append('utrReference', 'UTR999900002');
    form2.append('amountSubmittedInr', '500');
    form2.append('paymentDate', TEST_WEDNESDAY);
    const submitRes2 = await fetch(`${baseUrl}/api/v1/payments/submit-utr`, {
      method: 'POST',
      headers: {
        Cookie: `${CSRF_COOKIE_NAME}=${csrf2}`,
        'X-CSRF-Token': csrf2,
      },
      body: form2,
    });
    const submitBody2 = (await submitRes2.json()) as { payment: { id: string; status: string } };
    expect(submitBody2.payment.status).toBe('SUBMITTED');

    const underReviewRes = await apiJson<{ payment: { status: string } }>(
      `/api/v1/payments/${submitBody2.payment.id}/under-verification`,
      {
        method: 'POST',
        cookie: receptionCookie,
        csrf: receptionCsrf,
      }
    );
    expect(underReviewRes.status).toBe(200);
    expect(underReviewRes.data.payment.status).toBe('UNDER_VERIFICATION');

    const verifyRes = await apiJson<{
      payment: { status: string; receiptNumber: string; totalServiceFeeInr: number };
    }>(`/api/v1/payments/${submitBody2.payment.id}/verify`, {
      method: 'POST',
      cookie: receptionCookie,
      csrf: receptionCsrf,
      body: { totalServiceFeeInr: 1800 },
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.payment.status).toBe('VERIFIED');
    expect(verifyRes.data.payment.receiptNumber).toMatch(/^RCPT-\d{8}-[A-F0-9]{4}$/);

    const apptAfterVerify = await prisma.appointment.findUnique({ where: { id: bookingId } });
    expect(apptAfterVerify?.status).toBe('CONFIRMED');

    // 5) Check structured receipt & remaining balance endpoint
    const receiptRes = await apiJson<{
      receipt: {
        receiptNumber: string;
        amountPaidInr: number;
        totalServiceFeeInr: number;
        balanceDueInr: number;
      };
    }>(`/api/v1/payments/${submitBody2.payment.id}/receipt`, {
      cookie: receptionCookie,
      csrf: receptionCsrf,
    });
    expect(receiptRes.status).toBe(200);
    expect(receiptRes.data.receipt.balanceDueInr).toBe(1300);

    // 6) Super Admin marks verified payment as REFUNDED
    const refundRes = await apiJson<{ payment: { status: string; refundReason: string } }>(
      `/api/v1/payments/${submitBody2.payment.id}/refund`,
      {
        method: 'POST',
        cookie: superAdminCookie,
        csrf: superAdminCsrf,
        body: { refundReason: 'Patient rescheduled elsewhere; UPI advance refunded' },
      }
    );
    expect(refundRes.status).toBe(200);
    expect(refundRes.data.payment.status).toBe('REFUNDED');
  });

  it('enforces explicit confirmation rules, rescheduling validation, reception override, and operational notes', async () => {
    // Create a phone booking via Reception
    const phoneBookRes = await apiJson<{
      appointment: { id: string; bookingReference: string; bookingChannel: string; status: string };
    }>('/api/v1/appointments/book', {
      method: 'POST',
      cookie: receptionCookie,
      csrf: receptionCsrf,
      body: {
        serviceId: generalServiceId,
        date: TEST_WEDNESDAY,
        startTime: '18:00',
        patientName: 'Phone Booking Patient',
        patientPhone: TEST_PHONES[1],
        bookingChannel: 'PHONE',
        consentAccepted: true,
        notes: 'Patient requested evening slot',
      },
    });
    expect(phoneBookRes.status).toBe(201);
    expect(phoneBookRes.data.appointment.bookingChannel).toBe('PHONE');
    const phoneApptId = phoneBookRes.data.appointment.id;

    // Attempting to confirm without verified payment & without override must fail with 422
    const unverifiedConfirm = await apiJson<{ error: string }>(
      `/api/v1/appointments/${phoneApptId}/confirm`,
      {
        method: 'POST',
        cookie: receptionCookie,
        csrf: receptionCsrf,
        body: { isReceptionOverride: false },
      }
    );
    expect(unverifiedConfirm.status).toBe(422);

    // Confirming WITH authorized Reception Override succeeds
    const overrideConfirm = await apiJson<{
      appointment: { status: string; isReceptionOverride: boolean };
    }>(`/api/v1/appointments/${phoneApptId}/confirm`, {
      method: 'POST',
      cookie: receptionCookie,
      csrf: receptionCsrf,
      body: {
        isReceptionOverride: true,
        overrideReason: 'Pay at desk authorized for returning patient',
      },
    });
    expect(overrideConfirm.status).toBe(200);
    expect(overrideConfirm.data.appointment.status).toBe('CONFIRMED');
    expect(overrideConfirm.data.appointment.isReceptionOverride).toBe(true);

    // Reschedule into invalid holiday slot without override fails (409)
    await prisma.clinicHoliday.upsert({
      where: { date: TEST_HOLIDAY },
      update: { reason: 'Holiday Block', isFullDay: true },
      create: { date: TEST_HOLIDAY, reason: 'Holiday Block', isFullDay: true },
    });
    const blockedResched = await apiJson<{ error: string }>(
      `/api/v1/appointments/${phoneApptId}/reschedule`,
      {
        method: 'PATCH',
        cookie: receptionCookie,
        csrf: receptionCsrf,
        body: {
          date: TEST_HOLIDAY,
          startTime: '10:00',
          isReceptionOverride: false,
        },
      }
    );
    expect(blockedResched.status).toBe(409);

    // Reschedule into open slot succeeds
    const validResched = await apiJson<{
      appointment: { appointmentDate: string; startTime: string };
    }>(`/api/v1/appointments/${phoneApptId}/reschedule`, {
      method: 'PATCH',
      cookie: receptionCookie,
      csrf: receptionCsrf,
      body: {
        date: TEST_WEDNESDAY,
        startTime: '18:30',
        isReceptionOverride: false,
        reason: 'Patient requested 30 min later',
      },
    });
    expect(validResched.status).toBe(200);
    expect(validResched.data.appointment.startTime).toBe('18:30');

    // Update operational notes
    const notesRes = await apiJson<{ appointment: { notes: string } }>(
      `/api/v1/appointments/${phoneApptId}/notes`,
      {
        method: 'PATCH',
        cookie: receptionCookie,
        csrf: receptionCsrf,
        body: { notes: 'Bring prior renal ultrasound report' },
      }
    );
    expect(notesRes.status).toBe(200);
    expect(notesRes.data.appointment.notes).toBe('Bring prior renal ultrasound report');
  });
});
