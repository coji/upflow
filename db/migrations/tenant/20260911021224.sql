-- Add column "is_draft" to table: "pull_requests"
ALTER TABLE `pull_requests` ADD COLUMN `is_draft` integer NOT NULL DEFAULT 0;
