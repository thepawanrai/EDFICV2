# EDFIC — Reception Training Guide (`RECEPTION`)

**Centre:** EDFIC — EWA Diagnostic and Fetal Imaging Centre (*A Unit of EWA DERMA*)  
**Primary Workspaces:** `/staff/reception`, `/staff/payments`, `/staff/crm`, `/staff/patients`, `/staff/analytics`

---

## 1. Role Boundaries & Privacy Rules

As EDFIC Reception staff, you manage front-desk scheduling, inquiries, patient registration, check-in, and UPI payment verification.
- **Permitted:** Appointments, schedule overrides, holidays, CRM leads & tasks, patient registration & duplicate merges, UPI/desk payment recording & verification, operational check-in.
- **Restricted:** Reception cannot upload, edit, or download clinical diagnostic report PDFs and cannot view confidential Doctor `clinicalNotes`. Always direct patients seeking their report PDF to sign in at `/patient/portal`.

---

## 2. Managing Appointments & Desk Bookings (`/staff/reception`)

1. **View Daily Schedule:** Filter appointments by date or status (`PENDING_ADVANCE`, `ADVANCE_SUBMITTED`, `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`).
2. **Book Phone / Walk-In Appointment:**
   - Select the diagnostic service and date. Morning specialist scans (e.g., NT Scan, Anomaly Scan, Fetal Echo) default to the `09:30 AM – 01:30 PM` Doctor window.
   - Enter patient name, 10-digit mobile number, optional email, referring physician, and confirm patient consent.
   - For urgent clinical cases outside normal capacity, Reception can check **Reception Override** and enter a mandatory `overrideReason` (logged to `AuditLog`).
3. **Confirm / Reschedule / Cancel:**
   - Standard appointments require a **VERIFIED** advance payment before confirmation unless **Reception Override** is documented.
   - Rescheduling checks slot availability atomically; cancelling releases the slot immediately and triggers patient notification.
4. **Patient Arrival Check-In (`Check In`):**
   - Click **Check In** when the patient arrives at the front desk. This generates a `VIS-YYYYMMDD-XXXX` visit record and places the patient in the Doctor's `WAITING` queue.
5. **Holiday Management:** Mark clinic holidays so online booking automatically blocks affected dates.

---

## 3. Manual UPI Payment Verification (`/staff/payments`)

> **Critical Policy:** A screenshot or patient-entered UTR **NEVER** automatically confirms an appointment. Reception or Accounts must verify the funds in EDFIC's actual bank/UPI statement before marking any payment `VERIFIED`.

### Step-by-Step Verification Workflow
1. Open **Payments → Pending / Submitted Queue**.
2. Inspect the submitted **UTR / Reference Number**, submitted amount, payment date, and optional **Evidence** preview (`GET /api/v1/payments/:id/evidence`).
3. Click **Mark Under Verification** while checking the clinic's bank settlement ledger.
4. Once matched in the bank statement:
   - Enter the total scan fee (`totalServiceFeeInr`) if applicable so the balance due is tracked on the receipt.
   - Click **Verify & Confirm Slot**. This generates receipt `RCPT-YYYYMMDD-XXXX`, moves the appointment to `CONFIRMED`, and dispatches confirmation notifications.
5. If UTR is invalid, duplicated, or unpaid: click **Reject** and enter a clear `rejectionReason` so the patient can re-submit a valid UTR.
6. **Walk-In Desk Payments:** Use **Record Desk Payment** for Cash, Card, UPI QR, or Bank Transfer collected directly at reception.

---

## 4. Integrated CRM Pipeline (`/staff/crm`)

1. **Lead Sources:** Website inquiries (`/contact`), phone calls, WhatsApp, doctor referrals, and walk-ins automatically populate `CRM-XXXXXX` leads.
2. **Pipeline Stages:** Progress leads cleanly across:
   `NEW → CONTACTED → INFORMATION_PROVIDED → APPOINTMENT_REQUESTED → APPOINTMENT_CONFIRMED → VISITED → FOLLOW_UP → SCHEDULED → CONVERTED → CLOSED`
3. **Follow-Up Tasks & Notes:** Add callback tasks with due dates and log internal reception notes.
4. **Convert & Link Appointment:** Convert an inquiry to a Patient record (`EDF-PT-XXXX`) and link an active booking (`Link Appointment`) so inquiry-to-visit conversion is tracked without duplicating patient records.

---

## 5. Patient Directory & Duplicate Merging (`/staff/patients`)

1. Always search by 10-digit mobile number or `EDF-PT-XXXX` ID before creating a new patient profile (`Duplicate Protection` flags matching phones/emails with `409`).
2. Review **Potential Duplicates** regularly. When two guest records exist for the same person (and do not hold conflicting portal logins), use **Merge Patient Records** to transfer all appointments, visits, payments, and reports cleanly into the primary `EDF-PT-XXXX` profile under a logged reason.
