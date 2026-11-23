# EDFIC Platform — REST API v1 Documentation

Base path: `/api/v1`  
Health endpoint: `GET /health`  
CSRF protection: Mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) require double-submit `edfic_csrf` cookie + `X-CSRF-Token` header (obtained via `GET /api/v1/auth/csrf`).

## Authentication (`/api/v1/auth`)
- `GET /csrf` — Returns `{ csrfToken }` and sets `edfic_csrf` cookie.
- `POST /login` — Authenticates email/password, sets HTTP-only `edfic_session` JWT cookie.
- `POST /register` — Registers a `PATIENT` user and linked `Patient` profile.
- `POST /logout` — Clears session cookie.
- `GET /me` — Returns current authenticated user & `patientCode`.

## Public Endpoints (`/api/v1/public`)
- `GET /clinic` — Returns configurable clinic metadata, hours, and Dr. Varun Agrawal profile.
- `GET /services` — Returns visible `PUBLISHED` categories & services (**pricing fields strictly omitted**).
- `GET /services/:slug` — Returns single service clinical/preparation details (**pricing omitted**).
- `GET /cms/:pageKey` — Returns `PUBLISHED` CMS content blocks.
- `POST /inquiries` — Creates a `CrmLead` from the Contact page and dispatches idempotent `crm.lead_assigned` webhook.

## Appointments (`/api/v1/appointments`)
- `GET /slots?date=YYYY-MM-DD&serviceId=...` — Computes real-time open slots respecting clinic hours, morning specialist window, holidays, holds, and bookings.
- `POST /hold` — Creates a 5-minute temporary `SlotHold`.
- `POST /book` — Atomically creates/links `Patient` and `Appointment` inside Prisma `$transaction`, returning `bookingReference` and UPI advance QR parameters.
- `POST /lookup` — Patient booking lookup by `bookingReference` + `phone`.
- `GET /` — Staff appointment calendar list (`SUPER_ADMIN`, `RECEPTION`, `DOCTOR`, `ACCOUNTS`).
- `PATCH /:id/reschedule` — Reschedules slot (supports `isReceptionOverride` for Reception/Admin).
- `PATCH /:id/cancel` — Cancels appointment (owner or Reception/Admin).
- `POST /:id/check-in` — Creates `Visit` (`VIS-YYYYMMDD-XXXX`) and marks appointment `CHECKED_IN`.

## UPI Payments (`/api/v1/payments`)
- `POST /submit-utr` — Multipart form submission of UTR, amount, date, and optional PNG/JPEG/PDF evidence. Sets status `PENDING` (never auto-verified).
- `GET /` — Staff payment verification queue (`SUPER_ADMIN`, `RECEPTION`, `ACCOUNTS`).
- `GET /:id/evidence` — Authenticated download/preview of uploaded evidence from private storage.
- `POST /:id/verify` — Manual verification generating `RCPT-YYYYMMDD-XXXX` and confirming appointment.
- `POST /:id/reject` — Rejects payment submission with reason.

## Patients (`/api/v1/patients`)
- `GET /me/portal` — Authenticated patient self-portal data (appointments, payments, published reports).
- `GET /` — Staff patient search (`SUPER_ADMIN`, `RECEPTION`, `DOCTOR`, `ACCOUNTS`).
- `POST /` — Creates patient record.
- `GET /:id` — Patient 360 profile (clinical notes masked for non-clinical roles).

## Diagnostic Reports (`/api/v1/reports`)
- `GET /doctor-queue` — Clinical visits & report revisions (`DOCTOR`, `SUPER_ADMIN`).
- `PATCH /visits/:visitId` — Updates visit status and clinical notes (`DOCTOR`, `SUPER_ADMIN`).
- `POST /upload` — Uploads verified `%PDF-` file into private `/storage/reports` (`DOCTOR`, `SUPER_ADMIN`).
- `POST /:id/publish` — Publishes report to patient portal & dispatches portal-link-only WhatsApp notice.
- `GET /:id/download` — Authenticated private file stream with `ReportDownloadLog` audit record.

## CRM (`/api/v1/crm`)
- `GET /`, `POST /`, `PATCH /:id`, `POST /:id/tasks`, `PATCH /tasks/:taskId/toggle`, `POST /:id/convert` (`SUPER_ADMIN`, `RECEPTION`).

## CMS & Service Management (`/api/v1/cms`)
- `GET /content`, `POST /content`, `POST /content/:id/advance` (`DRAFT → MEDICAL_REVIEW → COMPLIANCE_REVIEW → FINAL_APPROVED → PUBLISHED`).
- `GET /services`, `POST /services`, `PATCH /services/:id`.

## Admin & Analytics (`/api/v1/admin`)
- `GET /settings`, `PUT /settings` (`SUPER_ADMIN`).
- `POST /holidays`, `DELETE /holidays/:id`.
- `GET /users`, `POST /users`, `PATCH /users/:id/toggle-active` (`SUPER_ADMIN`).
- `GET /audit-logs`, `GET /automation-logs`, `POST /webhooks/:id/retry`, `GET /analytics`.

## Restricted Hermes Agent API (`/api/v1/hermes`)
Authenticated exclusively via `X-Hermes-Api-Key`. Read-only (`GET` only; mutations return `403`).
- `GET /summary/appointments?date=YYYY-MM-DD`
- `GET /summary/tasks`
- `GET /services`
- `GET /summary/reception`
