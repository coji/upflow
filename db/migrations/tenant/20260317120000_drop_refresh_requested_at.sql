-- Drop column "refresh_requested_at" from table: "organization_settings"
-- Refresh scheduling is now handled directly via durably jobs instead of DB flag polling
ALTER TABLE `organization_settings` DROP COLUMN `refresh_requested_at`;
