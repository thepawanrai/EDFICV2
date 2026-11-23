-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `role` ENUM('SUPER_ADMIN', 'RECEPTION', 'DOCTOR', 'ACCOUNTS', 'MARKETING_MANAGER', 'PATIENT') NOT NULL DEFAULT 'PATIENT',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Patient` (
    `id` VARCHAR(191) NOT NULL,
    `patientCode` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `dateOfBirth` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `emergencyContact` VARCHAR(191) NULL,
    `referredBy` VARCHAR(191) NULL,
    `consentAccepted` BOOLEAN NOT NULL DEFAULT false,
    `consentTimestamp` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Patient_patientCode_key`(`patientCode`),
    UNIQUE INDEX `Patient_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceCategory` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isVisible` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `ServiceCategory_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiagnosticService` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `clinicalDescription` TEXT NOT NULL,
    `preparationNotes` TEXT NOT NULL,
    `durationMinutes` INTEGER NOT NULL DEFAULT 30,
    `requiresDoctorMorning` BOOLEAN NOT NULL DEFAULT false,
    `isVisiblePublic` BOOLEAN NOT NULL DEFAULT true,
    `approvalStatus` ENUM('DRAFT', 'MEDICAL_REVIEW', 'COMPLIANCE_REVIEW', 'FINAL_APPROVED', 'PUBLISHED') NOT NULL DEFAULT 'PUBLISHED',
    `advanceAmountInr` INTEGER NOT NULL DEFAULT 500,
    `internalBaseFeeInr` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DiagnosticService_slug_key`(`slug`),
    UNIQUE INDEX `DiagnosticService_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClinicSetting` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `clinicName` VARCHAR(191) NOT NULL DEFAULT 'EDFIC',
    `fullName` VARCHAR(191) NOT NULL DEFAULT 'EWA Diagnostic and Fetal Imaging Centre',
    `parentUnitName` VARCHAR(191) NOT NULL DEFAULT 'A Unit of EWA DERMA',
    `tagline` VARCHAR(191) NOT NULL DEFAULT 'Advanced Fetal Imaging & Diagnostic Services in Lucknow.',
    `addressLine` VARCHAR(191) NOT NULL DEFAULT 'Unit 10, Millennium Place, Sushant Golf City',
    `landmark` VARCHAR(191) NOT NULL DEFAULT 'Near Lulu Mall',
    `cityStateCountry` VARCHAR(191) NOT NULL DEFAULT 'Lucknow, Uttar Pradesh, India',
    `primaryPhone` VARCHAR(191) NOT NULL DEFAULT '',
    `secondaryPhone` VARCHAR(191) NOT NULL DEFAULT '',
    `whatsappNumber` VARCHAR(191) NOT NULL DEFAULT '',
    `officialEmail` VARCHAR(191) NOT NULL DEFAULT '',
    `weekdayHours` VARCHAR(191) NOT NULL DEFAULT 'Monday–Saturday: 9:00 AM – 8:00 PM',
    `sundayHours` VARCHAR(191) NOT NULL DEFAULT 'Sunday: 10:00 AM – 2:00 PM (By Appointment)',
    `slotDurationMinutes` INTEGER NOT NULL DEFAULT 30,
    `slotCapacityPerSlot` INTEGER NOT NULL DEFAULT 2,
    `morningSessionStart` VARCHAR(191) NOT NULL DEFAULT '09:30',
    `morningSessionEnd` VARCHAR(191) NOT NULL DEFAULT '13:30',
    `upiId` VARCHAR(191) NOT NULL DEFAULT 'edfic.lucknow@upi',
    `upiMerchantName` VARCHAR(191) NOT NULL DEFAULT 'EWA Diagnostic & Fetal Imaging Centre',
    `defaultAdvanceAmountInr` INTEGER NOT NULL DEFAULT 500,
    `n8nWebhookUrl` VARCHAR(191) NOT NULL DEFAULT '',
    `n8nWebhookSecret` VARCHAR(191) NOT NULL DEFAULT '',
    `whatsappProvider` VARCHAR(191) NOT NULL DEFAULT 'meta_cloud',
    `whatsappApiUrl` VARCHAR(191) NOT NULL DEFAULT '',
    `whatsappPhoneNumberId` VARCHAR(191) NOT NULL DEFAULT '',
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClinicHoliday` (
    `id` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `isFullDay` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ClinicHoliday_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SlotHold` (
    `id` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SlotHold_date_startTime_idx`(`date`, `startTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Appointment` (
    `id` VARCHAR(191) NOT NULL,
    `bookingReference` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NULL,
    `appointmentDate` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_ADVANCE', 'ADVANCE_SUBMITTED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'PENDING_ADVANCE',
    `patientName` VARCHAR(191) NOT NULL,
    `patientPhone` VARCHAR(191) NOT NULL,
    `patientEmail` VARCHAR(191) NULL,
    `clinicalIndication` TEXT NULL,
    `referringDoctor` VARCHAR(191) NULL,
    `isReceptionOverride` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `cancelledReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Appointment_bookingReference_key`(`bookingReference`),
    INDEX `Appointment_appointmentDate_startTime_idx`(`appointmentDate`, `startTime`),
    INDEX `Appointment_patientId_idx`(`patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `receiptNumber` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `expectedAdvanceInr` INTEGER NOT NULL,
    `amountSubmittedInr` INTEGER NOT NULL,
    `totalServiceFeeInr` INTEGER NOT NULL DEFAULT 0,
    `utrReference` VARCHAR(191) NOT NULL,
    `paymentDate` VARCHAR(191) NOT NULL,
    `evidenceFilePath` VARCHAR(191) NULL,
    `evidenceMimeType` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `verifiedById` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_receiptNumber_key`(`receiptNumber`),
    INDEX `Payment_status_idx`(`status`),
    INDEX `Payment_appointmentId_idx`(`appointmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Visit` (
    `id` VARCHAR(191) NOT NULL,
    `visitNumber` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NULL,
    `checkedInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `clinicalNotes` TEXT NULL,
    `status` ENUM('WAITING', 'IN_SCAN', 'COMPLETED') NOT NULL DEFAULT 'WAITING',

    UNIQUE INDEX `Visit_visitNumber_key`(`visitNumber`),
    UNIQUE INDEX `Visit_appointmentId_key`(`appointmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiagnosticReport` (
    `id` VARCHAR(191) NOT NULL,
    `reportCode` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `visitId` VARCHAR(191) NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `revisionNumber` INTEGER NOT NULL DEFAULT 1,
    `fileName` VARCHAR(191) NOT NULL,
    `storedFilePath` VARCHAR(191) NOT NULL,
    `fileSizeBytes` INTEGER NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'REVISED') NOT NULL DEFAULT 'DRAFT',
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DiagnosticReport_reportCode_key`(`reportCode`),
    INDEX `DiagnosticReport_patientId_status_idx`(`patientId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportDownloadLog` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `downloadedById` VARCHAR(191) NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `downloadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CrmLead` (
    `id` VARCHAR(191) NOT NULL,
    `leadCode` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `source` ENUM('WEBSITE_CONTACT', 'BOOKING_INQUIRY', 'WHATSAPP', 'REFERRAL', 'WALK_IN') NOT NULL DEFAULT 'WEBSITE_CONTACT',
    `interestedService` VARCHAR(191) NULL,
    `message` TEXT NULL,
    `status` ENUM('NEW', 'CONTACTED', 'FOLLOW_UP', 'SCHEDULED', 'CONVERTED', 'CLOSED') NOT NULL DEFAULT 'NEW',
    `assignedToId` VARCHAR(191) NULL,
    `followUpDueAt` DATETIME(3) NULL,
    `convertedPatientId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CrmLead_leadCode_key`(`leadCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CrmTask` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `dueAt` DATETIME(3) NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CmsContentItem` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `pageKey` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `contentMarkdown` LONGTEXT NOT NULL,
    `status` ENUM('DRAFT', 'MEDICAL_REVIEW', 'COMPLIANCE_REVIEW', 'FINAL_APPROVED', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `checklistNoPrice` BOOLEAN NOT NULL DEFAULT false,
    `checklistNoSexDetermination` BOOLEAN NOT NULL DEFAULT false,
    `checklistNoGuarantee` BOOLEAN NOT NULL DEFAULT false,
    `checklistNoFakeTestimonial` BOOLEAN NOT NULL DEFAULT false,
    `complianceIssues` TEXT NULL,
    `authorId` VARCHAR(191) NULL,
    `medicalReviewerName` VARCHAR(191) NULL,
    `complianceReviewerName` VARCHAR(191) NULL,
    `finalApproverName` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CmsContentItem_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `targetSystem` VARCHAR(191) NOT NULL,
    `payloadJson` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `responseStatus` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WebhookEvent_eventId_key`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsAppMessageLog` (
    `id` VARCHAR(191) NOT NULL,
    `recipientPhone` VARCHAR(191) NOT NULL,
    `templateKey` VARCHAR(191) NOT NULL,
    `messageBody` TEXT NOT NULL,
    `appointmentId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
    `provider` VARCHAR(191) NOT NULL,
    `externalMessageId` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `actorRole` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `resourceType` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `summary` TEXT NOT NULL,
    `metadataJson` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_resourceType_createdAt_idx`(`resourceType`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Patient` ADD CONSTRAINT `Patient_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiagnosticService` ADD CONSTRAINT `DiagnosticService_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ServiceCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SlotHold` ADD CONSTRAINT `SlotHold_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `DiagnosticService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `DiagnosticService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_verifiedById_fkey` FOREIGN KEY (`verifiedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visit` ADD CONSTRAINT `Visit_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visit` ADD CONSTRAINT `Visit_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visit` ADD CONSTRAINT `Visit_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiagnosticReport` ADD CONSTRAINT `DiagnosticReport_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiagnosticReport` ADD CONSTRAINT `DiagnosticReport_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiagnosticReport` ADD CONSTRAINT `DiagnosticReport_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiagnosticReport` ADD CONSTRAINT `DiagnosticReport_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportDownloadLog` ADD CONSTRAINT `ReportDownloadLog_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `DiagnosticReport`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportDownloadLog` ADD CONSTRAINT `ReportDownloadLog_downloadedById_fkey` FOREIGN KEY (`downloadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportDownloadLog` ADD CONSTRAINT `ReportDownloadLog_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrmLead` ADD CONSTRAINT `CrmLead_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrmLead` ADD CONSTRAINT `CrmLead_convertedPatientId_fkey` FOREIGN KEY (`convertedPatientId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrmTask` ADD CONSTRAINT `CrmTask_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `CrmLead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrmTask` ADD CONSTRAINT `CrmTask_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CmsContentItem` ADD CONSTRAINT `CmsContentItem_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

