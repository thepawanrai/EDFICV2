import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma.ts';

function resolveRuntimeSecret(envName: string, devFallback: string): string {
  const configured = process.env[envName]?.trim();
  if (configured && !configured.startsWith('CHANGE_ME_')) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      `[SECURITY WARNING] ${envName} is unset or placeholder in production; using ephemeral runtime key.`
    );
    return crypto.randomBytes(32).toString('hex');
  }
  return devFallback;
}

const JWT_SECRET = resolveRuntimeSecret(
  'JWT_SECRET',
  'edfic-dev-jwt-secret-change-in-production-32chars'
);
const CSRF_SECRET = resolveRuntimeSecret(
  'CSRF_SECRET',
  'edfic-dev-csrf-secret-change-in-production-32chars'
);

export const AUTH_COOKIE_NAME = 'edfic_session';
export const CSRF_COOKIE_NAME = 'edfic_csrf';

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  fullName: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

function isHttpsRequest(req?: Request): boolean {
  if (!req) return process.env.NODE_ENV === 'production';
  if (req.secure) return true;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (forwardedProto === 'https') return true;
  const origin = String(req.headers.origin || '');
  if (origin.startsWith('https://')) return true;
  const referer = String(req.headers.referer || '');
  if (referer.startsWith('https://')) return true;
  const xfh = String(req.headers['x-forwarded-host'] || '');
  if (xfh.endsWith('.run.app')) return true;
  return false;
}

export function getCookieOptions(req: Request | undefined, httpOnly: boolean) {
  const isHttps = isHttpsRequest(req);
  return {
    httpOnly,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  };
}

export function setAuthCookies(res: Response, payload: SessionPayload, req?: Request): string {
  const token = signSessionToken(payload);
  res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions(req, true));
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCookieOptions(req, false));
  return csrfToken;
}

export function clearAuthCookies(res: Response, req?: Request): void {
  const opts = getCookieOptions(req, true);
  res.clearCookie(AUTH_COOKIE_NAME, {
    path: '/',
    sameSite: opts.sameSite,
    secure: opts.secure,
  });
}

export function generateCsrfToken(): string {
  const nonce = crypto.randomBytes(24).toString('hex');
  const sig = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');
  return `${nonce}.${sig}`;
}

export function verifyCsrfTokenValue(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [nonce, sig] = parts;
  if (!nonce || !sig) return false;
  const expected = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isSameOriginBrowserRequest(req: Request): boolean {
  const originHeader = req.headers.origin;
  if (typeof originHeader !== 'string') return false;
  let originHost = '';
  try {
    originHost = new URL(originHeader).host.toLowerCase();
  } catch {
    return false;
  }
  const rawXfh = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const rawHost = String(req.get('host') || '').trim().toLowerCase();
  return Boolean(
    (rawXfh && originHost === rawXfh) || (rawHost && originHost === rawHost)
  );
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    next();
    return;
  }
  // Hermes Agent and signed n8n/WhatsApp integration webhooks use HMAC / scoped API headers
  if (req.path.startsWith('/hermes') || req.path.startsWith('/integrations')) {
    next();
    return;
  }
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];
  if (
    typeof cookieToken === 'string' &&
    typeof headerToken === 'string' &&
    timingSafeEqualString(cookieToken, headerToken) &&
    verifyCsrfTokenValue(cookieToken)
  ) {
    next();
    return;
  }
  // In embedded HTTPS iframes where third-party cookies may be withheld by the browser,
  // allow same-origin fetch requests presenting a valid server-signed HMAC CSRF token.
  if (
    !cookieToken &&
    typeof headerToken === 'string' &&
    verifyCsrfTokenValue(headerToken) &&
    isSameOriginBrowserRequest(req)
  ) {
    next();
    return;
  }
  res.status(403).json({
    error: 'Invalid or missing CSRF verification token. Please refresh and try again.',
  });
}

export async function logAudit(params: {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId ?? null,
        actorRole: params.actorRole ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        summary: params.summary,
        metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}
