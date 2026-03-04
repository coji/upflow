-- Add column "complexity" to table: "pull_requests"
ALTER TABLE `pull_requests` ADD COLUMN `complexity` text NULL;
-- Add column "complexity_reason" to table: "pull_requests"
ALTER TABLE `pull_requests` ADD COLUMN `complexity_reason` text NULL;
-- Add column "risk_areas" to table: "pull_requests"
ALTER TABLE `pull_requests` ADD COLUMN `risk_areas` text NULL;
-- Add column "classified_at" to table: "pull_requests"
ALTER TABLE `pull_requests` ADD COLUMN `classified_at` text NULL;
-- Add column "classifier_model" to table: "pull_requests"
ALTER TABLE `pull_requests` ADD COLUMN `classifier_model` text NULL;
