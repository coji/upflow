-- Create "pull_request_feedbacks" table
CREATE TABLE `pull_request_feedbacks` (
  `pull_request_number` integer NOT NULL,
  `repository_id` text NOT NULL,
  `feedback_by` text NOT NULL,
  `original_complexity` text NULL,
  `corrected_complexity` text NOT NULL,
  `reason` text NULL,
  `created_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`pull_request_number`, `repository_id`, `feedback_by`),
  CONSTRAINT `0` FOREIGN KEY (`pull_request_number`, `repository_id`) REFERENCES `pull_requests` (`number`, `repository_id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
