-- Add column "app_suspended_at" to table: "integrations"
ALTER TABLE `integrations` ADD COLUMN `app_suspended_at` text NULL;
