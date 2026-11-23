# EDFIC Platform — Database Design & Prisma Schema Plan

## 1. Engine Strategy

- **Local / Sandbox Runtime (`prisma/schema.prisma`)**: SQLite (`DATABASE_URL="file:./dev.db"`) enabling zero-dependency transactional testing and full relational integrity.
- **Hostinger Production Runtime (`prisma/schema.mysql.prisma`)**: MySQL 8.x (`DATABASE_URL="mysql://USER:PASS@HOST:3306/DB_NAME"`) with explicit `@db.Text` / `@db.LongText` column mappings for long clinical, CMS, and webhook JSON payloads.

---

## 2. Entity Relationship Overview

```text
User (1) ────────── (0..1) Patient
 │                           │
 ├── (1:N) AuditLog          ├── (1:N) Appointment ──── (N:1) DiagnosticService ──── (N:1) ServiceCategory
 ├── (1:N) CrmLead           │        │                         │
 ├── (1:N) CrmTask           │        ├── (1:N) Payment         └── (1:N) SlotHold
 ├── (1:N) CmsContentItem    │        └── (0..1) Visit
 └── (1:N) DiagnosticReport  │                     │
                             └── (1:N) DiagnosticReport ──── (1:N) ReportDownloadLog
```

---

## 3. Detailed Table, Key, Index, Constraint & Sensitivity Inventory

### 1. `User`
- **Primary Key**: `id` (`String`, CUID)
- **Unique Constraints**: `email`
- **Core Fields**: `email`, `passwordHash`, `fullName`, `phone`, `role` (`UserRole` enum), `isActive`, `lastLoginAt`, `createdAt`, `updatedAt`
- **Sensitive Fields**: `passwordHash` (bcrypt cost 12 — never returned in API responses)

### 2. `Patient`
- **Primary Key**: `id` (`String`, CUID)
- **Foreign Keys**: `userId` → `User.id` (nullable, unique `1:1`)
- **Unique Constraints**: `patientCode` (`EDF-PT-XXXX`), `userId`
- **Sensitive PII Fields**: `fullName`, `phone`, `email`, `dateOfBirth`, `gender`, `address`, `emergencyContact`, `consentAccepted`, `consentTimestamp`

### 3. `ServiceCategory`
- **Primary Key**: `id` (`String`, CUID)
- **Unique Constraints**: `slug`
- **Fields**: `slug`, `name`, `description`, `sortOrder`, `isVisible`

### 4. `DiagnosticService`
- **Primary Key**: `id` (`String`, CUID)
- **Foreign Keys**: `categoryId` → `ServiceCategory.id`
- **Unique Constraints**: `slug`, `code`
- **Commercial / Restricted Fields**: `advanceAmountInr`, `internalBaseFeeInr` (**never serialized on `/api/v1/public/*` endpoints**)

### 5. `ClinicSetting`
- **Primary Key**: `id` (`"singleton"`)
- **Fields**: Clinic identity (`clinicName`, `fullName`, `parentUnitName`), address/landmark, configurable contact fields (`primaryPhone`, `secondaryPhone`, `whatsappNumber`, `officialEmail`), operating hours, slot parameters (`slotDurationMinutes`, `slotCapacityPerSlot`, `maxDailyAppointments`, `reservationExpiryMinutes`, `morningSessionStart`, `morningSessionEnd`), UPI config (`upiId`, `upiMerchantName`, `defaultAdvanceAmountInr`), and integration settings.
- **Sensitive Credentials**: `n8nWebhookSecret`, `whatsappApiUrl` (restricted to `SUPER_ADMIN` endpoints).

### 6. `ClinicHoliday`
- **Primary Key**: `id` (`String`, CUID)
- **Unique Constraints**: `date` (`YYYY-MM-DD`)

### 7. `SlotHold`
- **Primary Key**: `id` (`String`, CUID)
- **Foreign Keys**: `serviceId` → `DiagnosticService.id`
- **Indexes**: `@@index([date, startTime])`
- **Purpose**: 5-minute temporary hold by `sessionToken` (`expiresAt`).

### 8. `Appointment`
- **Primary Key**: `id` (`String`, CUID)
- **Foreign Keys**: `patientId` → `Patient.id`, `serviceId` → `DiagnosticService.id`, `doctorId` → `User.id` (optional)
- **Unique Constraints**: `bookingReference` (`EDF-YYYYMMDD-XXXX`)
- **Indexes**: `@@index([appointmentDate, startTime])`, `@@index([patientId])`
- **Sensitive Fields**: `patientPhone`, `patientEmail`, `clinicalIndication`, `referringDoctor`

### 9. `Payment`
- **Primary Key**: `id` (`String`, CUID)
- **Foreign Keys**: `appointmentId` → `Appointment.id`, `patientId` → `Patient.id`, `verifiedById` → `User.id`
- **Unique Constraints**: `receiptNumber` (`RCPT-YYYYMMDD-XXXX`, nullable until verified)
- **Indexes**: `@@index([status])`, `@@index([appointmentId])`
- **Fields**: `paymentMethod` (`UPI`, `CASH`, `CARD`, `BANK_TRANSFER`), `status` (`PENDING`, `SUBMITTED`, `UNDER_VERIFICATION`, `VERIFIED`, `REJECTED`, `REFUNDED`), `totalServiceFeeInr`
- **Sensitive Fields**: `utrReference`, `evidenceFilePath` (private `/storage/evidence` filename)

### 10. `Visit`
- **Primary Key**: `id` (`String`, CUID)
- **Foreign Keys**: `appointmentId` → `Appointment.id` (unique `1:1`), `patientId` → `Patient.id`, `doctorId` → `User.id`
- **Unique Constraints**: `visitNumber` (`VIS-YYYYMMDD-XXXX`), `appointmentId`
- **Sensitive PHI Fields**: `clinicalNotes` (masked from non-clinical staff roles)

### 11. `DiagnosticReport`
- **Primary Key**: `id` (`String`, CUID)
- **Foreign Keys**: `patientId` → `Patient.id`, `visitId` → `Visit.id`, `uploadedById` → `User.id`, `reviewedById` → `User.id`
- **Unique Constraints**: `reportCode` (`RPT-YYYYMMDD-XXXX`)
- **Indexes**: `@@index([patientId, status])`
- **Sensitive PHI Fields**: `storedFilePath` (private `/storage/reports` filename — never exposed publicly)

### 12. `ReportDownloadLog`
- **Primary Key**: `id` (`String`, CUID)
- **Foreign Keys**: `reportId` → `DiagnosticReport.id`, `downloadedById` → `User.id`, `patientId` → `Patient.id`
- **Fields**: `ipAddress`, `userAgent`, `downloadedAt`

### 13. `CrmLead` & 14. `CrmTask`
- **Primary Keys**: `id` (`String`, CUID)
- **Foreign Keys**: `CrmLead.assignedToId` → `User.id`, `CrmLead.convertedPatientId` → `Patient.id`, `CrmLead.linkedAppointmentId` → `Appointment.id`, `CrmTask.leadId` → `CrmLead.id`, `CrmTask.assignedToId` → `User.id`
- **Unique Constraints**: `CrmLead.leadCode` (`CRM-XXXXXX`)
- **Lead Stages (`LeadStatus`)**: `NEW`, `CONTACTED`, `INFORMATION_PROVIDED`, `APPOINTMENT_REQUESTED`, `APPOINTMENT_CONFIRMED`, `VISITED`, `FOLLOW_UP`, `SCHEDULED`, `CONVERTED`, `CLOSED`

### 15. `CmsContentItem`
- **Primary Key**: `id` (`String`, CUID)
- **Foreign Keys**: `authorId` → `User.id`
- **Unique Constraints**: `slug`
- **Workflow & Compliance Fields**: `status` (`ApprovalStatus`), `checklistNoPrice`, `checklistNoSexDetermination`, `checklistNoGuarantee`, `checklistNoFakeTestimonial`, `complianceIssues`, `medicalReviewerName`, `complianceReviewerName`, `finalApproverName`

### 16. `WebhookEvent`
- **Primary Key**: `id` (`String`, CUID)
- **Unique Constraints**: `eventId` (guarantees n8n event idempotency)
- **Fields**: `eventId`, `eventType`, `targetSystem`, `payloadJson`, `status`, `attempts`, `executionId`, `responseStatus`, `responseBody`, `lastError`, `lastAttemptAt`, `createdAt`, `updatedAt`

### 17. `WhatsAppMessageLog`
- **Primary Key**: `id` (`String`, CUID)
- **Unique Constraints**: `eventId` (optional idempotency key for automated notifications)
- **Fields**: `eventId`, `recipientPhone`, `templateKey`, `templateName`, `messageBody`, `appointmentId`, `status`, `provider`, `externalMessageId`, `webhookVerified`, `deliveredAt`, `errorMessage`, `createdAt`

### 18. `AuditLog`
- **Primary Key**: `id` (`String`, CUID)
- **Foreign Keys**: `actorUserId` → `User.id`
- **Indexes**: `@@index([resourceType, createdAt])`
- **Fields**: `actorRole`, `action`, `resourceType`, `resourceId`, `summary`, `metadataJson`, `ipAddress`, `createdAt`
