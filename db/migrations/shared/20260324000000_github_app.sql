-- Create "integrations" table (moved from tenant DB to shared DB)
CREATE TABLE `integrations` (
  `id` text NOT NULL,
  `organization_id` text NOT NULL,
  `provider` text NOT NULL DEFAULT 'github',
  `method` text NOT NULL DEFAULT 'token',
  `private_token` text NULL,
  `app_suspended_at` text NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (`id`),
  CONSTRAINT `integrations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "integrations_organization_id_key" to table: "integrations"
CREATE UNIQUE INDEX `integrations_organization_id_key` ON `integrations` (`organization_id`);
-- Create "github_app_links" table
CREATE TABLE `github_app_links` (
  `organization_id` text NOT NULL,
  `installation_id` integer NOT NULL,
  `github_account_id` integer NOT NULL,
  `github_org` text NOT NULL,
  `app_repository_selection` text NOT NULL DEFAULT 'all',
  `deleted_at` text NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (`organization_id`),
  CONSTRAINT `github_app_links_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "github_app_links_installation_id_key" to table: "github_app_links"
CREATE UNIQUE INDEX `github_app_links_installation_id_key` ON `github_app_links` (`installation_id`);
-- Create index "github_app_links_github_account_id_key" to table: "github_app_links"
CREATE UNIQUE INDEX `github_app_links_github_account_id_key` ON `github_app_links` (`github_account_id`);
