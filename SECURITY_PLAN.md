# EDFIC Platform — Security & Medical Compliance Plan

## 1. Application Security Controls

| Control Domain | Implementation |
| :--- | :--- |
| **Password Hashing** | `bcryptjs` with cost factor 12; plaintext passwords are never stored or logged. |
| **Session & Secret Management** | Signed JWT stored in `HttpOnly`, `SameSite=Lax` cookie (`edfic_session`), `Secure` enabled in production. Static dev fallback secrets are blocked when `NODE_ENV=production` (ephemeral runtime keys + startup warning if unset). |
| **CSRF Protection** | HMAC-SHA256 signed double-submit token (`edfic_csrf` cookie + `X-CSRF-Token` header) verified with `crypto.timingSafeEqual` on all state-changing `/api/v1/*` routes. |
| **XSS & Security Headers** | `helmet` middleware configured on Express; React JSX escaping prevents reflected DOM XSS; private downloads set `Cache-Control: no-store, private` and `X-Content-Type-Options: nosniff`. |
| **SQL Injection Prevention** | All database access uses Prisma Client parameterized queries; no raw concatenated SQL strings. |
| **Rate Limiting** | `express-rate-limit` enforces 25 req/15m brute-force protection on `/api/v1/auth/login` & `/register`, 120 req/15m on general `/api/v1/auth`, and 60 req/10m on `/api/v1/public/inquiries`. |
| **SSRF Protection** | `validateOutboundUrl` enforces HTTPS in production and blocks cloud metadata (`169.254.*`, `metadata.google.internal`), link-local, loopback, and RFC1918 private IPs on Admin settings save and webhook/WhatsApp dispatch. |
| **File Upload Validation** | `multer` memory buffer size caps (5 MB evidence, 15 MB PDF) + server-side magic-byte inspection (`%PDF-`, PNG, JPEG headers). |
| **Private File Storage** | Diagnostic PDFs (`/storage/reports`) and payment screenshots (`/storage/evidence`) live outside static `dist/client` and enforce `path.resolve` + `path.sep` containment with traversal rejection. |
| **RBAC & Ownership Isolation** | `requireAuth` + `requireRole(...)` on every protected endpoint; Marketing staff blocked from patient/clinical records; clinical notes masked for Reception/Accounts; guest patient registration & report downloads enforce strict `userId` ownership (never claimable by email alone). |
| **Hermes Isolation** | Dedicated `X-Hermes-Api-Key` (verified via `crypto.timingSafeEqual`; fails closed with HTTP `503` in production if unconfigured), `GET`-only enforcement, aggregated counts only, zero PII or report access. |
| **Audit Logging** | Immutable `AuditLog` entries for authentication, appointments, payment verification/rejection, report upload/publish/download, CMS publishing, user changes, and Hermes queries. |
| **Dependency Hygiene** | `npm audit --audit-level=high` reports 0 vulnerabilities in runtime production dependencies; 4 transitive findings exist strictly inside CLI Prisma dev tooling (`@prisma/config`), isolated from `dist/server/server.js`. |

---

## 2. Medical Ethics, NMC & PCPNDT Compliance Checklist

- [x] **EWA DERMA Relationship Clarity**: EDFIC is explicitly presented across headers/eyebrows, About page, and footer as *"A Unit of EWA DERMA"*.
- [x] **Absolute Public Website Pricing Rule**: Diagnostic fees, package prices, discounts, and promotional rates are stripped from all public API payloads and never rendered on public pages.
- [x] **PCPNDT Act & Rules Compliance**:
  - Dedicated Patient Consent & PCPNDT Notice page (`/patient-consent`) and Fetal Imaging statutory banner.
  - Mandatory consent & PCPNDT acknowledgment checkbox during appointment booking.
  - Automated CMS scanner (`src/server/services/compliance.ts`) blocks content containing sex-determination or gender-prediction phrasing.
- [x] **NMC Ethics Compliance**:
  - No fabricated testimonials, 5-star reviews, superiority claims, or diagnostic guarantees.
  - No fabricated clinic photography, equipment specs, or unverified medical registration numbers.
- [x] **CMS Approval Workflow**: `DRAFT → MEDICAL_REVIEW → COMPLIANCE_REVIEW → FINAL_APPROVED → PUBLISHED` enforced server-side before public rendering.
- [x] **Diagnostic Report Confidentiality**:
  - Reports are never attached to WhatsApp messages or exposed via public URLs.
  - No AI/LLM interpretation is applied to diagnostic reports.
- [ ] **Pending EDFIC Sign-Off Before Launch**: See `MEDICAL_CONTENT_APPROVAL_CHECKLIST.md` for final review by EDFIC's authorized medical and compliance representatives, verified contact details, and `DISABLE_DEV_SEED="true"`.

---

## 3. Backup & Data Retention Guidelines

1. **Database Backups**: Schedule daily automated `mysqldump` backups on Hostinger with encrypted off-server retention for statutory medical record periods.
2. **Private Storage Backups**: Back up `/storage/reports` and `/storage/evidence` alongside database snapshots so file pointers in `DiagnosticReport.storedFilePath` remain consistent.
3. **Slot Hold Cleanup**: Expired `SlotHold` rows and stale unpaid `PENDING_ADVANCE` reservations are automatically released by `expireStaleReservations()`.
