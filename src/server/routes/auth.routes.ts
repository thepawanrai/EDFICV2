import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import {
  clearAuthCookies,
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  getCookieOptions,
  hashPassword,
  logAudit,
  setAuthCookies,
  signSessionToken,
  verifyCsrfTokenValue,
  verifyPassword,
} from '../lib/security.ts';
import { AuthenticatedRequest, authenticateOptional, requireAuth } from '../middleware/auth.ts';
import { dispatchN8nEvent } from '../services/automation.ts';
import { generateNextPatientCode } from '../services/scheduling.ts';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  password: z.string().min(8).max(100),
});

router.get('/csrf', (req, res) => {
  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (typeof existing === 'string' && verifyCsrfTokenValue(existing)) {
    res.json({ csrfToken: existing });
    return;
  }
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCookieOptions(req, false));
  res.json({ csrfToken });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid email and password are required.' });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { patientProfile: true },
  });

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials or inactive account.' });
    return;
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    await logAudit({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'AUTH_LOGIN_FAILED',
      resourceType: 'User',
      resourceId: user.id,
      summary: `Failed login attempt for ${email}`,
      ipAddress: req.ip,
    });
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const sessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  };
  const csrfToken = setAuthCookies(res, sessionPayload, req);
  const sessionToken = signSessionToken(sessionPayload);

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'AUTH_LOGIN_SUCCESS',
    resourceType: 'User',
    resourceId: user.id,
    summary: `Signed in as ${user.role}`,
    ipAddress: req.ip,
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      patientId: user.patientProfile?.id ?? null,
      patientCode: user.patientProfile?.patientCode ?? null,
    },
    csrfToken,
    sessionToken,
  });
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Please provide valid full name, email, 10-digit phone, and password (min 8 chars).',
    });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const patientCode = await generateNextPatientCode();

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone.trim(),
        role: 'PATIENT',
        isActive: true,
      },
    });

    const regPhone = parsed.data.phone.trim();
    const existingGuestPatient = await tx.patient.findFirst({
      where: {
        userId: null,
        phone: regPhone,
        OR: [{ email: null }, { email }],
      },
    });

    const patient = existingGuestPatient
      ? await tx.patient.update({
          where: { id: existingGuestPatient.id },
          data: {
            userId: user.id,
            fullName: existingGuestPatient.fullName || user.fullName,
            email: existingGuestPatient.email || user.email,
            consentAccepted: true,
            consentTimestamp: existingGuestPatient.consentTimestamp ?? new Date(),
          },
        })
      : await tx.patient.create({
          data: {
            patientCode,
            userId: user.id,
            fullName: user.fullName,
            phone: parsed.data.phone.trim(),
            email: user.email,
            consentAccepted: true,
            consentTimestamp: new Date(),
          },
        });

    return { user, patient };
  });

  const regPayload = {
    userId: created.user.id,
    email: created.user.email,
    role: created.user.role,
    fullName: created.user.fullName,
  };
  const csrfToken = setAuthCookies(res, regPayload, req);
  const sessionToken = signSessionToken(regPayload);

  await logAudit({
    actorUserId: created.user.id,
    actorRole: 'PATIENT',
    action: 'PATIENT_REGISTERED',
    resourceType: 'Patient',
    resourceId: created.patient.id,
    summary: `New patient portal account registered (${created.patient.patientCode})`,
    ipAddress: req.ip,
  });

  await dispatchN8nEvent({
    eventId: `patient-reg-${created.patient.id}`,
    eventType: 'patient.registered',
    payload: {
      patientCode: created.patient.patientCode,
      registrationChannel: 'PATIENT_PORTAL',
      consentAccepted: created.patient.consentAccepted,
    },
  });

  res.status(201).json({
    user: {
      id: created.user.id,
      email: created.user.email,
      fullName: created.user.fullName,
      phone: created.user.phone,
      role: created.user.role,
      patientId: created.patient.id,
      patientCode: created.patient.patientCode,
    },
    csrfToken,
    sessionToken,
  });
});

router.post('/logout', authenticateOptional, async (req: AuthenticatedRequest, res) => {
  if (req.auth) {
    await logAudit({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: 'AUTH_LOGOUT',
      resourceType: 'User',
      resourceId: req.auth.userId,
      summary: `Signed out (${req.auth.role})`,
      ipAddress: req.ip,
    });
  }
  clearAuthCookies(res, req);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { patientProfile: true },
  });
  if (!user || !user.isActive) {
    clearAuthCookies(res, req);
    res.status(401).json({ error: 'Account unavailable.' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      patientId: user.patientProfile?.id ?? null,
      patientCode: user.patientProfile?.patientCode ?? null,
    },
  });
});

export default router;
