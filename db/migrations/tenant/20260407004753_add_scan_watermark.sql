-- Add column "scan_watermark" to table: "repositories"
ALTER TABLE `repositories` ADD COLUMN `scan_watermark` text NULL;
-- Backfill scan_watermark from existing raw data so next crawl does not re-fetch everything.
-- Historical data was produced by full-sweep crawls, so max(updated_at) is a valid watermark.
UPDATE `repositories`
SET `scan_watermark` = (
  SELECT MAX(`updated_at`)
  FROM `github_raw_data`
  WHERE `github_raw_data`.`repository_id` = `repositories`.`id`
);
