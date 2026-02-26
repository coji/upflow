-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create index "users_email_key" to table: "users"
CREATE UNIQUE INDEX `users_email_key` ON `users` (`email`);
-- Add column "active_team_id" to table: "sessions"
ALTER TABLE `sessions` ADD COLUMN `active_team_id` text NULL;
-- Create "new_invitations" table
CREATE TABLE `new_invitations` (
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
  CONSTRAINT `invitations_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `invitations_inviter_id_fkey` FOREIGN KEY (`inviter_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `invitations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Copy rows from old table "invitations" to new temporary table "new_invitations"
INSERT INTO `new_invitations` (`id`, `organization_id`, `email`, `role`, `status`, `expires_at`, `inviter_id`) SELECT `id`, `organization_id`, `email`, `role`, `status`, `expires_at`, `inviter_id` FROM `invitations`;
-- Drop "invitations" table after copying rows
DROP TABLE `invitations`;
-- Rename temporary table "new_invitations" to "invitations"
ALTER TABLE `new_invitations` RENAME TO `invitations`;
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
  CONSTRAINT `team_members_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "team_members_team_id_idx" to table: "team_members"
CREATE INDEX `team_members_team_id_idx` ON `team_members` (`team_id`);
-- Create index "team_members_user_id_idx" to table: "team_members"
CREATE INDEX `team_members_user_id_idx` ON `team_members` (`user_id`);
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
