-- Create "organization_settings" table
CREATE TABLE `organization_settings` (
  `id` text NOT NULL,
  `release_detection_method` text NOT NULL DEFAULT 'branch',
  `release_detection_key` text NOT NULL DEFAULT 'production',
  `is_active` boolean NOT NULL DEFAULT true,
  `excluded_users` text NOT NULL DEFAULT '',
  `timezone` text NOT NULL DEFAULT 'Asia/Tokyo',
  `refresh_requested_at` datetime NULL,
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`)
);
-- Create "export_settings" table
CREATE TABLE `export_settings` (
  `id` text NOT NULL,
  `sheet_id` text NOT NULL,
  `client_email` text NOT NULL,
  `private_key` text NOT NULL,
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`)
);
-- Create "integrations" table
CREATE TABLE `integrations` (
  `id` text NOT NULL,
  `provider` text NOT NULL,
  `method` text NOT NULL,
  `private_token` text NULL,
  PRIMARY KEY (`id`)
);
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
  `team_id` text NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `repositories_integration_id_fkey` FOREIGN KEY (`integration_id`) REFERENCES `integrations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `repositories_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
);
-- Create index "repositories_integration_id_owner_repo_key" to table: "repositories"
CREATE UNIQUE INDEX `repositories_integration_id_owner_repo_key` ON `repositories` (`integration_id`, `owner`, `repo`);
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
  `closed_at` text NULL,
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
  `complexity` text NULL,
  `complexity_reason` text NULL,
  `risk_areas` text NULL,
  `classified_at` text NULL,
  `classifier_model` text NULL,
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
-- Create "teams" table
CREATE TABLE `teams` (
  `id` text NOT NULL,
  `name` text NOT NULL,
  `display_order` integer NOT NULL DEFAULT 0,
  `personal_limit` integer NOT NULL DEFAULT 2,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`)
);
-- Create index "teams_name_key" to table: "teams"
CREATE UNIQUE INDEX `teams_name_key` ON `teams` (`name`);
-- Create "github_raw_data" table
CREATE TABLE `github_raw_data` (
  `repository_id` text NOT NULL,
  `pull_request_number` integer NOT NULL,
  `pull_request` text NOT NULL,
  `commits` text NOT NULL,
  `reviews` text NOT NULL,
  `discussions` text NOT NULL,
  `timeline_items` text NULL,
  `updated_at` text NULL,
  `fetched_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`repository_id`, `pull_request_number`),
  CONSTRAINT `github_raw_data_repository_id_fkey`
    FOREIGN KEY (`repository_id`) REFERENCES `repositories` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create "github_raw_tags" table
CREATE TABLE `github_raw_tags` (
  `repository_id` text NOT NULL,
  `tags` text NOT NULL,
  `fetched_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`repository_id`),
  CONSTRAINT `github_raw_tags_repository_id_fkey`
    FOREIGN KEY (`repository_id`) REFERENCES `repositories` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create "pull_request_feedbacks" table
CREATE TABLE `pull_request_feedbacks` (
  `pull_request_number` integer NOT NULL,
  `repository_id` text NOT NULL,
  `original_complexity` text,
  `corrected_complexity` text NOT NULL,
  `reason` text,
  `feedback_by` text,
  `feedback_by_login` text,
  `created_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`pull_request_number`, `repository_id`),
  FOREIGN KEY (`pull_request_number`, `repository_id`) REFERENCES `pull_requests` (`number`, `repository_id`) ON DELETE CASCADE
);
-- Create "company_github_users" table
CREATE TABLE `company_github_users` (
  `user_id` text NULL,
  `login` text NOT NULL,
  `display_name` text NOT NULL,
  `type` text NULL,
  `is_active` integer NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`login`)
);
