-- Add column "refresh_requested_at" to table: "organization_settings"
ALTER TABLE `organization_settings` ADD COLUMN `refresh_requested_at` datetime NULL;
