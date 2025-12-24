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
-- Create "organizations" table
CREATE TABLE `organizations` (
  `id` text NOT NULL,
  `name` text NOT NULL,
  `slug` text NULL,
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
  CONSTRAINT `members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `members_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
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
  PRIMARY KEY (`id`),
  CONSTRAINT `invitations_inviter_id_fkey` FOREIGN KEY (`inviter_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `invitations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create "organization_settings" table
CREATE TABLE `organization_settings` (
  `id` text NOT NULL,
  `organization_id` text NOT NULL,
  `release_detection_method` text NOT NULL DEFAULT 'branch',
  `release_detection_key` text NOT NULL DEFAULT 'production',
  `is_active` boolean NOT NULL DEFAULT true,
  `excluded_users` text NOT NULL DEFAULT '',
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `organization_settings_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "organization_settings_organization_id_key" to table: "organization_settings"
CREATE UNIQUE INDEX `organization_settings_organization_id_key` ON `organization_settings` (`organization_id`);
-- Create "export_settings" table
CREATE TABLE `export_settings` (
  `id` text NOT NULL,
  `sheet_id` text NOT NULL,
  `client_email` text NOT NULL,
  `private_key` text NOT NULL,
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `organization_id` text NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `export_settings_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "export_settings_organization_id_key" to table: "export_settings"
CREATE UNIQUE INDEX `export_settings_organization_id_key` ON `export_settings` (`organization_id`);
-- Create "integrations" table
CREATE TABLE `integrations` (
  `id` text NOT NULL,
  `provider` text NOT NULL,
  `method` text NOT NULL,
  `private_token` text NULL,
  `organization_id` text NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `integrations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "integrations_organization_id_key" to table: "integrations"
CREATE UNIQUE INDEX `integrations_organization_id_key` ON `integrations` (`organization_id`);
-- Create index "integrations_organization_id_idx" to table: "integrations"
CREATE INDEX `integrations_organization_id_idx` ON `integrations` (`organization_id`);
-- Create "repositories" table
CREATE TABLE `repositories` (
  `id` text NOT NULL,
  `integration_id` text NOT NULL,
  `provider` text NOT NULL,
  `owner` text NOT NULL,
  `repo` text NOT NULL,
  `release_detection_method` text NOT NULL DEFAULT 'branch',
  `release_detection_key` text NOT NULL DEFAULT 'production',
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `organization_id` text NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `repositories_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `repositories_integration_id_fkey` FOREIGN KEY (`integration_id`) REFERENCES `integrations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "repositories_organization_id_idx" to table: "repositories"
CREATE INDEX `repositories_organization_id_idx` ON `repositories` (`organization_id`);
-- Create index "repositories_organization_id_integration_id_owner_repo_key" to table: "repositories"
CREATE UNIQUE INDEX `repositories_organization_id_integration_id_owner_repo_key` ON `repositories` (`organization_id`, `integration_id`, `owner`, `repo`);
-- Create "pull_requests" table
CREATE TABLE `pull_requests` (
  `repo` text NOT NULL,
  `number` integer NOT NULL,
  `source_branch` text NOT NULL,
  `target_branch` text NOT NULL,
  `state` text NOT NULL,
  `author` text NOT NULL,
  `title` text NOT NULL,
  `url` text NOT NULL,
  `first_committed_at` text NULL,
  `pull_request_created_at` text NOT NULL,
  `first_reviewed_at` text NULL,
  `merged_at` text NULL,
  `released_at` text NULL,
  `coding_time` real NULL,
  `pickup_time` real NULL,
  `review_time` real NULL,
  `deploy_time` real NULL,
  `total_time` real NULL,
  `repository_id` text NOT NULL,
  `updated_at` text NULL,
  PRIMARY KEY (`number`, `repository_id`),
  CONSTRAINT `pull_requests_repository_id_fkey` FOREIGN KEY (`repository_id`) REFERENCES `repositories` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create "company_github_users" table
CREATE TABLE `company_github_users` (
  `user_id` text NULL,
  `login` text NOT NULL,
  `name` text NULL,
  `email` text NULL,
  `picture_url` text NULL,
  `display_name` text NOT NULL,
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `organization_id` text NOT NULL,
  PRIMARY KEY (`login`, `organization_id`),
  CONSTRAINT `company_github_users_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "company_github_users_organization_id_idx" to table: "company_github_users"
CREATE INDEX `company_github_users_organization_id_idx` ON `company_github_users` (`organization_id`);
