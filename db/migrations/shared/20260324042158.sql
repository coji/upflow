-- Create "github_app_install_states" table
CREATE TABLE `github_app_install_states` (
  `id` text NOT NULL,
  `organization_id` text NOT NULL,
  `nonce` text NOT NULL,
  `expires_at` text NOT NULL,
  `consumed_at` text NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (`id`),
  CONSTRAINT `github_app_install_states_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "github_app_install_states_nonce_key" to table: "github_app_install_states"
CREATE UNIQUE INDEX `github_app_install_states_nonce_key` ON `github_app_install_states` (`nonce`);
