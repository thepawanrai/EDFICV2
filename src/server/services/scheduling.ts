import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.ts';
import { dispatchN8nEvent } from './automation.ts';

export interface ComputedSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  remainingCapacity: number;
  reason?: string;
}

const dateMutexChains = new Map<string, Promise<unknown>>();

export async function withDateLock<T>(date: string, fn: () => Promise<T>): Promise<T> {
  const prev = dateMutexChains.get(date) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  dateMutexChains.set(date, next);

  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (dateMutexChains.get(date) === next) {
      dateMutexChains.delete(date);
    }
  }
}

function getTxOptions() {
  return process.env.DATABASE_URL?.startsWith('mysql')
    ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    : undefined;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export async function expireStaleReservations(now: Date = new Date()): Promise<{
  expiredHolds: number;
  expiredAppointments: number;
}> {
  const deletedHolds = await prisma.slotHold.deleteMany({
    where: { expiresAt: { lte: now } },
  });

  const staleAppointments = await prisma.appointment.findMany({
    where: {
      status: 'PENDING_ADVANCE',
      reservationExpiresAt: { lte: now },
      payments: {
        none: {
          status: { in: ['SUBMITTED', 'UNDER_VERIFICATION', 'VERIFIED'] },
        },
      },
    },
    select: {
      id: true,
      bookingReference: true,
      appointmentDate: true,
      startTime: true,
      patientPhone: true,
    },
  });

  let expiredCount = 0;
  for (const appt of staleAppointments) {
    const updated = await prisma.appointment.updateMany({
      where: {
        id: appt.id,
        status: 'PENDING_ADVANCE',
      },
      data: {
        status: 'CANCELLED',
        cancelledReason: 'Reservation expired: advance payment not received within window',
      },
    });
    if (updated.count > 0) {
      expiredCount += 1;
      await dispatchN8nEvent({
        eventId: `appt-expired-${appt.id}`,
        eventType: 'appointment.reservation_expired',
        payload: {
          bookingReference: appt.bookingReference,
          appointmentDate: appt.appointmentDate,
          startTime: appt.startTime,
          patientPhone: appt.patientPhone,
        },
      }).catch(() => undefined);
    }
  }

  return {
    expiredHolds: deletedHolds.count,
    expiredAppointments: expiredCount,
  };
}

export async function getAvailableSlots(params: {
  date: string;
  serviceId: string;
  sessionToken?: string;
  now?: Date;
}): Promise<{
  date: string;
  isHoliday: boolean;
  holidayReason?: string;
  isSunday: boolean;
  dailyCapacityReached: boolean;
  slots: ComputedSlot[];
}> {
  const { date, serviceId, sessionToken } = params;
  const now = params.now ?? new Date();

  await expireStaleReservations(now);

  const service = await prisma.diagnosticService.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw new Error('Selected diagnostic service not found.');
  }

  const holiday = await prisma.clinicHoliday.findUnique({ where: { date } });
  if (holiday && holiday.isFullDay) {
    return {
      date,
      isHoliday: true,
      holidayReason: holiday.reason,
      isSunday: new Date(`${date}T00:00:00`).getDay() === 0,
      dailyCapacityReached: false,
      slots: [],
    };
  }

  const settings = await prisma.clinicSetting.findUnique({ where: { id: 'singleton' } });
  const slotStep = settings?.slotDurationMinutes ?? 30;
  const capacity = settings?.slotCapacityPerSlot ?? 2;
  const maxDaily = settings?.maxDailyAppointments ?? 40;
  const morningStart = timeToMinutes(settings?.morningSessionStart ?? '09:30');
  const morningEnd = timeToMinutes(settings?.morningSessionEnd ?? '13:30');

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const isSunday = dayOfWeek === 0;

  // Operating hours: Mon-Sat 09:00-20:00, Sun 10:00-14:00 (by appointment)
  let windowStart = isSunday ? timeToMinutes('10:00') : timeToMinutes('09:00');
  let windowEnd = isSunday ? timeToMinutes('14:00') : timeToMinutes('20:00');

  if (service.requiresDoctorMorning) {
    windowStart = Math.max(windowStart, morningStart);
    windowEnd = Math.min(windowEnd, morningEnd);
  }

  const todayStr = now.toISOString().slice(0, 10);
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      appointmentDate: date,
      status: {
        notIn: ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'],
      },
    },
    select: {
      startTime: true,
      endTime: true,
    },
  });

  const dailyCapacityReached = existingAppointments.length >= maxDaily;

  const activeHolds = await prisma.slotHold.findMany({
    where: {
      date,
      expiresAt: { gt: now },
      ...(sessionToken ? { sessionToken: { not: sessionToken } } : {}),
    },
    select: {
      startTime: true,
      serviceId: true,
    },
  });

  const slots: ComputedSlot[] = [];
  const duration = service.durationMinutes || slotStep;

  for (let start = windowStart; start + duration <= windowEnd; start += slotStep) {
    const startTime = minutesToTime(start);
    const endTime = minutesToTime(start + duration);

    if (date === todayStr && start <= currentMins + 30) {
      slots.push({
        startTime,
        endTime,
        available: false,
        remainingCapacity: 0,
        reason: 'Slot time has passed',
      });
      continue;
    }

    if (dailyCapacityReached) {
      slots.push({
        startTime,
        endTime,
        available: false,
        remainingCapacity: 0,
        reason: 'Daily clinic capacity reached',
      });
      continue;
    }

    const overlappingBookings = existingAppointments.filter((appt) => {
      const aStart = timeToMinutes(appt.startTime);
      const aEnd = timeToMinutes(appt.endTime);
      return start < aEnd && start + duration > aStart;
    }).length;

    const overlappingHolds = activeHolds.filter((hold) => hold.startTime === startTime).length;
    const effectiveCapacity = service.requiresDoctorMorning ? 1 : capacity;
    const remaining = Math.max(0, effectiveCapacity - overlappingBookings - overlappingHolds);

    slots.push({
      startTime,
      endTime,
      available: remaining > 0,
      remainingCapacity: remaining,
      reason: remaining > 0 ? undefined : 'Fully booked',
    });
  }

  return {
    date,
    isHoliday: false,
    isSunday,
    dailyCapacityReached,
    slots,
  };
}

export async function holdSlotAtomic(params: {
  serviceId: string;
  date: string;
  startTime: string;
  sessionToken: string;
  holdMinutes?: number;
  now?: Date;
}): Promise<{ heldUntil: Date; startTime: string; date: string }> {
  const { serviceId, date, startTime, sessionToken, holdMinutes = 5 } = params;
  const now = params.now ?? new Date();

  return withDateLock(date, async () => {
    const availability = await getAvailableSlots({ date, serviceId, sessionToken, now });
    const slot = availability.slots.find((s) => s.startTime === startTime);
    if (!slot || !slot.available) {
      throw new Error(slot?.reason || 'This time slot is no longer available.');
    }

    const expiresAt = new Date(now.getTime() + holdMinutes * 60 * 1000);
    await prisma.$transaction(async (tx) => {
      await tx.slotHold.deleteMany({
        where: {
          OR: [{ sessionToken }, { expiresAt: { lte: now } }],
        },
      });
      await tx.slotHold.create({
        data: {
          serviceId,
          date,
          startTime,
          sessionToken,
          expiresAt,
        },
      });
    }, getTxOptions());

    return { heldUntil: expiresAt, startTime, date };
  });
}

export interface BookAppointmentInput {
  serviceId: string;
  date: string;
  startTime: string;
  sessionToken?: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  dateOfBirth?: string;
  clinicalIndication?: string;
  referringDoctor?: string;
  bookingChannel?: 'ONLINE' | 'PHONE' | 'WALK_IN';
  isReceptionOverride?: boolean;
  overrideReason?: string;
  notes?: string;
  actorUserId?: string;
  actorRole?: string;
  now?: Date;
}

export async function bookAppointmentAtomic(input: BookAppointmentInput) {
  const now = input.now ?? new Date();
  const allowOverride =
    Boolean(input.isReceptionOverride) &&
    Boolean(input.actorRole && ['SUPER_ADMIN', 'RECEPTION'].includes(input.actorRole));
  const channel = input.bookingChannel || 'ONLINE';

  return withDateLock(input.date, async () => {
    await expireStaleReservations(now);

    return prisma.$transaction(async (tx) => {
      const service = await tx.diagnosticService.findUnique({
        where: { id: input.serviceId },
      });
      if (!service) {
        throw new Error('Selected diagnostic service was not found.');
      }

      const settings = await tx.clinicSetting.findUnique({
        where: { id: 'singleton' },
      });

      const duration = service.durationMinutes || settings?.slotDurationMinutes || 30;
      const reqStart = timeToMinutes(input.startTime);
      const reqEnd = reqStart + duration;
      const endTime = minutesToTime(reqEnd);
      const capacity = service.requiresDoctorMorning ? 1 : settings?.slotCapacityPerSlot ?? 2;
      const maxDaily = settings?.maxDailyAppointments ?? 40;

      if (!allowOverride) {
        const holiday = await tx.clinicHoliday.findUnique({
          where: { date: input.date },
        });
        if (holiday?.isFullDay) {
          throw new Error(`Clinic closed on ${input.date}: ${holiday.reason}`);
        }

        // Enforce clinic operating hours & morning session window
        const dayOfWeek = new Date(`${input.date}T00:00:00`).getDay();
        const isSunday = dayOfWeek === 0;
        let windowStart = isSunday ? timeToMinutes('10:00') : timeToMinutes('09:00');
        let windowEnd = isSunday ? timeToMinutes('14:00') : timeToMinutes('20:00');
        if (service.requiresDoctorMorning) {
          windowStart = Math.max(
            windowStart,
            timeToMinutes(settings?.morningSessionStart ?? '09:30')
          );
          windowEnd = Math.min(
            windowEnd,
            timeToMinutes(settings?.morningSessionEnd ?? '13:30')
          );
        }

        if (reqStart < windowStart || reqEnd > windowEnd) {
          throw new Error(
            service.requiresDoctorMorning
              ? 'This specialist scan is only available during the daily morning doctor session.'
              : 'Requested slot is outside EDFIC operating hours.'
          );
        }

        const todayStr = now.toISOString().slice(0, 10);
        const currentMins = now.getHours() * 60 + now.getMinutes();
        if (input.date < todayStr || (input.date === todayStr && reqStart <= currentMins + 30)) {
          throw new Error('Cannot reserve a past time slot.');
        }

        const existingOnDate = await tx.appointment.findMany({
          where: {
            appointmentDate: input.date,
            status: { notIn: ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'] },
          },
          select: {
            startTime: true,
            endTime: true,
            patientPhone: true,
            serviceId: true,
          },
        });

        if (existingOnDate.length >= maxDaily) {
          throw new Error('Daily clinic booking capacity reached for the selected date.');
        }

        // Duplicate booking protection
        const normalizedPhone = input.patientPhone.trim();
        const duplicate = existingOnDate.find(
          (a) =>
            a.patientPhone === normalizedPhone &&
            (a.startTime === input.startTime || a.serviceId === input.serviceId)
        );
        if (duplicate) {
          throw new Error(
            'A duplicate active booking already exists for this patient phone and service/slot on this date.'
          );
        }

        // Concurrent slot capacity & active foreign hold protection
        const overlapping = existingOnDate.filter((a) => {
          const aStart = timeToMinutes(a.startTime);
          const aEnd = timeToMinutes(a.endTime);
          return reqStart < aEnd && reqEnd > aStart;
        }).length;

        const foreignHolds = await tx.slotHold.count({
          where: {
            date: input.date,
            startTime: input.startTime,
            expiresAt: { gt: now },
            ...(input.sessionToken ? { sessionToken: { not: input.sessionToken } } : {}),
          },
        });

        if (overlapping + foreignHolds >= capacity) {
          throw new Error('Selected time slot was just reserved. Please pick another slot.');
        }
      }

      // Find or create patient profile
      let patient =
        input.actorRole === 'PATIENT' && input.actorUserId
          ? await tx.patient.findUnique({ where: { userId: input.actorUserId } })
          : null;

      if (!patient) {
        patient = await tx.patient.findFirst({
          where: { phone: input.patientPhone.trim() },
        });
      }

      if (!patient) {
        const patientCount = await tx.patient.count();
        const patientCode = `EDF-PT-${(1001 + patientCount).toString()}`;
        patient = await tx.patient.create({
          data: {
            patientCode,
            userId: input.actorRole === 'PATIENT' ? input.actorUserId ?? null : null,
            fullName: input.patientName.trim(),
            phone: input.patientPhone.trim(),
            email: input.patientEmail?.trim() || null,
            dateOfBirth: input.dateOfBirth || null,
            referredBy: input.referringDoctor?.trim() || null,
            consentAccepted: true,
            consentTimestamp: now,
          },
        });
      }

      const bookingReference = await generateUniqueBookingReference();

      const expiryMinutes = settings?.reservationExpiryMinutes ?? 30;
      const reservationExpiresAt =
        channel === 'ONLINE'
          ? new Date(now.getTime() + expiryMinutes * 60 * 1000)
          : null;

      const appointment = await tx.appointment.create({
        data: {
          bookingReference,
          patientId: patient.id,
          serviceId: service.id,
          doctorId: null,
          appointmentDate: input.date,
          startTime: input.startTime,
          endTime,
          status: 'PENDING_ADVANCE',
          patientName: input.patientName.trim(),
          patientPhone: input.patientPhone.trim(),
          patientEmail: input.patientEmail?.trim() || null,
          clinicalIndication: input.clinicalIndication?.trim() || null,
          referringDoctor: input.referringDoctor?.trim() || null,
          bookingChannel: channel,
          isReceptionOverride: allowOverride,
          overrideReason: allowOverride ? input.overrideReason?.trim() || 'Reception override' : null,
          reservationExpiresAt,
          notes: input.notes?.trim() || null,
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              advanceAmountInr: true,
              preparationNotes: true,
            },
          },
        },
      });

      if (input.sessionToken) {
        await tx.slotHold.deleteMany({
          where: { sessionToken: input.sessionToken },
        });
      }

      const expectedAdvance =
        appointment.service.advanceAmountInr || settings?.defaultAdvanceAmountInr || 500;

      return {
        appointment,
        patient,
        upiPayment: {
          upiId: settings?.upiId || 'edfic.lucknow@upi',
          merchantName:
            settings?.upiMerchantName || 'EWA Diagnostic & Fetal Imaging Centre',
          expectedAdvanceInr: expectedAdvance,
        },
      };
    }, getTxOptions());
  });
}

export async function generateUniqueBookingReference(): Promise<string> {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `EDF-${datePart}-${randomPart}`;
}

export async function generateNextPatientCode(): Promise<string> {
  const count = await prisma.patient.count();
  return `EDF-PT-${(1001 + count).toString()}`;
}
