-- Add column "member_count" to table: "teams"
ALTER TABLE `teams` ADD COLUMN `member_count` integer NOT NULL DEFAULT 0;
-- Add column "membership_key" to table: "team_members"
ALTER TABLE `team_members` ADD COLUMN `membership_key` text NULL;
-- Create index "team_members_membership_key_key" to table: "team_members"
CREATE UNIQUE INDEX `team_members_membership_key_key` ON `team_members` (`membership_key`);
-- Initialize counters for existing teams; membership keys remain nullable for
-- legacy rows (Better Auth falls back to the team/user pair when reading them).
UPDATE `teams` SET `member_count` = (
  SELECT COUNT(*) FROM `team_members` WHERE `team_id` = `teams`.`id`
);
