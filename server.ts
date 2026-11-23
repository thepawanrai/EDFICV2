import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

import { checkDatabaseHealth, prisma } from './src/server/lib/prisma.ts';
import { csrfProtection } from './src/server/lib/security.ts';
import { ensureStorageDirectories } from './src/server/lib/storage.ts';
import { requestLogger } from './src/server/middleware/requestLogger.ts';
import { ensureSeeded } from './src/server/seed.ts';

import authRoutes from './src/server/routes/auth.routes.ts';
import publicRoutes from './src/server/routes/public.routes.ts';
import appointmentRoutes from './src/server/routes/appointments.routes.ts';
import paymentRoutes from './src/server/routes/payments.routes.ts';
import patientRoutes from './src/server/routes/patients.routes.ts';
import reportRoutes from './src/server/routes/reports.routes.ts';
import crmRoutes from './src/server/routes/crm.routes.ts';
import cmsRoutes from './src/server/routes/cms.routes.ts';
import adminRoutes from './src/server/routes/admin.routes.ts';
import hermesRoutes from './src/server/routes/hermes.routes.ts';
import integrationRoutes from './src/server/routes/integrations.routes.ts';

export async function createEdficApp() {
  ensureStorageDirectories();
  await ensureSeeded();

  const app = express();
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
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
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

  // Health endpoint for Hostinger / container monitoring
  app.get('/health', async (_req, res) => {
    const dbHealthy = await checkDatabaseHealth();
    if (dbHealthy) {
      res.json({
        status: 'ok',
        service: 'edfic-healthcare-platform',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
      });
    } else {
      res.status(503).json({ status: 'degraded', error: 'Database unavailable' });
    }
  });

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
      { path: '/patient-consent', priority: '0.4', changefreq: 'yearly' },
    ];

    const services = await prisma.diagnosticService.findMany({
      where: {
        isVisiblePublic: true,
        approvalStatus: 'PUBLISHED',
        category: { isVisible: true },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { name: 'asc' },
    });

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

  // Explicit 404 for unknown API paths
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled API error:', err);
    const message =
      process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred.'
        : err instanceof Error
          ? err.message
          : 'Unexpected error';
    res.status(500).json({ error: message });
  });

  // Serve compiled dist/client in production, or Vite middleware in development
  const clientDistDir = path.resolve(process.cwd(), 'dist/client');
  const hasBuiltClient = fs.existsSync(path.join(clientDistDir, 'index.html'));
  const isDevOrTest =
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.VITEST);

  if (process.env.NODE_ENV === 'production' || (hasBuiltClient && !isDevOrTest)) {
    if (fs.existsSync(clientDistDir)) {
      app.use(
        express.static(clientDistDir, {
          index: false,
          maxAge: '1d',
        })
      );
      app.get('*', (_req, res) => {
        res.sendFile(path.join(clientDistDir, 'index.html'));
      });
    }
  } else if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  return app;
}

const isEntrypoint =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isEntrypoint) {
  const port = Number(process.env.PORT) || 3000;
  const host = '0.0.0.0';

  createEdficApp()
    .then((app) => {
      const server = app.listen(port, host, () => {
        console.log(`EDFIC Platform running at http://${host}:${port} (${process.env.NODE_ENV || 'development'})`);
      });

      const shutdown = async (signal: string) => {
        console.log(`Received ${signal}, shutting down EDFIC server...`);
        server.close(async () => {
          await prisma.$disconnect();
          process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref();
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    })
    .catch((err) => {
      console.error('Failed to start EDFIC server:', err);
      process.exit(1);
    });
}
