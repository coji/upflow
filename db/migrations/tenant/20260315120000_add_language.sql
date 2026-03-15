-- Add column "language" to table: "organization_settings"
ALTER TABLE `organization_settings` ADD COLUMN `language` text NOT NULL DEFAULT 'en';
