-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create "new_github_app_links" table
CREATE TABLE `new_github_app_links` (
  `organization_id` text NOT NULL,
  `installation_id` integer NOT NULL,
  `github_account_id` integer NOT NULL,
  `github_org` text NOT NULL,
  `github_account_type` text NULL,
  `app_repository_selection` text NOT NULL DEFAULT 'all',
  `suspended_at` text NULL,
  `membership_initialized_at` text NULL,
  `deleted_at` text NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (`organization_id`, `installation_id`),
  CONSTRAINT `github_app_links_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Copy rows from old table "github_app_links" to new temporary table "new_github_app_links"
INSERT INTO `new_github_app_links` (`organization_id`, `installation_id`, `github_account_id`, `github_org`, `app_repository_selection`, `deleted_at`, `created_at`, `updated_at`) SELECT `organization_id`, `installation_id`, `github_account_id`, `github_org`, `app_repository_selection`, `deleted_at`, `created_at`, `updated_at` FROM `github_app_links`;
-- Drop "github_app_links" table after copying rows
DROP TABLE `github_app_links`;
-- Rename temporary table "new_github_app_links" to "github_app_links"
ALTER TABLE `new_github_app_links` RENAME TO `github_app_links`;
-- Create index "github_app_links_installation_id_key" to table: "github_app_links"
CREATE UNIQUE INDEX `github_app_links_installation_id_key` ON `github_app_links` (`installation_id`);
-- Create index "github_app_links_github_account_id_idx" to table: "github_app_links"
CREATE INDEX `github_app_links_github_account_id_idx` ON `github_app_links` (`github_account_id`);
-- Create "github_app_link_events" table
CREATE TABLE `github_app_link_events` (
  `id` integer NOT NULL,
  `organization_id` text NOT NULL,
  `installation_id` integer NOT NULL,
  `event_type` text NOT NULL,
  `source` text NOT NULL,
  `status` text NOT NULL,
  `details_json` text NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (`id`)
);
-- Create index "github_app_link_events_org_created_idx" to table: "github_app_link_events"
CREATE INDEX `github_app_link_events_org_created_idx` ON `github_app_link_events` (`organization_id`, `created_at`);
-- Create index "github_app_link_events_installation_idx" to table: "github_app_link_events"
CREATE INDEX `github_app_link_events_installation_idx` ON `github_app_link_events` (`installation_id`);
-- Create index "github_app_link_events_event_type_idx" to table: "github_app_link_events"
CREATE INDEX `github_app_link_events_event_type_idx` ON `github_app_link_events` (`event_type`);
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
