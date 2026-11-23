import './lib/expressAsyncPatch.ts';
import express, { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import type { ViteDevServer } from 'vite';

import { checkDatabaseHealth, prisma } from './lib/prisma.ts';
import { csrfProtection } from './lib/security.ts';
import { ensureStorageDirectories } from './lib/storage.ts';
import { requestLogger } from './middleware/requestLogger.ts';
import { ensureSeeded } from './seed.ts';

import authRoutes from './routes/auth.routes.ts';
import publicRoutes from './routes/public.routes.ts';
import appointmentRoutes from './routes/appointments.routes.ts';
import paymentRoutes from './routes/payments.routes.ts';
import patientRoutes from './routes/patients.routes.ts';
import reportRoutes from './routes/reports.routes.ts';
import crmRoutes from './routes/crm.routes.ts';
import cmsRoutes from './routes/cms.routes.ts';
import adminRoutes from './routes/admin.routes.ts';
import hermesRoutes from './routes/hermes.routes.ts';
import integrationRoutes from './routes/integrations.routes.ts';

export interface CreateAppOptions {
  isDev?: boolean;
  viteServer?: ViteDevServer;
  skipSeed?: boolean;
  getDbInitError?: () => string | null;
}

export async function createApp(options: CreateAppOptions = {}): Promise<express.Express> {
  ensureStorageDirectories();
  if (!options.skipSeed) {
    await ensureSeeded();
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(requestLogger);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test',
    message: { error: 'Too many authentication attempts. Please try again shortly.' },
  });

  const loginRegisterLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test',
    message: { error: 'Too many login or registration attempts. Please try again in 15 minutes.' },
  });

  const publicWriteLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Request limit reached. Please wait a few minutes.' },
  });

  // Health check endpoints for Hostinger & container probes
  const handleHealth = async (_req: Request, res: Response) => {
    const dbHealthy = await checkDatabaseHealth();
    const dbInitError = options.getDbInitError?.() || null;
    res.status(200).json({
      status: dbHealthy ? 'ok' : 'degraded',
      dbHealthy,
      service: 'edfic-healthcare-platform',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      ...(dbInitError
        ? { details: 'Database initialization pending or misconfigured; verify DATABASE_URL and Prisma schema.' }
        : {}),
    });
  };

  app.get('/health', handleHealth);
  app.get('/api/health', handleHealth);

  // Search Engine Optimization: robots.txt & dynamic sitemap.xml
  app.get('/robots.txt', (req, res) => {
    const baseUrl = (
      process.env.APP_URL || `${req.protocol}://${req.get('host') || 'localhost:3000'}`
    ).replace(/\/+$/, '');
    res.type('text/plain').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /staff',
        'Disallow: /portal',
        'Disallow: /login',
        'Disallow: /api/',
        `Sitemap: ${baseUrl}/sitemap.xml`,
      ].join('\n')
    );
  });

  app.get('/sitemap.xml', async (req, res) => {
    const baseUrl = (
      process.env.APP_URL || `${req.protocol}://${req.get('host') || 'localhost:3000'}`
    ).replace(/\/+$/, '');

    const staticPaths = [
      { path: '/', priority: '1.0', changefreq: 'weekly' },
      { path: '/about', priority: '0.8', changefreq: 'monthly' },
      { path: '/fetal-imaging', priority: '0.9', changefreq: 'weekly' },
      { path: '/general-ultrasound', priority: '0.9', changefreq: 'weekly' },
      { path: '/doppler-studies', priority: '0.9', changefreq: 'weekly' },
      { path: '/services', priority: '0.9', changefreq: 'weekly' },
      { path: '/technology', priority: '0.7', changefreq: 'monthly' },
      { path: '/doctor', priority: '0.8', changefreq: 'monthly' },
      { path: '/patient-info', priority: '0.8', changefreq: 'monthly' },
      { path: '/appointment-info', priority: '0.8', changefreq: 'monthly' },
      { path: '/book', priority: '0.9', changefreq: 'daily' },
      { path: '/faqs', priority: '0.7', changefreq: 'monthly' },
      { path: '/contact', priority: '0.8', changefreq: 'monthly' },
      { path: '/privacy-policy', priority: '0.4', changefreq: 'yearly' },
      { path: '/terms-of-use', priority: '0.4', changefreq: 'yearly' },
      { path: '/disclaimer', priority: '0.4', changefreq: 'yearly' },
      { path: '/patient-consent', priority: '0.4', changefreq: 'yearly' },
    ];

    let services: Array<{ slug: string; updatedAt: Date }> = [];
    try {
      services = await prisma.diagnosticService.findMany({
        where: {
          isVisiblePublic: true,
          approvalStatus: 'PUBLISHED',
          category: { isVisible: true },
        },
        select: { slug: true, updatedAt: true },
        orderBy: { name: 'asc' },
      });
    } catch {
      services = [];
    }

    const urlsXml = [
      ...staticPaths.map(
        (u) =>
          `  <url><loc>${baseUrl}${u.path}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
      ),
      ...services.map(
        (s) =>
          `  <url><loc>${baseUrl}/services/${s.slug}</loc><lastmod>${s.updatedAt.toISOString().slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
      ),
    ].join('\n');

    res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>`
      );
  });

  // Versioned API routes under /api/v1/
  app.use('/api/v1', csrfProtection);
  app.use('/api/v1/auth/login', loginRegisterLimiter);
  app.use('/api/v1/auth/register', loginRegisterLimiter);
  app.use('/api/v1/auth', authLimiter, authRoutes);
  app.use('/api/v1/public/inquiries', publicWriteLimiter);
  app.use('/api/v1/public/chat', publicWriteLimiter);
  app.use('/api/v1/public', publicRoutes);
  app.use('/api/v1/appointments', appointmentRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/patients', patientRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/crm', crmRoutes);
  app.use('/api/v1/cms', cmsRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/hermes', hermesRoutes);
  app.use('/api/v1/integrations', integrationRoutes);

  // Explicit JSON 404 for unknown API paths (never fall through to HTML)
  app.use('/api', function apiNotFoundHandler(_req: Request, res: Response) {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Static & SPA serving (production) or Vite middleware (development)
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

  if (options.isDev && options.viteServer) {
    app.use(options.viteServer.middlewares);
  } else if (!isTestEnv) {
    const distPath = path.resolve(process.cwd(), 'dist');
    const publicPath = path.resolve(process.cwd(), 'public');
    const indexHtmlPath = path.join(distPath, 'index.html');

    if (fs.existsSync(distPath)) {
      app.use(
        express.static(distPath, {
          index: false,
          maxAge: '1d',
          setHeaders(res, filePath) {
            if (path.basename(filePath) === 'index.html') {
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
          },
        })
      );
    }

    if (fs.existsSync(publicPath)) {
      app.use(express.static(publicPath, { index: false, maxAge: '1d' }));
    }

    app.get('*', (_req: Request, res: Response) => {
      if (fs.existsSync(indexHtmlPath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(indexHtmlPath);
      } else {
        res
          .status(503)
          .type('text/plain')
          .send('EDFIC frontend build not found. Run "npm run build" and restart the server.');
      }
    });
  }

  // Centralized error handler (hides stack traces & internals in production)
  app.use(function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) {
    console.error('Unhandled server error:', err);
    if (res.headersSent) return;
    const message =
      process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred.'
        : err instanceof Error
          ? err.message
          : 'Unexpected error';
    res.status(500).json({ error: message });
  });

  return app;
}
