-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create "new_pull_requests" table
CREATE TABLE `new_pull_requests` (
  `repo` text NOT NULL,
  `number` integer NOT NULL,
  `source_branch` text NOT NULL,
  `target_branch` text NOT NULL,
  `state` text NOT NULL,
  `author` text NOT NULL,
  `title` text NOT NULL,
  `url` text NOT NULL,
  `first_committed_at` text NULL,
  `pull_request_created_at` text NOT NULL,
  `first_reviewed_at` text NULL,
  `merged_at` text NULL,
  `closed_at` text NULL,
  `released_at` text NULL,
  `coding_time` real NULL,
  `pickup_time` real NULL,
  `review_time` real NULL,
  `deploy_time` real NULL,
  `total_time` real NULL,
  `repository_id` text NOT NULL,
  `updated_at` text NULL,
  `additions` integer NULL,
  `deletions` integer NULL,
  `changed_files` integer NULL,
  `complexity` text NULL,
  `complexity_reason` text NULL,
  `risk_areas` text NULL,
  `classified_at` text NULL,
  `classifier_model` text NULL,
  `pr_type` text NULL,
  `pr_type_warning` text NULL,
  PRIMARY KEY (`number`, `repository_id`),
  CONSTRAINT `pull_requests_repository_id_fkey` FOREIGN KEY (`repository_id`) REFERENCES `repositories` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CHECK (`pr_type` IS NULL OR `pr_type` IN ('release', 'template-merge', 'dependency', 'normal')),
  CHECK (`pr_type_warning` IS NULL OR `pr_type_warning` IN ('signal-conflict'))
);
-- Copy rows from old table "pull_requests" to new temporary table "new_pull_requests"
INSERT INTO `new_pull_requests` (`repo`, `number`, `source_branch`, `target_branch`, `state`, `author`, `title`, `url`, `first_committed_at`, `pull_request_created_at`, `first_reviewed_at`, `merged_at`, `closed_at`, `released_at`, `coding_time`, `pickup_time`, `review_time`, `deploy_time`, `total_time`, `repository_id`, `updated_at`, `additions`, `deletions`, `changed_files`, `complexity`, `complexity_reason`, `risk_areas`, `classified_at`, `classifier_model`) SELECT `repo`, `number`, `source_branch`, `target_branch`, `state`, `author`, `title`, `url`, `first_committed_at`, `pull_request_created_at`, `first_reviewed_at`, `merged_at`, `closed_at`, `released_at`, `coding_time`, `pickup_time`, `review_time`, `deploy_time`, `total_time`, `repository_id`, `updated_at`, `additions`, `deletions`, `changed_files`, `complexity`, `complexity_reason`, `risk_areas`, `classified_at`, `classifier_model` FROM `pull_requests`;
-- Drop "pull_requests" table after copying rows
DROP TABLE `pull_requests`;
-- Rename temporary table "new_pull_requests" to "pull_requests"
ALTER TABLE `new_pull_requests` RENAME TO `pull_requests`;
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
