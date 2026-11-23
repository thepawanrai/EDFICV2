# EDFIC — Medical Content & Healthcare Compliance Approval Checklist

**Institution:** EDFIC — EWA Diagnostic and Fetal Imaging Centre (*A Unit of EWA DERMA*)  
**Location:** Unit 10, Millennium Place, Sushant Golf City (Near Lulu Mall), Lucknow, Uttar Pradesh  
**Purpose:** Formal pre-launch verification checklist for EDFIC's authorized medical, legal, and compliance representatives. All public pages, diagnostic service descriptions, and patient workflows must be reviewed and signed off prior to public launch.

---

## 1. Parent Entity & Brand Identity Compliance

- [ ] Verify *"A Unit of EWA DERMA"* appears accurately on the Homepage, About EDFIC, Header eyebrow, Footer, Contact, Privacy Policy, and Terms of Use.
- [ ] Confirm official clinic address (*Unit 10, Millennium Place, Sushant Golf City, Near Lulu Mall, Lucknow*) and operating hours (Monday–Saturday 09:00 AM–08:00 PM; Sunday 10:00 AM–02:00 PM by appointment; Morning Fetal Medicine session 09:30 AM–01:30 PM).
- [ ] Replace placeholder reception phone numbers, WhatsApp Business contact number, and official clinic email in **Admin Console → Clinic Settings** (`PUT /api/v1/admin/settings`).

---

## 2. PCPNDT Act & Rules (Pre-Conception and Pre-Natal Diagnostic Techniques)

- [x] Statutory PCPNDT notice banner displayed prominently on Fetal Imaging (`/fetal-imaging`) and Patient Consent (`/patient-consent`) pages.
- [x] Mandatory consent and PCPNDT notice acknowledgment checkbox enforced before online or desk appointment reservation (`/book`).
- [x] Automated backend content scanner (`src/server/services/compliance.ts`) blocks saving/publishing CMS content or service descriptions containing gender-prediction or sex-determination terminology.
- [ ] **Representative Sign-Off:** Confirm all wording across `/fetal-imaging`, `/services/*`, `/faqs`, `/patient-info`, and `/patient-consent` accurately reflects legal obligations under the PCPNDT Act, 1994 and Rules, and verify clinic PCPNDT registration display at the physical centre and (if mandated by local authority) website footer.

---

## 3. National Medical Commission (NMC) Professional Conduct & Advertising Rules

- [x] **Zero Public Pricing / Discounts:** No scan fees, diagnostic package rates, discounts, coupons, or promotional pricing appear on any public route or `/api/v1/public/*` response.
- [x] **No Fabricated Testimonials or Ratings:** Zero star ratings, Google review widgets, patient quotes, or "best/No. 1" superiority claims anywhere in the codebase.
- [x] **No Diagnostic Guarantees:** Clinical descriptions remain educational, factual, and non-promissory.
- [x] **No Fabricated Doctor Registration Numbers or Unapproved Photography:** Website does not publish unverified NMC/UPMC registration numbers, fake equipment serials, or unauthorized patient/clinic photos.
- [ ] **Doctor Credentials Sign-Off:** Confirm Dr. Varun Agrawal's exact qualification (*DNB Radiology*), designation (*Consultant Radiologist & Fetal Medicine Specialist*), areas of expertise (*NT Scan, Anomaly Scan, Growth Scan, Doppler, Fetal Echo, BPP*), and provide verified registration number + approved portrait/facility photography via Admin CMS if desired.
- [ ] **Equipment Inventory Sign-Off:** Review `/technology` page to replace generic clinical capability descriptions with exact verified ultrasound system make/model details installed at EDFIC Lucknow.

---

## 4. Indian Data Protection (DPDP Principles) & Medical Record Confidentiality

- [x] Diagnostic report PDFs stored outside static web roots (`/storage/reports`) with strictly authenticated patient-owner or Doctor/Super Admin downloads (`/api/v1/reports/:id/download`).
- [x] WhatsApp notifications (`/api/v1/integrations/*`, `automation.ts`) are programmatically blocked from attaching PDFs or transmitting findings/impressions/diagnoses—only patient portal access notices are sent.
- [x] Hermes Agent API (`/api/v1/hermes/*`) is strictly read-only aggregated summary data with zero patient PII, report content, or clinical notes.
- [x] Immutable `AuditLog` and `ReportDownloadLog` capture every report publish, review, and download event.
- [ ] **Legal Sign-Off:** Authorized legal representative approves `/privacy-policy`, `/terms-of-use`, `/patient-consent`, and physical consent form alignment for statutory medical record retention periods.

---

## 5. CMS Approval Workflow Enforcement

Every diagnostic service modification and public CMS page follows a mandatory 5-stage server-enforced workflow (`src/server/routes/cms.routes.ts`):
`DRAFT → MEDICAL_REVIEW → COMPLIANCE_REVIEW → FINAL_APPROVED → PUBLISHED`

Public routes query strictly `approvalStatus = 'PUBLISHED'` and `status = 'PUBLISHED'`.

---

## 6. Official Pre-Launch Sign-Off Table

| Review Area | Reviewer Name & Designation | Status | Date | Signature / Remarks |
| :--- | :--- | :--- | :--- | :--- |
| **Medical Accuracy & Doctor Profile** | Dr. Varun Agrawal (or Authorized Medical Director) | Pending Review | | |
| **PCPNDT & Clinical Establishment Compliance** | Authorized Compliance Officer / EWA DERMA Legal | Pending Review | | |
| **Official Contact, Hours & UPI VPA Verification** | Centre Operations Head | Pending Review | | |
| **Technology & Approved Clinic Media** | Facility Administrator | Pending Review | | |
