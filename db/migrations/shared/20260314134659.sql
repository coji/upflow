-- Create "jwks" table
CREATE TABLE `jwks` (
  `id` text NOT NULL,
  `public_key` text NOT NULL,
  `private_key` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `expires_at` datetime NULL,
  PRIMARY KEY (`id`)
);
-- Create "oauth_client" table
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
-- Create index "oauth_client_client_id_key" to table: "oauth_client"
CREATE UNIQUE INDEX `oauth_client_client_id_key` ON `oauth_client` (`client_id`);
-- Create "oauth_access_token" table
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
  CONSTRAINT `oauth_access_token_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `oauth_access_token_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `oauth_access_token_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_client` (`client_id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "oauth_access_token_token_key" to table: "oauth_access_token"
CREATE UNIQUE INDEX `oauth_access_token_token_key` ON `oauth_access_token` (`token`);
-- Create "oauth_refresh_token" table
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
  CONSTRAINT `oauth_refresh_token_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `oauth_refresh_token_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `oauth_refresh_token_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_client` (`client_id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create "oauth_consent" table
CREATE TABLE `oauth_consent` (
  `id` text NOT NULL,
  `client_id` text NOT NULL,
  `user_id` text NULL,
  `reference_id` text NULL,
  `scopes` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `oauth_consent_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `oauth_consent_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_client` (`client_id`) ON UPDATE CASCADE ON DELETE CASCADE
);
