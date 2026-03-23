-- Drop "integrations" table (moved to shared DB)
DROP TABLE IF EXISTS `integrations`;
-- Remove integrations FK from "repositories" (integrations is now in shared DB)
PRAGMA foreign_keys = off;
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
  CONSTRAINT `repositories_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
);
INSERT INTO `new_repositories` (`id`, `integration_id`, `provider`, `owner`, `repo`, `release_detection_method`, `release_detection_key`, `updated_at`, `created_at`, `team_id`) SELECT `id`, `integration_id`, `provider`, `owner`, `repo`, `release_detection_method`, `release_detection_key`, `updated_at`, `created_at`, `team_id` FROM `repositories`;
DROP TABLE `repositories`;
ALTER TABLE `new_repositories` RENAME TO `repositories`;
CREATE UNIQUE INDEX `repositories_integration_id_owner_repo_key` ON `repositories` (`integration_id`, `owner`, `repo`);
PRAGMA foreign_keys = on;
