# EDFIC Platform — API Documentation & RBAC Matrix

**Base API Prefix:** `/api/v1`  
**Health Check:** `GET /health`  
**Session Auth:** HTTP-only signed JWT cookie (`edfic_session`)  
**CSRF Protection:** Double-submit HMAC token (`edfic_csrf` cookie + `X-CSRF-Token` request header on all browser `POST`, `PUT`, `PATCH`, `DELETE` calls; exempts signed machine-to-machine routes `/api/v1/hermes/*` and `/api/v1/integrations/*`)

---

## 1. Role Permission Matrix

| Capability / Endpoint Group | Public | Patient | Marketing | Accounts | Reception | Doctor | Super Admin | Hermes Key |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Public clinic, doctor & zero-price services | Read | Read | Read | Read | Read | Read | Read | Read |
| Submit contact inquiry (`CrmLead`) | Write | Write | — | — | Write | — | Write | — |
| Slot lookup, hold, appointment booking | Write | Write | — | — | Write | — | Write | — |
| UPI UTR + evidence upload | Write* | Write* | — | — | — | — | — | — |
| Own patient portal & published report PDF | — | Read/DL | — | — | — | — | Read/DL | — |
| Reception calendar, check-in, overrides | — | — | — | — | Full | Read | Full | — |
| Manual UPI verification & receipts | — | — | — | Full | Full | — | Full | — |
| CRM pipeline & lead-to-patient conversion | — | — | — | — | Full | — | Full | — |
| Patient directory & 360 history | — | — | **Denied** | Read | Read/Write | Read/Write | Full | **Denied** |
| Clinical notes, PDF report upload & publish | — | — | **Denied** | **Denied** | **Denied** | Full | Full | **Denied** |
| Financial analytics & payment ledger | — | — | — | Full | — | — | Full | — |
| Service catalogue & CMS drafts | — | — | Full | — | — | Full | Full | — |
| CMS Final Approval & Publish | — | — | — | — | — | Med Rev | Full | — |
| Clinic settings, users, webhooks, audit logs | — | — | — | Audit Read | Holidays | — | Full | — |
| Read-only aggregate operational summaries | — | — | — | — | — | — | — | `GET` Only |

*\*Requires matching `bookingReference` + `phone`.*

---

## 2. Endpoint Inventory

### Health
- `GET /health` — Verifies Express process and Prisma database connectivity (`200 ok` / `503 degraded`).

### Authentication (`/api/v1/auth`)
- `GET /csrf` — Issues `edfic_csrf` token for client mutations.
- `POST /login` — Validates credentials via bcrypt, sets `edfic_session` + `edfic_csrf` cookies, logs `AUTH_LOGIN_SUCCESS`.
- `POST /register` — Creates `User` (`PATIENT`) and `Patient` (`EDF-PT-XXXX`) in a transaction.
- `POST /logout` — Clears session cookie.
- `GET /me` — Returns authenticated user profile & linked `patientCode`.

### Public Website & Inquiry (`/api/v1/public`)
- `GET /clinic` — Clinic address, operating hours, configurable contact details, and Dr. Varun Agrawal's profile.
- `GET /services` — Visible `PUBLISHED` categories & services (**pricing fields excluded**).
- `GET /services/:slug` — Individual service preparation & clinical overview (**pricing excluded**).
- `GET /cms/:pageKey` — Published CMS content for `about`, `fetal-imaging`, `privacy-policy`, `terms-of-use`, `patient-consent`.
- `POST /inquiries` — Validates inquiry via Zod, saves `CrmLead`, dispatches `crm.inquiry_created` n8n event and `INQUIRY_ACKNOWLEDGMENT` WhatsApp message.

### Appointments (`/api/v1/appointments`)
- `GET /slots?date=YYYY-MM-DD&serviceId=...` — Computes open slots respecting holidays, operating hours, morning sessions, holds, and bookings.
- `POST /hold` — Reserves a 5-minute `SlotHold`.
- `POST /book` — Atomic `$transaction` slot reservation, patient upsert, `EDF-YYYYMMDD-XXXX` reference generation, and WhatsApp/n8n dispatch.
- `POST /lookup` — Retrieves appointment and payment status by `bookingReference` + `phone`.
- `GET /` — Staff appointment calendar list.
- `PATCH /:id/reschedule` — Reschedules date/time (supports `isReceptionOverride` for `RECEPTION`/`SUPER_ADMIN`).
- `PATCH /:id/cancel` — Cancels appointment by owner or staff.
- `POST /:id/check-in` — Creates `Visit` (`VIS-YYYYMMDD-XXXX`) and marks appointment `CHECKED_IN`.

### UPI Payments (`/api/v1/payments`)
- `POST /submit-utr` — Multipart upload (`evidence` PNG/JPG/PDF max 5 MB) + UTR metadata. Creates `PENDING` payment only.
- `GET /` — Payment verification queue (`SUPER_ADMIN`, `RECEPTION`, `ACCOUNTS`).
- `GET /:id/evidence` — Streams uploaded evidence from `/storage/evidence` to authorized staff.
- `POST /:id/verify` — Verifies transaction, generates `RCPT-YYYYMMDD-XXXX`, confirms appointment, dispatches WhatsApp & n8n.
- `POST /:id/reject` — Rejects payment with reason and returns appointment to `PENDING_ADVANCE`.

### Patient Management (`/api/v1/patients`)
- `GET /me/portal` — Authenticated patient's profile, consent record, appointments, clinical visits, payments, and `PUBLISHED` reports.
- `GET /duplicates` — Detects potential duplicate patient records sharing phone or email (`SUPER_ADMIN`, `RECEPTION`, `DOCTOR`).
- `GET /` — Staff patient search (`q`) (`SUPER_ADMIN`, `RECEPTION`, `DOCTOR`, `ACCOUNTS`; `MARKETING_MANAGER` denied).
- `POST /` — Registers walk-in/desk patient record with duplicate check (`409` unless `allowDuplicate: true`).
- `PATCH /:id` — Updates patient demographics and consent record.
- `POST /merge` — Atomic transactional merge of duplicate patient record (`sourcePatientId` → `targetPatientId`, `SUPER_ADMIN` / `RECEPTION`).
- `GET /:id` — Patient 360 profile (masks `Visit.clinicalNotes` for non-clinical roles; logs `PATIENT_RECORD_ACCESSED`).

### Diagnostic Reports (`/api/v1/reports`)
- `GET /doctor-queue` — Today's appointments, upcoming schedule, assigned patients, checked-in visits & report revisions (`DOCTOR`, `SUPER_ADMIN`).
- `PATCH /visits/:visitId` — Updates visit status & restricted clinical notes (`DOCTOR`, `SUPER_ADMIN`).
- `POST /upload` — Validates `%PDF-` magic bytes, saves to `/storage/reports`, creates revision associated with visit & appointment (`DOCTOR`, `SUPER_ADMIN`).
- `POST /:id/review` — Records medical staff review (`reviewedById`, `REPORT_REVIEWED` audit).
- `POST /:id/publish` — Publishes report to patient portal & triggers portal-link-only WhatsApp notice.
- `GET /:id/download` — Streams private PDF to authorized `DOCTOR`/`SUPER_ADMIN` or owning `PATIENT` (`PUBLISHED` only) and writes `ReportDownloadLog`.

### CRM (`/api/v1/crm`)
- `GET /assignees` — Lists assignable `RECEPTION` / `SUPER_ADMIN` staff members.
- `GET /` — Filterable & searchable CRM pipeline (`q`, `status`, `source`, `assignedToId`).
- `POST /`, `PATCH /:id`, `POST /:id/link-appointment`, `POST /:id/tasks`, `PATCH /tasks/:taskId/toggle`, `POST /:id/convert` (`SUPER_ADMIN`, `RECEPTION`).

### CMS & Service Catalogue (`/api/v1/cms`)
- `GET /content`, `POST /content`, `POST /content/:id/advance` (`DRAFT → MEDICAL_REVIEW → COMPLIANCE_REVIEW → FINAL_APPROVED → PUBLISHED`).
- `GET /services`, `POST /services`, `PATCH /services/:id`.

### Admin & Analytics (`/api/v1/admin`)
- `GET /overview` — Executive counts, operational alerts, today's/upcoming appointments, new inquiries, pending verifications (`SUPER_ADMIN`, `RECEPTION`).
- `GET /settings`, `PUT /settings` — Sanitized settings response (write-only secrets never returned in plaintext), template mapping, schedule/UPI config, `POST /holidays`, `DELETE /holidays/:id`.
- `GET /users`, `POST /users`, `PATCH /users/:id/role`, `PATCH /users/:id/toggle-active`.
- `GET /audit-logs?action=...&resourceType=...`, `GET /automation-logs`, `POST /webhooks/:id/retry`, `POST /webhooks/retry-failed`, `POST /integrations/test-n8n`, `POST /integrations/test-whatsapp`, `POST /integrations/trigger-reminders`, `POST /integrations/trigger-daily-summary`, `GET /analytics`.

### Authenticated Automation & WhatsApp Callbacks (`/api/v1/integrations`)
- `POST /n8n/trigger-reminders` — Signed (`X-EDFIC-Signature` or `X-N8N-API-KEY`) trigger for upcoming appointment reminders (`appointment.reminder` + `APPOINTMENT_REMINDER`).
- `POST /n8n/trigger-daily-summary` — Signed trigger dispatching non-PHI `reception.daily_summary`.
- `POST /n8n/execution-callback` — Signed n8n workflow execution status callback updating `WebhookEvent.executionId`, `status`, and `responseBody`.
- `GET /whatsapp/webhook` — Meta Cloud webhook verification challenge (`hub.mode=subscribe` + `hub.verify_token`).
- `POST /whatsapp/webhook` — Signed (`X-Hub-Signature-256` or `X-WhatsApp-Webhook-Secret`) delivery/read/failed status updates mapped to `WhatsAppMessageLog`.

### Restricted Hermes Agent (`/api/v1/hermes`)
*(Authenticated via `X-Hermes-Api-Key`. All non-`GET` methods and any patient/report/payment/diagnostic endpoints return `403 Forbidden` with `HERMES_PERMISSION_DENIED` audit log. Human approval is required for any consequential operational action.)*
- `GET /summary/appointments?date=YYYY-MM-DD` — Status counts by date (zero PII).
- `GET /summary/inquiries` — Inquiry pipeline and source counts (zero PII).
- `GET /summary/tasks` — Pending payment verification, CRM task, inquiry, and waiting visit counts.
- `GET /services` — Approved non-priced diagnostic service catalogue.
- `GET /summary/operations` — Aggregate appointments, inquiries, tasks, and pending report counts.
- `GET /summary/reception` — Today's aggregate operational counts.
