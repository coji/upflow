-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create "new_github_app_install_states" table
CREATE TABLE `new_github_app_install_states` (
  `id` text NOT NULL,
  `organization_id` text NOT NULL,
  `nonce` text NOT NULL,
  `created_by_user_id` text NULL,
  `claimed_by_user_id` text NULL,
  `claimed_at` text NULL,
  `intent_kind` text NOT NULL DEFAULT 'direct',
  `expires_at` text NOT NULL,
  `consumed_at` text NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (`id`),
  CONSTRAINT `github_app_install_states_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CHECK (`intent_kind` IN ('direct', 'handoff', 'legacy'))
);
-- Copy rows from old table "github_app_install_states" to new temporary table "new_github_app_install_states"
INSERT INTO `new_github_app_install_states` (`id`, `organization_id`, `nonce`, `intent_kind`, `expires_at`, `consumed_at`, `created_at`) SELECT `id`, `organization_id`, `nonce`, 'legacy', `expires_at`, `consumed_at`, `created_at` FROM `github_app_install_states`;
-- Drop "github_app_install_states" table after copying rows
DROP TABLE `github_app_install_states`;
-- Rename temporary table "new_github_app_install_states" to "github_app_install_states"
ALTER TABLE `new_github_app_install_states` RENAME TO `github_app_install_states`;
-- Create index "github_app_install_states_nonce_key" to table: "github_app_install_states"
CREATE UNIQUE INDEX `github_app_install_states_nonce_key` ON `github_app_install_states` (`nonce`);
-- Create "bootstrap_markers" table
CREATE TABLE `bootstrap_markers` (
  `key` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (`key`)
);
-- Existing deployments have already completed first-user bootstrap.
INSERT INTO `bootstrap_markers` (`key`)
SELECT 'initial_super_admin' WHERE EXISTS (SELECT 1 FROM `users`) OR EXISTS (SELECT 1 FROM `organizations`);
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
