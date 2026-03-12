-- Add updated_at column to github_raw_data for efficient latest-update lookup
-- without requiring JSON parsing of the pullRequest column.
ALTER TABLE `github_raw_data` ADD COLUMN `updated_at` text NULL;

-- Backfill from the JSON pullRequest column
UPDATE `github_raw_data` SET `updated_at` = json_extract(`pull_request`, '$.updatedAt');
