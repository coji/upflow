-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create "new_integrations" table
CREATE TABLE `new_integrations` (
  `id` text NOT NULL,
  `organization_id` text NOT NULL,
  `provider` text NOT NULL DEFAULT 'github',
  `method` text NOT NULL DEFAULT 'token',
  `private_token` text NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (`id`),
  CONSTRAINT `integrations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Copy rows from old table "integrations" to new temporary table "new_integrations"
INSERT INTO `new_integrations` (`id`, `organization_id`, `provider`, `method`, `private_token`, `created_at`, `updated_at`) SELECT `id`, `organization_id`, `provider`, `method`, `private_token`, `created_at`, `updated_at` FROM `integrations`;
-- Drop "integrations" table after copying rows
DROP TABLE `integrations`;
-- Rename temporary table "new_integrations" to "integrations"
ALTER TABLE `new_integrations` RENAME TO `integrations`;
-- Create index "integrations_organization_id_key" to table: "integrations"
CREATE UNIQUE INDEX `integrations_organization_id_key` ON `integrations` (`organization_id`);
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
