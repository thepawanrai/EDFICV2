# EDFIC Platform — Phase 6 Quality Assurance & Security Audit Report

**Institution:** EDFIC — EWA Diagnostic and Fetal Imaging Centre (*A Unit of EWA DERMA*)  
**Location:** Unit 10, Millennium Place, Sushant Golf City (Near Lulu Mall), Lucknow  
**Runtime Target:** Hostinger Express Node.js 22.x (`dist/server/server.js` serving `dist/client`)

---

## 1. Automated Verification Summary

| Verification Suite | Scope | Result |
| :--- | :--- | :--- |
| **`npm test` (Vitest)** | 5 test suites (`edfic.test.ts`, `phase3.test.ts`, `phase4.test.ts`, `phase5.test.ts`, `phase6.test.ts`) | **24 / 24 passed** |
| **`npm run typecheck`** | Full TypeScript verification (`tsc --noEmit`) | **Pass** |
| **`npm run lint`** | ESLint syntax & import checks | **Pass** |
| **`npm run build`** | Prisma Client + Vite client (`dist/client`) + ESBuild server (`dist/server/server.js`) | **Pass** |
| **Production Runtime Smoke Test** | `NODE_ENV=production DISABLE_DEV_SEED=true node dist/server/server.js` | **Pass** (All routes verified HTTP 200/401/404) |
| **`npm audit --audit-level=high`** | Dependency vulnerability scan | **0 runtime issues** (4 transitive dev/CLI-only issues in `prisma` tooling) |

---

## 2. Security Audit & Hardening Results

All authentication, access control, upload, storage, and integration boundaries were audited and tested in `tests/phase6.test.ts`:
- **Authentication & Secret Handling:** `bcryptjs` (cost 12) password hashing; JWT stored in `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookies. Hardened `src/server/lib/security.ts` and `src/server/middleware/auth.ts` so static development fallback secrets are never used when `NODE_ENV=production`.
- **Brute-Force Rate Limiting:** Added stricter `express-rate-limit` throttling (25 requests / 15 min in live environments) specifically on `/api/v1/auth/login` and `/api/v1/auth/register`.
- **CSRF & Timing-Safe Comparisons:** HMAC-SHA256 double-submit CSRF tokens and Hermes API keys verified using `crypto.timingSafeEqual`. Missing/mismatched CSRF tokens verified returning HTTP `403`.
- **XSS & SQL Injection:** Zero `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or raw SQL string concatenation across the codebase; all queries parameterized via Prisma Client.
- **Guest Account & Report Ownership Isolation:** Hardened `POST /api/v1/auth/register`, `GET /api/v1/patients/me/portal`, and `GET /api/v1/reports/:id/download` to prevent claiming or accessing unlinked guest patient records by email alone. Cross-patient report downloads verified blocked (`403`).
- **Private Storage & File Upload Security:** Magic-byte validation (`%PDF-`, PNG, JPEG) rejects spoofed uploads (`400`). `resolvePrivateFile` enforces strict `path.resolve` + `path.sep` directory containment and rejects `..` or path separators. Private report and payment evidence downloads emit `Cache-Control: no-store, private` and `X-Content-Type-Options: nosniff`.
- **Outbound SSRF Protection:** `validateOutboundUrl` enforces `https://` in production and blocks cloud metadata endpoints (`169.254.*`, `metadata.google.internal`), link-local, loopback, and private RFC1918 networks on both Admin settings save (`400`) and webhook/WhatsApp dispatch.

---

## 3. Healthcare Compliance & Public Website QA

- **Public Pricing & Ethics Check:** Inspected public routes (`/api/v1/public/services`, `/api/v1/public/services/:slug`, `/api/v1/hermes/services`) and public TSX pages—verified **zero fees, packages, discounts, star ratings, fabricated testimonials, or diagnostic guarantees** are exposed.
- **PCPNDT Compliance:** Verified statutory notice banners on `/fetal-imaging` and `/patient-consent`, mandatory consent checkbox on `/book`, and automated CMS content scanner (`src/server/services/compliance.ts`) blocking gender-prediction/sex-determination terms.
- **SEO & Technical Web Checks:**
  - Verified `<SeoHead>` renders unique `<title>`, `<meta name="description">`, `robots`, canonical links, OpenGraph/Twitter tags, and `MedicalClinic` JSON-LD across all 15+ public pages and dynamic service detail pages.
  - Verified `/robots.txt` (`200`, disallows `/staff`, `/portal`, `/login`, `/api/`) and dynamic `/sitemap.xml` (`200`, includes all public pages and published services).

---

## 4. Operational Workflows & Integrations QA

- **Appointments & Scheduling (`tests/phase3.test.ts`, `tests/phase6.test.ts`):** Weekday (`09:00–20:00`), Sunday (`10:00–14:00`), morning specialist window (`09:30–13:30`), full-day holidays, daily capacity caps, temporary slot holds, atomic concurrent booking mutex + transaction locking, duplicate booking protection, reschedule/cancel flows, and automatic expiry of stale `PENDING_ADVANCE` holds (`expireStaleReservations`).
- **UPI Payments (`tests/phase3.test.ts`, `tests/phase4.test.ts`):** Verified screenshot/UTR submission stays in `SUBMITTED` (never auto-confirmed), manual Reception/Accounts verification generates `RCPT-...` and confirms appointment, balance calculation, rejections, and Accounts refunds.
- **CRM, Patient Merge & Report Vault (`tests/phase4.test.ts`):** Verified CRM pipeline stages, follow-up tasks, duplicate detection, atomic patient merging, Marketing role block (`403`), Reception masking of `clinicalNotes`, and revision-tracked PDF publishing with `ReportDownloadLog`.
- **n8n, WhatsApp & Hermes (`tests/phase5.test.ts`):** Verified end-to-end against local in-process mock HTTP webhook receivers: idempotent `eventId` delivery, HMAC-SHA256 signatures, failure retry recovery, WhatsApp webhook verification (`X-Hub-Signature-256`), PHI blocking on WhatsApp messages, and Hermes `GET`-only non-PHI summary isolation (`401`/`403` enforcement).

> **Important External Environment Disclosure:** Automated verification ran against local SQLite (`prisma/schema.prisma`) and local in-process webhook mock servers. Live external n8n cloud instances, production WhatsApp Business Cloud credentials, real bank UPI VPA settlement, and Hostinger MySQL (`prisma/schema.mysql.prisma`) must be connected and smoke-tested using production `.env` credentials during Hostinger deployment cutover.

---

## 5. Hostinger Production Server Smoke Test (`dist/server/server.js`)

Executed against compiled bundle with `NODE_ENV=production DISABLE_DEV_SEED=true`:
- `GET /health` → `200` (`{"status":"ok","service":"edfic-healthcare-platform",...}`)
- `GET /`, `/book`, `/staff/admin`, `/portal` → `200` (serves `dist/client/index.html` SPA cleanly)
- `GET /robots.txt`, `/sitemap.xml`, `/api/v1/public/services` → `200`
- `GET /api/v1/hermes/summary/operations` → `401` without key, `200` with valid `X-Hermes-Api-Key`
- `GET /api/v1/nonexistent` → `404` JSON error without stack trace
