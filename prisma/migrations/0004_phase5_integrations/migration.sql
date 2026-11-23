-- Phase 5: n8n, WhatsApp Business API & Hermes Agent Integration Migration (MySQL 8.x)

ALTER TABLE `ClinicSetting`
  ADD COLUMN `n8nApiKey` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `n8nConnectionStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN `n8nLastCheckedAt` DATETIME(3) NULL,
  ADD COLUMN `whatsappAccessToken` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `whatsappWebhookSecret` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `whatsappTemplatesJson` TEXT NOT NULL,
  ADD COLUMN `whatsappConnectionStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN `whatsappLastCheckedAt` DATETIME(3) NULL;

ALTER TABLE `WebhookEvent`
  ADD COLUMN `executionId` VARCHAR(191) NULL,
  ADD COLUMN `responseBody` TEXT NULL,
  ADD COLUMN `lastAttemptAt` DATETIME(3) NULL;

ALTER TABLE `WhatsAppMessageLog`
  ADD COLUMN `eventId` VARCHAR(191) NULL,
  ADD COLUMN `templateName` VARCHAR(191) NULL,
  ADD COLUMN `webhookVerified` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `deliveredAt` DATETIME(3) NULL,
  ADD UNIQUE INDEX `WhatsAppMessageLog_eventId_key`(`eventId`);
