import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE_NAME, SessionPayload, verifySessionToken } from '../lib/security.ts';

export interface AuthenticatedRequest extends Request {
  auth?: SessionPayload;
}

function extractSessionToken(req: Request): string | null {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.length > 0) return bearer;
  }
  return null;
}

export function authenticateOptional(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = extractSessionToken(req);
  if (token) {
    const decoded = verifySessionToken(token);
    if (decoded) {
      req.auth = decoded;
    }
  }
  next();
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const decoded = verifySessionToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  req.auth = decoded;
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({
        error: 'Access denied: your role does not permit this operation.',
      });
      return;
    }
    next();
  };
}

export function requireHermesKey(req: Request, res: Response, next: NextFunction): void {
  const rawConfigured = process.env.HERMES_API_KEY?.trim();
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && (!rawConfigured || rawConfigured.startsWith('CHANGE_ME_'))) {
    res.status(503).json({ error: 'Hermes Agent integration credential is not configured.' });
    return;
  }
  const configuredKey = rawConfigured || 'edfic-hermes-dev-key-change-in-production';
  const providedKey = req.headers['x-hermes-api-key'];
  if (typeof providedKey !== 'string') {
    res.status(401).json({ error: 'Unauthorized Hermes Agent credential.' });
    return;
  }
  const bufA = Buffer.from(providedKey, 'utf8');
  const bufB = Buffer.from(configuredKey, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    res.status(401).json({ error: 'Unauthorized Hermes Agent credential.' });
    return;
  }
  next();
}
