-- Add column "feedback_by" to table: "pull_request_feedbacks"
ALTER TABLE `pull_request_feedbacks` ADD COLUMN `feedback_by` text NULL;
