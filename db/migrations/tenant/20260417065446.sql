-- Create "pr_title_filters" table
CREATE TABLE `pr_title_filters` (
  `id` text NOT NULL,
  `pattern` text NOT NULL,
  `normalized_pattern` text NOT NULL,
  `is_enabled` integer NOT NULL DEFAULT 1,
  `created_by` text NOT NULL,
  `updated_by` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (`id`)
);
-- Create index "pr_title_filters_normalized_pattern_key" to table: "pr_title_filters"
CREATE UNIQUE INDEX `pr_title_filters_normalized_pattern_key` ON `pr_title_filters` (`normalized_pattern`);
-- Create index "pr_title_filters_is_enabled_idx" to table: "pr_title_filters"
CREATE INDEX `pr_title_filters_is_enabled_idx` ON `pr_title_filters` (`is_enabled`);
