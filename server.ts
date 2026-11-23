import 'dotenv/config';
import fs from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import type { ViteDevServer } from 'vite';

import { createApp } from './server/app.ts';
import { prisma } from './server/lib/prisma.ts';
import { ensureSeeded } from './server/seed.ts';

let dbInitError: string | null = null;
let activeStartPromise: Promise<Server> | null = null;

function getCliArg(flagName: string): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === flagName && args[i + 1]) {
      return args[i + 1];
    }
    if (arg.startsWith(`${flagName}=`)) {
      return arg.slice(flagName.length + 1);
    }
  }
  return undefined;
}

export async function createEdficApp() {
  return createApp({
    isDev: false,
    skipSeed: false,
    getDbInitError: () => dbInitError,
  });
}

export function startServer(): Promise<Server> {
  if (activeStartPromise) {
    return activeStartPromise;
  }

  activeStartPromise = (async () => {
    const distIndexPath = path.resolve(process.cwd(), 'dist', 'index.html');
    const hasBuiltDist = fs.existsSync(distIndexPath);
    const isDirectTsxEntry =
      Boolean(process.argv[1]?.endsWith('server.ts')) &&
      process.env.NODE_ENV !== 'production';

    const isProduction =
      process.env.NODE_ENV === 'production' || (!isDirectTsxEntry && hasBuiltDist);

    let viteServer: ViteDevServer | undefined;
    let isDev = !isProduction;

    if (isDev) {
      try {
        const { createServer: createViteServer } = await import('vite');
        viteServer = await createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        });
      } catch (err) {
        console.warn(
          'Vite dev server unavailable; serving built dist/ bundle instead:',
          err instanceof Error ? err.message : err
        );
        isDev = false;
      }
    }

    const app = await createApp({
      isDev,
      viteServer,
      skipSeed: true,
      getDbInitError: () => dbInitError,
    });

    const rawPort = getCliArg('--port') || process.env.PORT?.trim() || '3000';
    const host = getCliArg('--host') || process.env.HOST?.trim() || '0.0.0.0';
    const numericPort = Number(rawPort);
    const isSocketPath = Number.isNaN(numericPort) || numericPort <= 0;
    const listenTarget: string | number = isSocketPath ? rawPort : numericPort;

    const onListen = () => {
      const targetLabel = isSocketPath ? `socket ${listenTarget}` : `http://${host}:${listenTarget}`;
      console.log(
        `EDFIC Platform listening on ${targetLabel} (${process.env.NODE_ENV || (isDev ? 'development' : 'production')})`
      );
    };

    const server = isSocketPath
      ? app.listen(listenTarget as string, onListen)
      : app.listen(listenTarget as number, host, onListen);

    server.on('error', (err) => {
      console.error('EDFIC HTTP server error:', err);
    });

    // Run schema verification & baseline seeding asynchronously after HTTP socket binds
    void ensureSeeded()
      .then(() => {
        dbInitError = null;
        console.log('EDFIC database schema & baseline data ready.');
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        dbInitError = message;
        console.error('EDFIC database initialization warning (HTTP server stays active):', message);
        if ((process.env.DATABASE_URL || '').startsWith('mysql://') && message.includes('protocol')) {
          console.error(
            'Hint: DATABASE_URL uses mysql:// while prisma/schema.prisma uses sqlite. Copy prisma/schema.mysql.prisma over prisma/schema.prisma and run npx prisma generate && npx prisma db push.'
          );
        }
      });

    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down EDFIC server...`);
      const forceExitTimer = setTimeout(() => {
        console.error('Forced shutdown after 10s timeout.');
        process.exit(1);
      }, 10000);
      forceExitTimer.unref();

      try {
        if (viteServer) {
          await viteServer.close();
        }
        server.close(async () => {
          await prisma.$disconnect();
          process.exit(0);
        });
      } catch (err) {
        console.error('Error during graceful shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    return server;
  })().catch((err) => {
    activeStartPromise = null;
    console.error('Failed to start EDFIC server:', err);
    throw err;
  });

  return activeStartPromise;
}

const isTestEnv = Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test';
if (!isTestEnv) {
  startServer().catch(() => {
    process.exit(1);
  });
}
