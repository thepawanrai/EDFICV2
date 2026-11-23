# EDFIC — External Integrations & Automation Guide

Covers **n8n Workflow Automation**, **WhatsApp Business API Providers**, **Email Dispatch**, **UPI Payment Lifecycle**, and **Restricted Hermes Agent API**.

---

## 1. n8n Webhook Integration

### Outbound Events (`/api/v1/integrations` & `src/server/services/automation.ts`)
EDFIC emits signed JSON POST payloads with unique idempotent `eventId` keys for:
- `appointment.created`, `appointment.confirmed`, `appointment.rescheduled`, `appointment.cancelled`, `appointment.reservation_expired`, `appointment.reminder`
- `payment.submitted`, `payment.under_verification`, `payment.verified`, `payment.rejected`, `payment.refunded`
- `crm.inquiry_created`, `crm.lead_assigned`
- `patient.registered`, `report.published`, `reception.daily_summary`
- `notification.email_queued` (email channel relay payloads)

### Headers & Signature Verification
Every outbound webhook includes:
- `X-EDFIC-Event-Id`: Unique idempotency key.
- `X-EDFIC-Event-Type`: Event identifier.
- `X-EDFIC-Signature`: Hex HMAC-SHA256 digest of the raw JSON body signed using `N8N_WEBHOOK_SECRET`.
- `X-N8N-API-KEY`: Optional API key header if configured.

### Inbound Signed n8n Triggers & Callbacks
n8n workflows can securely call EDFIC using HMAC-SHA256 (`X-EDFIC-Signature` computed over the raw JSON body with `N8N_WEBHOOK_SECRET`):
- `POST /api/v1/integrations/n8n/execution-callback` — Updates `WebhookEvent.executionId` and status.
- `POST /api/v1/integrations/n8n/trigger-reminders` — Triggers upcoming appointment reminder events & WhatsApp notices for `targetDate` (`YYYY-MM-DD`).
- `POST /api/v1/integrations/n8n/trigger-daily-summary` — Dispatches non-PHI aggregated daily summary (`reception.daily_summary`).

### Retries & Failure Handling
Failed deliveries (`HTTP >= 400`, timeout, or network error) are recorded in `WebhookEvent` with `status = 'FAILED'`, `lastError`, and attempt counter (`attempts < 5`), retryable individually (`POST /api/v1/admin/webhooks/:id/retry`) or in batch (`POST /api/v1/admin/webhooks/retry-failed`).

---

## 2. WhatsApp Business API Integration

Configured via **Admin Console → Clinic, UPI & Integration Settings** or `.env`:
- **Supported Providers:** `meta_cloud`, `interakt`, `wati`, `aisensy`.
- **Template Keys:** `INQUIRY_ACKNOWLEDGMENT`, `APPOINTMENT_ACKNOWLEDGMENT`, `BOOKING_REFERENCE`, `PAYMENT_INSTRUCTIONS`, `PAYMENT_ACKNOWLEDGED`, `PAYMENT_REJECTED`, `APPOINTMENT_CONFIRMED`, `APPOINTMENT_REMINDER`, `APPOINTMENT_RESCHEDULED`, `APPOINTMENT_CANCELLED`, `REPORT_PORTAL_NOTICE`.
- **Delivery Status Webhook:**
  - `GET /api/v1/integrations/whatsapp/webhook` verifies `hub.verify_token` against `WHATSAPP_WEBHOOK_SECRET`.
  - `POST /api/v1/integrations/whatsapp/webhook` verifies `X-Hub-Signature-256` (`sha256=<hmac>`) and updates `WhatsAppMessageLog` (`SENT → DELIVERED / READ / FAILED`).
- **Strict Diagnostic Confidentiality Policy:**
  - `dispatchWhatsAppMessage` rejects any message referencing `.pdf`, `findings`, `impression`, `diagnosis`, or `fetal anomaly`.
  - When a diagnostic report is published, WhatsApp delivers **only** a portal login notice directing the patient to `/patient/portal`.

---

## 3. Email Notification Relay

Non-PHI transactional notifications (appointment acknowledgment, confirmation, reschedule, cancellation) invoke `dispatchEmailNotification(...)`, emitting `notification.email_queued` events to n8n for SMTP/transactional email delivery whenever a patient email is provided. Clinical findings and PDF attachments are strictly prohibited from leaving the authenticated portal.

---

## 4. UPI Payment Integration Architecture

EDFIC uses a **direct-to-clinic-UPI + manual bank verification** model (no third-party payment gateway settlement fees or automated screenshot trust):
1. Patient generates UPI payment details (`upi://pay?pa=...&am=...&tn=BOOKING_REF`) and QR code on `/book`.
2. Patient pays via any UPI app and submits UTR reference (+ optional screenshot) to `POST /api/v1/payments/submit-utr` -> status `SUBMITTED`.
3. Reception/Accounts confirms bank receipt and invokes `POST /api/v1/payments/:id/verify` -> status `VERIFIED`, receipt `RCPT-...` issued, appointment moves to `CONFIRMED`.

---

## 5. Restricted Hermes Agent API (`/api/v1/hermes/*`)

### Authentication & Isolation
- Requires `X-Hermes-Api-Key` matched via constant-time comparison against `HERMES_API_KEY` (fails closed with HTTP `503` in production if unconfigured or placeholder).
- Strictly `GET`-only (`POST`/`PUT`/`PATCH`/`DELETE` immediately return `403` and log `HERMES_PERMISSION_DENIED`).
- Explicit blocklist rejects any path referencing `patient`, `report`, `diagnosis`, `payment`, `utr`, `audit`, `user`, `clinical`, or `upload`.

### Allowed Endpoints
- `GET /api/v1/hermes/summary/appointments?date=YYYY-MM-DD` — Status/channel counts only.
- `GET /api/v1/hermes/summary/inquiries` — CRM counts by status/source + open follow-up task count.
- `GET /api/v1/hermes/summary/tasks` — Pending verification & unpublished report counts.
- `GET /api/v1/hermes/summary/operations` — Overall clinic aggregate counts (`AGGREGATE_NON_PHI_ONLY`).
- `GET /api/v1/hermes/summary/reception?date=YYYY-MM-DD` — Today's non-PHI reception operations summary.
- `GET /api/v1/hermes/services` — Published diagnostic service names/categories/durations (zero pricing, zero patient data).

### Human Approval Boundary
Hermes operates strictly as an external read-only operational advisor. Any clinic action (booking overrides, payment verification, lead status updates, report publishing, SMS/WhatsApp triggers) requires authenticated EDFIC staff action inside the web console.
