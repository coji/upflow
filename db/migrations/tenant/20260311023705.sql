-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create "new_pull_request_feedbacks" table
CREATE TABLE `new_pull_request_feedbacks` (
  `pull_request_number` integer NOT NULL,
  `repository_id` text NOT NULL,
  `original_complexity` text NULL,
  `corrected_complexity` text NOT NULL,
  `reason` text NULL,
  `created_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`pull_request_number`, `repository_id`),
  CONSTRAINT `0` FOREIGN KEY (`pull_request_number`, `repository_id`) REFERENCES `pull_requests` (`number`, `repository_id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Copy rows from old table "pull_request_feedbacks" to new temporary table "new_pull_request_feedbacks"
INSERT INTO `new_pull_request_feedbacks` (`pull_request_number`, `repository_id`, `original_complexity`, `corrected_complexity`, `reason`, `created_at`, `updated_at`) SELECT `pull_request_number`, `repository_id`, `original_complexity`, `corrected_complexity`, `reason`, `created_at`, `updated_at` FROM `pull_request_feedbacks`;
-- Drop "pull_request_feedbacks" table after copying rows
DROP TABLE `pull_request_feedbacks`;
-- Rename temporary table "new_pull_request_feedbacks" to "pull_request_feedbacks"
ALTER TABLE `new_pull_request_feedbacks` RENAME TO `pull_request_feedbacks`;
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
