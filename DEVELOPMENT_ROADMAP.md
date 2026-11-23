# EDFIC Platform — Phased Development & Testing Roadmap

## 1. Phased Delivery Plan

| Phase | Scope | Core Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Architecture & Planning | `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `API_DOCUMENTATION.md`, `SECURITY_PLAN.md`, `DEPLOYMENT_GUIDE.md`, `DEVELOPMENT_ROADMAP.md`, `PROJECT_STATUS.md`, `.env.example` | **Complete** |
| **Phase 1** | Foundation, Public Website & Report Vault | Modular Express + Vite monolith, Prisma schema, 14 public pages, zero-price dynamic catalogue (35 services), Dr. Varun Agrawal profile, private PDF report upload/publish/download vault | **Implemented (Dev Baseline)** |
| **Phase 2** | Appointment Engine & Manual UPI Verification | Slot availability engine, 5-min `SlotHold`, atomic `$transaction` booking, FullCalendar reception calendar, UPI QR + UTR + evidence upload, manual verification & receipt generation | **Implemented (Dev Baseline)** |
| **Phase 3** | CRM, Patient 360 & Doctor Clinical Queue | Inquiry capture, lead pipeline, follow-up tasks, lead-to-patient conversion, visit check-in, clinical notes masking, patient self-portal | **Implemented (Dev Baseline)** |
| **Phase 4** | Accounts Analytics, CMS Compliance & RBAC Hardening | Recharts revenue/category analytics, 5-stage NMC/PCPNDT CMS workflow, Super Admin settings/users/audit logs, rate limits, CSRF | **Implemented (Dev Baseline)** |
| **Phase 5** | External Integrations & Production Cutover | Production MySQL cutover, live n8n webhook endpoint, verified WhatsApp Business API credentials, Hermes key provisioning, UAT & medical/legal sign-off | **Pending External Credentials & UAT** |

---

## 2. Testing & Verification Plan

### A. Automated Tests (`npm test` via Vitest)
- **Compliance Scanner (`tests/edfic.test.ts`)**: Verifies rejection of pricing/discounts and PCPNDT sex-determination terms while approving compliant clinical copy.
- **Scheduling Math**: Verifies deterministic slot window arithmetic (`timeToMinutes`, `minutesToTime`).
- **Binary File Validation**: Verifies `%PDF-` header checks reject spoofed uploads.
- **Recommended Phase-5 Expansion**: Add Supertest API integration tests for concurrent `POST /api/v1/appointments/book` race conditions, RBAC negative tests (confirming `MARKETING_MANAGER` receives `403` on `/api/v1/patients` and `/api/v1/reports`), and `POST /api/v1/hermes/*` `403` mutation rejection.

### B. Build & Static Checks
- `npm run typecheck` (`tsc --noEmit`) — zero TypeScript errors across frontend and backend.
- `npm run build` — validates Prisma generation, Vite production bundle (`dist/client`), and esbuild Express server bundle (`dist/server/server.js`).

### C. Manual UAT Checklist Before Launch
1. Verify zero pricing or discount figures appear on any public route.
2. Verify uploading a UPI screenshot sets status to `ADVANCE_SUBMITTED` / `PENDING` and requires Reception/Accounts verification before moving to `CONFIRMED`.
3. Verify unauthenticated or cross-patient `/api/v1/reports/:id/download` returns `401`/`403`, and authorized patient downloads record a `ReportDownloadLog`.
4. Verify Hostinger staging deployment boots with `NODE_ENV=production node dist/server/server.js` and passes `GET /health`.
