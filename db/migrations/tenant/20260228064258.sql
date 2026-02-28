-- Create "github_raw_data" table
CREATE TABLE `github_raw_data` (
  `repository_id` text NOT NULL,
  `pull_request_number` integer NOT NULL,
  `pull_request` text NOT NULL,
  `commits` text NOT NULL,
  `reviews` text NOT NULL,
  `discussions` text NOT NULL,
  `fetched_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`repository_id`, `pull_request_number`),
  CONSTRAINT `github_raw_data_repository_id_fkey` FOREIGN KEY (`repository_id`) REFERENCES `repositories` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create "github_raw_tags" table
CREATE TABLE `github_raw_tags` (
  `repository_id` text NOT NULL,
  `tags` text NOT NULL,
  `fetched_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`repository_id`),
  CONSTRAINT `github_raw_tags_repository_id_fkey` FOREIGN KEY (`repository_id`) REFERENCES `repositories` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
