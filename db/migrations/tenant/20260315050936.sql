-- Add column "timezone" to table: "organization_settings"
ALTER TABLE `organization_settings` ADD COLUMN `timezone` text NOT NULL DEFAULT 'Asia/Tokyo';
