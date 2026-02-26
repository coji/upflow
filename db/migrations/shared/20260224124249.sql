-- Add column "additions" to table: "pull_requests"
ALTER TABLE `pull_requests` ADD COLUMN `additions` integer NULL;
-- Add column "deletions" to table: "pull_requests"
ALTER TABLE `pull_requests` ADD COLUMN `deletions` integer NULL;
-- Add column "changed_files" to table: "pull_requests"
ALTER TABLE `pull_requests` ADD COLUMN `changed_files` integer NULL;
-- Create "pull_request_reviews" table
CREATE TABLE `pull_request_reviews` (
  `id` text NOT NULL,
  `pull_request_number` integer NOT NULL,
  `repository_id` text NOT NULL,
  `reviewer` text NOT NULL,
  `state` text NOT NULL,
  `submitted_at` text NOT NULL,
  `url` text NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `pull_request_reviews_pr_fkey` FOREIGN KEY (`pull_request_number`, `repository_id`) REFERENCES `pull_requests` (`number`, `repository_id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "pull_request_reviews_pr_reviewer_submitted_at_key" to table: "pull_request_reviews"
CREATE UNIQUE INDEX `pull_request_reviews_pr_reviewer_submitted_at_key` ON `pull_request_reviews` (`pull_request_number`, `repository_id`, `reviewer`, `submitted_at`);
-- Create index "pull_request_reviews_pr_idx" to table: "pull_request_reviews"
CREATE INDEX `pull_request_reviews_pr_idx` ON `pull_request_reviews` (`pull_request_number`, `repository_id`);
-- Create "pull_request_reviewers" table
CREATE TABLE `pull_request_reviewers` (
  `pull_request_number` integer NOT NULL,
  `repository_id` text NOT NULL,
  `reviewer` text NOT NULL,
  `requested_at` text NULL,
  PRIMARY KEY (`pull_request_number`, `repository_id`, `reviewer`),
  CONSTRAINT `pull_request_reviewers_pr_fkey` FOREIGN KEY (`pull_request_number`, `repository_id`) REFERENCES `pull_requests` (`number`, `repository_id`) ON UPDATE CASCADE ON DELETE CASCADE
);
