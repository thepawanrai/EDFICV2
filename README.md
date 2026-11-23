# EDFIC — EWA Diagnostic & Fetal Imaging Centre Platform

Full-stack healthcare platform (**Express + Prisma + React + Vite**) ready for deployment as a **Node.js Web App** on **Hostinger Cloud Startup Hosting**.

---

## 1. Hostinger Deployment Settings

Configure these exact settings in **Hostinger hPanel -> Websites -> Node.js Web App**:

| Setting | Value |
| :--- | :--- |
| **Framework preset** | `Express` |
| **Node.js version** | `22.x` |
| **Application type** | Server-side Node.js web application (Express serves `/api/v1/*` and the compiled Vite SPA from `dist/`) |
| **Root directory** | `./` (or `/`, the folder containing `package.json` and `server.js`) |
| **Package manager** | `npm` |
| **Install command** | `npm install` (or `npm ci`) |
| **Build command** | `npm run build` |
| **Output directory** | `dist` *(served automatically by Express via `server.js`)* |
| **Entry file** | `server.js` |
| **Start command** | `npm start` (`node server.js`) |
| **Health check path** | `/health` (and `/api/health`) |

> **Note:** `npm run build` compiles the React frontend into `dist/` and bundles `server.ts` + `server/app.ts` into root `server.js` (ESM, external `node_modules`). At runtime, `server.js` binds to `process.env.HOST || '0.0.0.0'` on `process.env.PORT || 3000` (also supporting LiteSpeed Unix sockets).

---

## 2. Production Environment Variables

Add these environment variables manually inside **Hostinger hPanel -> Node.js Web App -> Environment Variables** (never commit a `.env` file):

### Required in Production
- `NODE_ENV` = `production`
- `APP_URL` = `https://your-domain.com` (your live Hostinger domain, used for SEO canonicals, `robots.txt`, and `sitemap.xml`)
- `DATABASE_URL` = `mysql://DB_USER:DB_PASSWORD@HOST:3306/DB_NAME` *(or `file:./dev.db` for single-node SQLite testing)*
- `JWT_SECRET` = strong random string (at least 32–64 characters)
- `CSRF_SECRET` = strong random string (at least 32–64 characters)
- `DISABLE_DEV_SEED` = `true`

### Optional Integrations
- `HERMES_API_KEY` — API key for restricted automation endpoints
- `VITE_GOOGLE_MAPS_API_KEY` / `GOOGLE_MAPS_API_KEY` — Google Maps Platform key (HTTP-referrer restricted)
- `GEMINI_API_KEY` — server-side Gemini API key (if AI endpoints are enabled)
- `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `N8N_API_KEY` — n8n automation webhook settings
- `WHATSAPP_PROVIDER`, `WHATSAPP_API_URL`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_SECRET`

---

## 3. Production Database Setup (Hostinger MySQL)

1. Switch Prisma to the included MySQL schema before building/deploying for Hostinger MySQL:
   ```bash
   cp prisma/schema.mysql.prisma prisma/schema.prisma
   ```
2. Push schema & seed baseline services/CMS data:
   ```bash
   npx prisma generate
   npx prisma db push
   DISABLE_DEV_SEED="true" npm run db:seed
   ```

---

## 4. ZIP Upload Packaging Guide

If deploying by uploading a `.zip` file instead of GitHub:

- **Important:** Compress the **files inside** the project folder so `package.json`, `package-lock.json`, and `server.js` are at the **root** of the `.zip` archive (not nested inside an outer parent directory).
- **Include:** `package.json`, `package-lock.json`, `server.js`, `server.ts`, `index.html`, `tsconfig.json`, `vite.config.ts`, `.env.example`, `README.md`, `server/`, `src/`, `public/`, `prisma/schema.prisma`, `prisma/schema.mysql.prisma`, `prisma/migrations/`.
- **Exclude:** `node_modules/`, `dist/`, `.env` / `.env.*` (except `.env.example`), `bun.lock`, `prisma/dev.db*`, `storage/`, `.aistudio/`, `.git/`.
