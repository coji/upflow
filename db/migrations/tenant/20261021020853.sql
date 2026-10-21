-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create "new_pr_title_filters" table
CREATE TABLE `new_pr_title_filters` (
  `id` text NOT NULL,
  `target` text NOT NULL DEFAULT 'title',
  `pattern` text NOT NULL,
  `normalized_pattern` text NOT NULL,
  `is_enabled` integer NOT NULL DEFAULT 1,
  `created_by` text NOT NULL,
  `updated_by` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (`id`),
  CHECK (`target` IN ('title', 'branch'))
);
-- Copy rows from old table "pr_title_filters" to new temporary table "new_pr_title_filters"
INSERT INTO `new_pr_title_filters` (`id`, `pattern`, `normalized_pattern`, `is_enabled`, `created_by`, `updated_by`, `created_at`, `updated_at`) SELECT `id`, `pattern`, `normalized_pattern`, `is_enabled`, `created_by`, `updated_by`, `created_at`, `updated_at` FROM `pr_title_filters`;
-- Drop "pr_title_filters" table after copying rows
DROP TABLE `pr_title_filters`;
-- Rename temporary table "new_pr_title_filters" to "pr_title_filters"
ALTER TABLE `new_pr_title_filters` RENAME TO `pr_title_filters`;
-- Create index "pr_title_filters_target_normalized_pattern_key" to table: "pr_title_filters"
CREATE UNIQUE INDEX `pr_title_filters_target_normalized_pattern_key` ON `pr_title_filters` (`target`, `normalized_pattern`);
-- Create index "pr_title_filters_is_enabled_idx" to table: "pr_title_filters"
CREATE INDEX `pr_title_filters_is_enabled_idx` ON `pr_title_filters` (`is_enabled`);
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
