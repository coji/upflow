-- Add column "is_active" to table: "company_github_users"
ALTER TABLE `company_github_users` ADD COLUMN `is_active` integer NOT NULL DEFAULT 0;
-- Existing records were admin-registered, so activate them
UPDATE `company_github_users` SET `is_active` = 1;
