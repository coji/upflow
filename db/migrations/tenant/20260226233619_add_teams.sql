-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create "new_repositories" table
CREATE TABLE `new_repositories` (
  `id` text NOT NULL,
  `integration_id` text NOT NULL,
  `provider` text NOT NULL,
  `owner` text NOT NULL,
  `repo` text NOT NULL,
  `release_detection_method` text NOT NULL DEFAULT 'branch',
  `release_detection_key` text NOT NULL DEFAULT 'production',
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `team_id` text NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `repositories_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `repositories_integration_id_fkey` FOREIGN KEY (`integration_id`) REFERENCES `integrations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Copy rows from old table "repositories" to new temporary table "new_repositories"
INSERT INTO `new_repositories` (`id`, `integration_id`, `provider`, `owner`, `repo`, `release_detection_method`, `release_detection_key`, `updated_at`, `created_at`) SELECT `id`, `integration_id`, `provider`, `owner`, `repo`, `release_detection_method`, `release_detection_key`, `updated_at`, `created_at` FROM `repositories`;
-- Drop "repositories" table after copying rows
DROP TABLE `repositories`;
-- Rename temporary table "new_repositories" to "repositories"
ALTER TABLE `new_repositories` RENAME TO `repositories`;
-- Create index "repositories_integration_id_owner_repo_key" to table: "repositories"
CREATE UNIQUE INDEX `repositories_integration_id_owner_repo_key` ON `repositories` (`integration_id`, `owner`, `repo`);
-- Create "teams" table
CREATE TABLE `teams` (
  `id` text NOT NULL,
  `name` text NOT NULL,
  `display_order` integer NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`)
);
-- Create index "teams_name_key" to table: "teams"
CREATE UNIQUE INDEX `teams_name_key` ON `teams` (`name`);
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
