# EDFIC — Administrator User Guide (`SUPER_ADMIN`)

**Platform:** EWA Diagnostic and Fetal Imaging Centre (*A Unit of EWA DERMA*)  
**Portal URL:** `/login` → `/staff/admin`

---

## 1. Admin Console Capabilities

The **Super Admin** role has full configuration and oversight privileges across clinical operations, CMS publishing, financial verification settings, staff access governance, integrations, and security audit logs.

### Daily Dashboard Overview (`/staff/admin`)
Displays real-time operational counts via `GET /api/v1/admin/overview`:
- Today's and upcoming appointment volumes.
- New CRM inquiries requiring reception follow-up.
- UPI payment submissions awaiting manual verification.
- Confirmed, completed, and cancelled appointment totals.
- Automated operational alerts (pending UTRs, overdue CRM tasks, unpublished reports, failed webhooks).

---

## 2. Clinic Schedule, Contact & UPI Settings

Navigate to **Admin Console → Clinic, UPI & Integration Settings**:
1. **Contact & Hours:** Update official primary/secondary phone numbers, WhatsApp Business display number, official email, weekday hours (`09:00 AM - 08:00 PM`), Sunday hours (`10:00 AM - 02:00 PM`), and morning specialist window (`09:30`–`13:30`).
2. **Slot Capacity & Auto-Expiry:**
   - `slotDurationMinutes` (default `30` min)
   - `slotCapacityPerSlot` (default `2` concurrent bookings; morning doctor fetal scans enforce capacity `1`)
   - `maxDailyAppointments` (daily clinic cap, default `40`)
   - `reservationExpiryMinutes` (auto-cancels unpaid online `PENDING_ADVANCE` holds after timeout, default `30` min)
3. **UPI Payment Configuration:**
   - Update official verified merchant `upiId`, `upiMerchantName`, and `defaultAdvanceAmountInr` (used for booking advance payments only; **never shown on public informational service pages**).
4. **Clinic Holidays:** Add or remove full-day closures (`POST /api/v1/admin/holidays`). Holidays immediately block online slot availability on `/book`.

---

## 3. Staff User Accounts & Role Governance

Navigate to **Admin Console → Staff & Role Access**:
- **Create Staff Account (`POST /api/v1/admin/users`):** Assign strictly least-privilege roles:
  - `SUPER_ADMIN`: Full clinic configuration, CMS final publish, staff management, audit access.
  - `RECEPTION`: Scheduling overrides, holidays, CRM leads/tasks, patient registry & merging, manual UPI verification & check-in.
  - `DOCTOR`: Daily clinical queue, visit notes, report PDF upload, medical review, and publishing.
  - `ACCOUNTS`: Payment verification, refunds, billing analytics, audit log review (clinical notes masked).
  - `MARKETING_MANAGER`: Strictly restricted to CMS drafts (`DRAFT`) and analytics—**blocked at API level (`403`) from all patient records, CRM inquiries, appointments, payments, and diagnostic reports**.
- **Activate / Deactivate (`PATCH /users/:id/toggle-active`) & Role Updates (`PATCH /users/:id/role`):** Safeguard prevents a Super Admin from downgrading their own active admin session.

---

## 4. Service Catalogue & CMS Governance (`/staff/cms`)

1. Edit diagnostic service names, summaries, clinical preparation instructions, morning doctor flags, and advance fee settings (`internalBaseFeeInr` / `advanceAmountInr` stay internal-only).
2. Run compliance scans (`POST /api/v1/cms/compliance-scan`)—any content violating zero-public-pricing, PCPNDT, or NMC ethics rules is blocked from publishing.
3. Advance content through the mandatory approval pipeline (`DRAFT → MEDICAL_REVIEW → COMPLIANCE_REVIEW → FINAL_APPROVED → PUBLISHED`).

---

## 5. n8n, WhatsApp & Hermes Security Controls

1. **Write-Only Secret Storage:** Once `N8N Webhook Secret`, `N8N API Key`, `WhatsApp Access Token`, or `WhatsApp Webhook Secret` is saved, the dashboard displays only a masked trailing indicator (e.g., `••••1234`). Leave secret fields blank on subsequent updates to preserve saved credentials.
2. **Outbound URL Protection:** Production mode requires `https://` integration URLs and automatically rejects private/loopback or cloud metadata addresses.
3. **Connectivity Checks & Retries:** Use **Test n8n Webhook**, **Test WhatsApp Connection**, and **Retry Failed Webhooks** directly from the Integration Status panel.

---

## 6. Security Audit Trail & Backups

- **Audit Logs (`GET /api/v1/admin/audit-logs`):** Filter by action or resource type to inspect logins, failed auth attempts, payment verifications, report downloads, role changes, and denied Hermes requests.
- **Automated Backups (Hostinger):** Configure daily cron backups of both:
  1. Production MySQL database via `mysqldump` (compressed & encrypted off-host).
  2. Private filesystem directories `/storage/reports` and `/storage/evidence`.
- **Production Seed Lock:** Ensure `.env` on Hostinger sets `DISABLE_DEV_SEED="true"` after initial admin creation so default demo accounts are never recreated.
