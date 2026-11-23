# EDFIC Platform — System & Application Architecture

**Brand:** EDFIC (EWA Diagnostic and Fetal Imaging Centre) — *A Unit of EWA DERMA*  
**Location:** Unit 10, Millennium Place, Sushant Golf City (Near Lulu Mall), Lucknow, Uttar Pradesh, India  
**Positioning:** *"Advanced Fetal Imaging & Diagnostic Services in Lucknow."*

---

## 1. Architectural Pattern: Modular Monolith

EDFIC uses a single, cohesive **modular monolithic full-stack architecture** running on **Node.js 22.x**:

- **Frontend**: React 19 + TypeScript + Vite SPA, Tailwind CSS, shadcn-style UI primitives, React Router DOM, React Hook Form + Zod, TanStack Query, FullCalendar, Recharts, and `qrcode.react`.
- **Backend**: Express.js + TypeScript exposing versioned REST endpoints under `/api/v1/*` and a health check at `/health`.
- **Database**: Prisma ORM targeting MySQL in Hostinger production (`prisma/schema.mysql.prisma`) and SQLite (`prisma/schema.prisma`) in isolated local/container development.
- **Private Binary Storage**: Local filesystem directories outside public web roots (`/storage/reports` and `/storage/evidence`) streamed exclusively via authenticated, role-checked Express handlers.

```text
[ Browser / Patient / Staff / Hermes ]
                 │
                 ▼ HTTPS (Hostinger Proxy -> 0.0.0.0:$PORT)
┌─────────────────────────────────────────────────────────────┐
│ Express.js 4.x Monolith (dist/server/server.js)             │
│  ├── Helmet, Cookie-Parser, Rate Limiters, CSRF Middleware  │
│  ├── GET  /health                                           │
│  ├── /api/v1/auth          (Session, JWT Cookie, Register)  │
│  ├── /api/v1/public        (Clinic, Zero-Price Catalogue)   │
│  ├── /api/v1/appointments  (Slots, Holds, Tx Booking)       │
│  ├── /api/v1/payments      (UTR, Evidence, Manual Verify)   │
│  ├── /api/v1/patients      (Portal & Clinical Records)      │
│  ├── /api/v1/reports       (Private PDF Vault & Download)   │
│  ├── /api/v1/crm           (Leads, Tasks, Conversion)       │
│  ├── /api/v1/cms           (Compliance Workflow & Services) │
│  ├── /api/v1/admin         (Settings, RBAC, Audit, Stats)   │
│  ├── /api/v1/hermes        (Read-Only Key-Auth Summaries)   │
│  └── Static Frontend (dist/client) + SPA Fallback           │
└──────────────┬───────────────────────────┬──────────────────┘
               │                           │
               ▼                           ▼
     [ Prisma ORM -> MySQL ]     [ Private /storage/* ]
                                  ├── /reports (PDF)
                                  └── /evidence (PNG/JPG/PDF)
```

---

## 2. Frontend & Backend Folder Structure

```text
/
├── server.ts                         # Express entry point (dev Vite middleware + prod static dist/client)
├── package.json                      # Hostinger-compatible build, start, dev, test, typecheck scripts
├── vite.config.ts                    # Vite build output configured to dist/client
├── tsconfig.json
├── .env.example                      # Documented environment variables (no secrets)
├── prisma/
│   ├── schema.prisma                 # Active Prisma schema (SQLite for local/container dev)
│   └── schema.mysql.prisma           # Production MySQL Prisma schema for Hostinger
├── storage/                          # Private non-public file storage (gitignored)
│   ├── reports/                      # Diagnostic PDF reports
│   └── evidence/                     # Patient-uploaded UPI payment screenshots/receipts
├── tests/
│   └── edfic.test.ts                 # Vitest automated unit & validation tests
└── src/
    ├── main.tsx                      # React root mount
    ├── App.tsx                       # BrowserRouter, QueryClientProvider, AuthProvider, ProtectedRoutes
    ├── index.css                     # Tailwind CSS v4 + EDFIC design tokens + FullCalendar overrides
    ├── context/
    │   └── AuthContext.tsx           # Session state, login, patient registration, logout
    ├── hooks/
    │   └── usePublicClinic.ts        # TanStack Query hooks for public clinic metadata & services
    ├── lib/
    │   ├── api.ts                    # Fetch wrapper with automatic CSRF double-submit header
    │   └── utils.ts                  # Formatting helpers & class merging
    ├── components/
    │   ├── ui/                       # Button, Input, Textarea, Select, Card, Label
    │   └── layout/
    │       ├── PublicLayout.tsx      # 3-zone header + EWA DERMA brand-aligned footer
    │       └── StaffLayout.tsx       # Role-filtered sidebar & operational workspace shell
    ├── pages/
    │   ├── public/                   # Public website (Home, About, Fetal Imaging, Services, Book, etc.)
    │   ├── portal/                   # LoginPage, PatientPortalPage
    │   └── staff/                    # Reception, Payments, CRM, Patients, Doctor, Accounts, CMS, Admin
    └── server/
        ├── seed.ts                   # Idempotent catalog, clinic config, CMS pages, and dev seed accounts
        ├── lib/
        │   ├── prisma.ts             # Singleton PrismaClient
        │   ├── security.ts           # bcryptjs, JWT cookies, CSRF verification, AuditLog helper
        │   └── storage.ts            # Magic-byte validation & path-traversal-safe private file I/O
        ├── middleware/
        │   └── auth.ts               # authenticateOptional, requireAuth, requireRole, requireHermesKey
        ├── services/
        │   ├── scheduling.ts         # Slot availability engine, hold checks, booking ref generator
        │   ├── compliance.ts         # NMC & PCPNDT automated content compliance scanner
        │   └── automation.ts         # Idempotent n8n webhook dispatcher & WhatsApp adapter
        └── routes/                   # 10 Express v1 route modules
```

---

## 3. Appointment Booking State Machine & Concurrency Protection

### State Transitions

```text
[Slot Available]
   │ (POST /appointments/hold -> 5-min SlotHold)
   ▼
PENDING_ADVANCE ──(POST /payments/submit-utr)──► ADVANCE_SUBMITTED
   │                                                    │
   │                                  ┌─────────────────┴────────────────┐
   │                                  ▼ (Staff Verify)                   ▼ (Staff Reject)
   │                              CONFIRMED ◄──────────────────── PENDING_ADVANCE
   │                                  │
   ├──(Reschedule / Override)─────────┼──► (Updates date/time; logs audit)
   ├──(Cancel)────────────────────────┼──► CANCELLED
   └──(No Show)───────────────────────┼──► NO_SHOW
                                      ▼ (Reception Check-In -> creates Visit)
                                 CHECKED_IN ──► IN_PROGRESS ──► COMPLETED
```

### Concurrency & Double-Booking Prevention
1. **Temporary Slot Holds**: When a user selects a time slot, `POST /api/v1/appointments/hold` writes a 5-minute expiring `SlotHold` keyed by `sessionToken` so concurrent visitors see reduced remaining capacity immediately.
2. **Database Transaction Guard**: `POST /api/v1/appointments/book` executes inside `prisma.$transaction`:
   - Re-queries active non-cancelled appointments overlapping `[startTime, endTime)` for `appointmentDate`.
   - Enforces capacity (`1` for Dr. Varun Agrawal morning specialist scans; `ClinicSetting.slotCapacityPerSlot` for general scans) unless `isReceptionOverride === true` by authorized `RECEPTION` or `SUPER_ADMIN` staff.
   - Rejects with HTTP `409 Conflict` if capacity was exhausted in the interim.
3. **Clinic Rules Enforced**:
   - Monday–Saturday `09:00–20:00`; Sunday `10:00–14:00` (by appointment).
   - Morning-only flag (`requiresDoctorMorning`) constrains slots to `morningSessionStart–morningSessionEnd` (`09:30–13:30`).
   - Full-day `ClinicHoliday` rows block all public slot generation.

---

## 4. UPI Payment State Machine

EDFIC enforces a strict manual verification rule: **uploading a screenshot or UTR never confirms an appointment automatically**.

| State | Meaning | Trigger | Appointment Effect |
| :--- | :--- | :--- | :--- |
| **Submitted / Pending Verification** (`PENDING`) | Patient submitted UTR, amount, date, and optional evidence file | `POST /api/v1/payments/submit-utr` | Moves appointment to `ADVANCE_SUBMITTED` |
| **Verified** (`VERIFIED`) | Reception or Accounts confirmed actual credit in clinic bank/UPI statement | `POST /api/v1/payments/:id/verify` | Generates `RCPT-YYYYMMDD-XXXX`, sets `verifiedById`/`verifiedAt`, confirms appointment (`CONFIRMED`) |
| **Rejected** (`REJECTED`) | UTR unmatched, duplicate, or insufficient after bank check | `POST /api/v1/payments/:id/reject` | Records `rejectionReason`, returns appointment to `PENDING_ADVANCE` |

Payment totals and outstanding balance calculations (`totalServiceFeeInr - amountSubmittedInr`) are strictly internal to booking confirmation, patient portal, reception, and accounts—**never exposed on public service catalogue pages**.

---

## 5. Patient Diagnostic Report Access Architecture

1. **Private Upload & Validation**: Only `DOCTOR` or `SUPER_ADMIN` may upload reports via `POST /api/v1/reports/upload`. Files are checked for `application/pdf` MIME type and `%PDF-` magic bytes, given randomized filenames, and saved to `/storage/reports` (outside `dist/client` and never statically served).
2. **Revision & Publishing Lifecycle**: `UNDER_REVIEW` (or `REVISED` on revision > 1) → Doctor/Admin review (`POST /api/v1/reports/:id/publish`) → `PUBLISHED`.
3. **Authenticated Download Only**: `GET /api/v1/reports/:id/download` verifies:
   - Valid `edfic_session` cookie.
   - Caller is either `DOCTOR`/`SUPER_ADMIN`, or the owning `PATIENT` **and** `report.status === 'PUBLISHED'`.
   - Every download writes a `ReportDownloadLog` (user, IP, User-Agent, timestamp) and an `AuditLog` entry, returning `Cache-Control: no-store, private`.
4. **No AI Interpretation**: Diagnostic reports are never passed to any LLM or automated diagnostic summarizer.

---

## 6. Integration Architectures (n8n, WhatsApp, Restricted Hermes)

### A. n8n Automation Architecture
- **Supported Authenticated Outbound Events**: `appointment.created`, `appointment.confirmed`, `appointment.rescheduled`, `appointment.cancelled`, `payment.submitted`, `payment.verified`, `crm.inquiry_created`, `crm.lead_assigned`, `patient.registered`, `report.published`, `appointment.reminder`, `reception.daily_summary`, plus `notification.email_queued` and `integration.test_ping`.
- **Idempotency & Execution Tracking**: Enforces unique `WebhookEvent.eventId` constraint before enqueueing so retries or duplicate triggers never execute duplicate n8n workflows; records `executionId`, `responseStatus`, `responseBody`, `attempts`, and `lastAttemptAt`.
- **Authenticity**: Outbound webhooks sign payloads with `HMAC-SHA256` (`X-EDFIC-Signature`) using `N8N_WEBHOOK_SECRET` (plus optional `X-N8N-API-KEY`). Inbound triggers and execution callbacks under `/api/v1/integrations/n8n/*` require timing-safe signature or API key authentication.
- **Resilience**: Failed deliveries record error state and support single-event (`POST /api/v1/admin/webhooks/:id/retry`) and batch retry (`POST /api/v1/admin/webhooks/retry-failed`).

### B. WhatsApp Business API Architecture
- **Configurable Provider Adapter**: Supports `meta_cloud`, `interakt`, `wati`, and `aisensy` with write-only credential storage (`whatsappAccessToken`, `whatsappWebhookSecret`), live connection status tracking, connectivity testing (`POST /api/v1/admin/integrations/test-whatsapp`), and customizable template IDs (`whatsappTemplatesJson`) covering inquiry ack, appointment ack, booking reference, UPI payment instructions, verified payment ack, confirmation, reminder, rescheduling, cancellation, and report availability.
- **Delivery Webhook Tracking**: `GET`/`POST /api/v1/integrations/whatsapp/webhook` validates Meta Cloud challenge tokens and `X-Hub-Signature-256` / `X-WhatsApp-Webhook-Secret`, updating `WhatsAppMessageLog` statuses (`SENT`, `DELIVERED`, `READ`, `FAILED`) with `webhookVerified: true`.
- **PHI Compliance Filter**: Explicitly blocks messages containing `.pdf`, diagnostic findings, impressions, or clinical diagnoses (`BLOCKED_PHI_PATTERNS`). Report availability notifications transmit **only** a safe link to `/patient/portal`.

### C. Restricted Hermes Agent Architecture
- Isolated under `/api/v1/hermes/*` and authenticated solely via `X-Hermes-Api-Key`.
- Rejects all non-`GET` methods and any patient/report/payment/diagnosis path with `403 Forbidden`, writing a `HERMES_PERMISSION_DENIED` `AuditLog` entry.
- Exposes **only** read-only aggregate non-PHI endpoints:
  - `GET /summary/appointments` (status counts by date; zero patient names/phones)
  - `GET /summary/inquiries` (lead pipeline counts by stage/source; zero PII)
  - `GET /summary/tasks` (pending payment, CRM task, inquiry, and waiting visit counts)
  - `GET /services` (approved public non-priced catalogue)
  - `GET /summary/operations` & `GET /summary/reception` (aggregated operational counts)
- **Human-in-the-Loop Guarantee**: Hermes cannot independently verify UPI payments, approve clinical reports, modify appointments, issue refunds, or interpret scans.

---

## 7. Missing Information & Pending External Credentials Inventory

The platform is built to make all pending clinic details configurable without code edits. Before production launch, EDFIC must supply and verify:

1. **Official Clinic Contact Numbers & Email**: Reception primary/secondary phone numbers, official WhatsApp number, and clinic email (configurable in Admin Settings).
2. **Doctor Registration Details**: Dr. Varun Agrawal's NMC/UPMC medical registration number and verified portrait photograph (no fabricated numbers or stock photos are used).
3. **Equipment Specifications & Clinic Photography**: Approved ultrasound system names/models and authentic Sushant Golf City interior photos.
4. **Verified Final Service Catalogue & Fee Schedule**: Medical/admin confirmation of all 35 seeded services, internal service fees, and advance amounts (internal only).
5. **Production Banking / UPI Details**: Verified clinic UPI VPA (`upiId`) and merchant name (`upiMerchantName`).
6. **External Credentials**:
   - Hostinger MySQL `DATABASE_URL`
   - Production `JWT_SECRET`, `CSRF_SECRET`, and `HERMES_API_KEY`
   - Official WhatsApp Business API provider endpoint URL, phone number ID, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_SECRET`, and approved template identifiers
   - n8n webhook URL, `N8N_WEBHOOK_SECRET`, and `N8N_API_KEY`
