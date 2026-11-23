# EDFIC Platform — Hostinger Node.js Deployment Guide

## 1. Hostinger Node.js Web App Preset Configuration

| Setting | Value |
| :--- | :--- |
| **Framework Preset** | Express |
| **Node Version** | 22.x |
| **GitHub Branch** | `main` |
| **Root Directory** | `./` |
| **Package Manager** | `npm` |
| **Install Command** | `npm ci` (or `npm install`) |
| **Build Command** | `npm run build` |
| **Start Command** | `npm start` (`node server.js`) |
| **Main Entry File** | `server.js` (generated from `server.ts` + `server/app.ts` during `npm run build`) |
| **Frontend Static Output** | `dist` |
| **Health Endpoint** | `/health` and `/api/health` |

> **ZIP Upload Note**: If uploading a `.zip` instead of importing from GitHub, compress the **contents** of the project folder so `package.json`, `package-lock.json`, and `server.js` sit directly at the root of the ZIP (not nested inside an outer folder), and exclude `node_modules/`, `.env`, and `prisma/dev.db*`.

---

## 2. Switching Prisma to Production MySQL

The repository includes `prisma/schema.mysql.prisma` specifically for Hostinger MySQL:

1. Before pushing your production branch (or as part of your release prep):
   ```bash
   cp prisma/schema.mysql.prisma prisma/schema.prisma
   ```
2. Provision a MySQL database in Hostinger hPanel and configure `DATABASE_URL`:
   ```env
   DATABASE_URL="mysql://DB_USER:DB_PASSWORD@HOST:3306/DB_NAME"
   ```
3. Push the schema to MySQL:
   ```bash
   npx prisma db push
   ```
4. Seed the initial service catalogue and baseline CMS pages (with dev test users disabled):
   ```bash
   DISABLE_DEV_SEED="true" npm run db:seed
   ```
   *(Create your production `SUPER_ADMIN` user using a secure password or via one-time provisioning script.)*

---

## 3. Required Production Environment Variables

Configure these in Hostinger Node.js Web App environment variables (never commit `.env` to Git):

- `NODE_ENV="production"`
- `PORT` (automatically injected by Hostinger; `server.ts` binds to `0.0.0.0` on `Number(process.env.PORT) || 3000`)
- `APP_URL="https://your-edfic-domain.com"`
- `DATABASE_URL="mysql://..."`
- `JWT_SECRET` (random 64-char hex string)
- `CSRF_SECRET` (random 64-char hex string)
- `HERMES_API_KEY` (random 48-char key)
- `DISABLE_DEV_SEED="true"`
- Optional integrations: `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `WHATSAPP_PROVIDER`, `WHATSAPP_API_URL`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`

---

## 4. Build & Runtime Behavior

1. `npm run build` executes:
   - `prisma generate`
   - `vite build` → outputs React SPA to `dist/`
   - `esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=server.js`
2. `npm start` runs `node server.js`:
   - No Vite dev server is started or required in production.
   - Express serves `dist/` static assets and routes all non-API SPA requests to `dist/index.html`.
   - `/health` and `/api/health` return JSON status, uptime, timestamp, and environment.
   - `SIGINT` and `SIGTERM` trigger graceful HTTP server closure and `prisma.$disconnect()`.

---

## 5. Persistent Storage Consideration

Ensure the `/storage/reports` and `/storage/evidence` directories reside on persistent disk storage outside `dist/` and are included in regular server backups.
