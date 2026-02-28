-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create "new_company_github_users" table
CREATE TABLE `new_company_github_users` (
  `user_id` text NULL,
  `login` text NOT NULL,
  `display_name` text NOT NULL,
  `is_active` integer NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`login`)
);
-- Copy rows from "company_github_users" to "new_company_github_users"
INSERT INTO `new_company_github_users` (`user_id`, `login`, `display_name`, `is_active`, `updated_at`, `created_at`)
  SELECT `user_id`, `login`, `display_name`, `is_active`, `updated_at`, `created_at` FROM `company_github_users`;
-- Drop "company_github_users" table after copying rows
DROP TABLE IF EXISTS `company_github_users`;
-- Rename table "new_company_github_users" to "company_github_users"
ALTER TABLE `new_company_github_users` RENAME TO `company_github_users`;
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
