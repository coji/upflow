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
-- Create "organization_settings" table
CREATE TABLE `organization_settings` (
  `id` text NOT NULL,
  `organization_id` text NOT NULL,
  `release_detection_method` text NOT NULL DEFAULT 'branch',
  `release_detection_key` text NOT NULL DEFAULT 'production',
  `is_active` boolean NOT NULL DEFAULT true,
  `excluded_users` text NOT NULL DEFAULT '',
  `refresh_requested_at` datetime NULL,
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
  CONSTRAINT `repositories_integration_id_fkey` FOREIGN KEY (`integration_id`) REFERENCES `integrations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `repositories_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
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
  `additions` integer NULL,
  `deletions` integer NULL,
  `changed_files` integer NULL,
  PRIMARY KEY (`number`, `repository_id`),
  CONSTRAINT `pull_requests_repository_id_fkey` FOREIGN KEY (`repository_id`) REFERENCES `repositories` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create "pull_request_reviews" table
CREATE TABLE `pull_request_reviews` (
  `id` text NOT NULL,
  `pull_request_number` integer NOT NULL,
  `repository_id` text NOT NULL,
  `reviewer` text NOT NULL,
  `state` text NOT NULL,
  `submitted_at` text NOT NULL,
  `url` text NOT NULL,
  CONSTRAINT `pull_request_reviews_pk` PRIMARY KEY (`id`),
  CONSTRAINT `pull_request_reviews_pr_fkey` FOREIGN KEY (`pull_request_number`, `repository_id`) REFERENCES `pull_requests` (`number`, `repository_id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "pull_request_reviews_pr_idx" to table: "pull_request_reviews"
CREATE INDEX `pull_request_reviews_pr_idx` ON `pull_request_reviews` (`pull_request_number`, `repository_id`);
-- Create "pull_request_reviewers" table
CREATE TABLE `pull_request_reviewers` (
  `pull_request_number` integer NOT NULL,
  `repository_id` text NOT NULL,
  `reviewer` text NOT NULL,
  `requested_at` text NULL,
  CONSTRAINT `pull_request_reviewers_pk` PRIMARY KEY (`pull_request_number`, `repository_id`, `reviewer`),
  CONSTRAINT `pull_request_reviewers_pr_fkey` FOREIGN KEY (`pull_request_number`, `repository_id`) REFERENCES `pull_requests` (`number`, `repository_id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create "company_github_users" table
CREATE TABLE `company_github_users` (
  `user_id` text NULL,
  `login` text NOT NULL,
  `name` text NULL,
  `email` text NULL,
  `display_name` text NOT NULL,
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `organization_id` text NOT NULL,
  PRIMARY KEY (`login`, `organization_id`),
  CONSTRAINT `company_github_users_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "company_github_users_organization_id_idx" to table: "company_github_users"
CREATE INDEX `company_github_users_organization_id_idx` ON `company_github_users` (`organization_id`);
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
-- Create "jwks" table (better-auth jwt plugin)
CREATE TABLE `jwks` (
  `id` text NOT NULL,
  `public_key` text NOT NULL,
  `private_key` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `expires_at` datetime NULL,
  PRIMARY KEY (`id`)
);
-- Create "oauth_client" table (@better-auth/oauth-provider)
CREATE TABLE `oauth_client` (
  `id` text NOT NULL,
  `client_id` text NOT NULL,
  `client_secret` text NULL,
  `name` text NULL,
  `icon` text NULL,
  `uri` text NULL,
  `contacts` text NULL,
  `tos` text NULL,
  `policy` text NULL,
  `software_id` text NULL,
  `software_version` text NULL,
  `software_statement` text NULL,
  `redirect_uris` text NOT NULL,
  `post_logout_redirect_uris` text NULL,
  `token_endpoint_auth_method` text NULL,
  `grant_types` text NULL,
  `response_types` text NULL,
  `scopes` text NULL,
  `type` text NULL,
  `public` boolean NULL,
  `require_pkce` boolean NULL,
  `disabled` boolean NULL DEFAULT false,
  `skip_consent` boolean NULL,
  `enable_end_session` boolean NULL,
  `subject_type` text NULL,
  `reference_id` text NULL,
  `metadata` text NULL,
  `user_id` text NULL,
  `created_at` datetime NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `oauth_client_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE UNIQUE INDEX `oauth_client_client_id_key` ON `oauth_client` (`client_id`);
-- Create "oauth_access_token" table (@better-auth/oauth-provider)
CREATE TABLE `oauth_access_token` (
  `id` text NOT NULL,
  `token` text NOT NULL,
  `client_id` text NOT NULL,
  `session_id` text NULL,
  `user_id` text NULL,
  `reference_id` text NULL,
  `refresh_id` text NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `scopes` text NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `oauth_access_token_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_client` (`client_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `oauth_access_token_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `oauth_access_token_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE UNIQUE INDEX `oauth_access_token_token_key` ON `oauth_access_token` (`token`);
-- Create "oauth_refresh_token" table (@better-auth/oauth-provider)
CREATE TABLE `oauth_refresh_token` (
  `id` text NOT NULL,
  `token` text NOT NULL,
  `client_id` text NOT NULL,
  `session_id` text NULL,
  `user_id` text NOT NULL,
  `reference_id` text NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `revoked` datetime NULL,
  `auth_time` datetime NULL,
  `scopes` text NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `oauth_refresh_token_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_client` (`client_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `oauth_refresh_token_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `oauth_refresh_token_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
);
-- Create "oauth_consent" table (@better-auth/oauth-provider)
CREATE TABLE `oauth_consent` (
  `id` text NOT NULL,
  `client_id` text NOT NULL,
  `user_id` text NULL,
  `reference_id` text NULL,
  `scopes` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `oauth_consent_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_client` (`client_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `oauth_consent_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
