-- Add column "personal_limit" to table: "teams"
ALTER TABLE `teams` ADD COLUMN `personal_limit` integer NOT NULL DEFAULT 2;
