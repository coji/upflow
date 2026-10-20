-- Add column "processed_at" to table: "github_raw_data"
ALTER TABLE `github_raw_data` ADD COLUMN `processed_at` text NULL;
