-- Create "users" table
CREATE TABLE `users` (
  `id` text NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `email_verified` boolean NOT NULL,
  `image` text NULL,
  `role` text NOT NULL,
  `banned` boolean NULL,
  `ban_reason` text NULL,
  `ban_expires` datetime NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
);
-- Create index "users_email_key" to table: "users"
CREATE UNIQUE INDEX `users_email_key` ON `users` (`email`);
-- Create "organizations" table
CREATE TABLE `organizations` (
  `id` text NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `logo` text NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `metadata` text NULL,
  PRIMARY KEY (`id`)
);
-- Create index "organizations_slug_key" to table: "organizations"
CREATE UNIQUE INDEX `organizations_slug_key` ON `organizations` (`slug`);
-- Create "sessions" table
CREATE TABLE `sessions` (
  `id` text NOT NULL,
  `expires_at` datetime NOT NULL,
  `token` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `ip_address` text NULL,
  `user_agent` text NULL,
  `user_id` text NOT NULL,
  `impersonated_by` text NULL,
  `active_organization_id` text NULL,
  `active_team_id` text NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "sessions_token_key" to table: "sessions"
CREATE UNIQUE INDEX `sessions_token_key` ON `sessions` (`token`);
-- Create "accounts" table
CREATE TABLE `accounts` (
  `id` text NOT NULL,
  `account_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `user_id` text NOT NULL,
  `access_token` text NULL,
  `refresh_token` text NULL,
  `id_token` text NULL,
  `access_token_expires_at` datetime NULL,
  `refresh_token_expires_at` datetime NULL,
  `scope` text NULL,
  `password` text NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create "verifications" table
CREATE TABLE `verifications` (
  `id` text NOT NULL,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NULL,
  `updated_at` datetime NULL,
  PRIMARY KEY (`id`)
);
-- Create "members" table
CREATE TABLE `members` (
  `id` text NOT NULL,
  `organization_id` text NOT NULL,
  `user_id` text NOT NULL,
  `role` text NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `members_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create "invitations" table
CREATE TABLE `invitations` (
  `id` text NOT NULL,
  `organization_id` text NOT NULL,
  `email` text NOT NULL,
  `role` text NULL,
  `status` text NOT NULL,
  `expires_at` datetime NOT NULL,
  `inviter_id` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `team_id` text NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `invitations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `invitations_inviter_id_fkey` FOREIGN KEY (`inviter_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `invitations_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
);
-- Create "teams" table
CREATE TABLE `teams` (
  `id` text NOT NULL,
  `name` text NOT NULL,
  `organization_id` text NOT NULL,
  `created_at` date NOT NULL,
  `updated_at` date NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `teams_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "teams_organization_id_idx" to table: "teams"
CREATE INDEX `teams_organization_id_idx` ON `teams` (`organization_id`);
-- Create "team_members" table
CREATE TABLE `team_members` (
  `id` text NOT NULL,
  `team_id` text NOT NULL,
  `user_id` text NOT NULL,
  `created_at` date NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `team_members_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "team_members_team_id_idx" to table: "team_members"
CREATE INDEX `team_members_team_id_idx` ON `team_members` (`team_id`);
-- Create index "team_members_user_id_idx" to table: "team_members"
CREATE INDEX `team_members_user_id_idx` ON `team_members` (`user_id`);
-- Create "integrations" table
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
-- Create index "github_app_links_installation_id_key" to table: "github_app_links"
CREATE UNIQUE INDEX `github_app_links_installation_id_key` ON `github_app_links` (`installation_id`);
-- Create index "github_app_links_github_account_id_idx" to table: "github_app_links"
CREATE INDEX `github_app_links_github_account_id_idx` ON `github_app_links` (`github_account_id`);
-- Create "github_app_link_events" table (audit log for installation lifecycle events)
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
-- Create "github_app_install_states" table (GitHub App install flow nonce)
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
