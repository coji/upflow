-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create "new_organizations" table
CREATE TABLE `new_organizations` (
  `id` text NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `logo` text NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `metadata` text NULL,
  PRIMARY KEY (`id`)
);
-- Backfill slug from id for any rows where slug is null
UPDATE `organizations` SET `slug` = `id` WHERE `slug` IS NULL;
-- Copy rows from old table "organizations" to new temporary table "new_organizations"
INSERT INTO `new_organizations` (`id`, `name`, `slug`, `logo`, `created_at`, `metadata`) SELECT `id`, `name`, `slug`, `logo`, `created_at`, `metadata` FROM `organizations`;
-- Drop "organizations" table after copying rows
DROP TABLE `organizations`;
-- Rename temporary table "new_organizations" to "organizations"
ALTER TABLE `new_organizations` RENAME TO `organizations`;
-- Create index "organizations_slug_key" to table: "organizations"
CREATE UNIQUE INDEX `organizations_slug_key` ON `organizations` (`slug`);
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
