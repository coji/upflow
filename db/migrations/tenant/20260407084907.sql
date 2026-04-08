-- Add column "github_installation_id" to table: "repositories"
ALTER TABLE `repositories` ADD COLUMN `github_installation_id` integer NULL;
-- Create index "repositories_github_installation_id_idx" to table: "repositories"
CREATE INDEX `repositories_github_installation_id_idx` ON `repositories` (`github_installation_id`);
-- Create "repository_installation_memberships" table
CREATE TABLE `repository_installation_memberships` (
  `repository_id` text NOT NULL,
  `installation_id` integer NOT NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  `deleted_at` text NULL,
  PRIMARY KEY (`repository_id`, `installation_id`),
  CONSTRAINT `repository_installation_memberships_repository_id_fkey` FOREIGN KEY (`repository_id`) REFERENCES `repositories` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "repository_installation_memberships_installation_id_idx" to table: "repository_installation_memberships"
CREATE INDEX `repository_installation_memberships_installation_id_idx` ON `repository_installation_memberships` (`installation_id`);
