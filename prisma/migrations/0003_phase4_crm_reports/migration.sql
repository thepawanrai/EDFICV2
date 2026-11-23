-- Phase 4: CRM Stages & Appointment Linking Migration (MySQL 8.x)

ALTER TABLE `CrmLead`
  MODIFY COLUMN `status` ENUM(
    'NEW',
    'CONTACTED',
    'INFORMATION_PROVIDED',
    'APPOINTMENT_REQUESTED',
    'APPOINTMENT_CONFIRMED',
    'VISITED',
    'FOLLOW_UP',
    'SCHEDULED',
    'CONVERTED',
    'CLOSED'
  ) NOT NULL DEFAULT 'NEW',
  ADD COLUMN `linkedAppointmentId` VARCHAR(191) NULL AFTER `convertedPatientId`;

ALTER TABLE `CrmLead`
  ADD INDEX `CrmLead_linkedAppointmentId_idx` (`linkedAppointmentId`),
  ADD CONSTRAINT `CrmLead_linkedAppointmentId_fkey`
    FOREIGN KEY (`linkedAppointmentId`) REFERENCES `Appointment`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
