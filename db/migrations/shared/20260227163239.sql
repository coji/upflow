-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Drop "organization_settings" table
DROP TABLE `organization_settings`;
-- Drop "export_settings" table
DROP TABLE `export_settings`;
-- Drop "integrations" table
DROP TABLE `integrations`;
-- Drop "repositories" table
DROP TABLE `repositories`;
-- Drop "pull_requests" table
DROP TABLE `pull_requests`;
-- Drop "company_github_users" table
DROP TABLE `company_github_users`;
-- Drop "pull_request_reviews" table
DROP TABLE `pull_request_reviews`;
-- Drop "pull_request_reviewers" table
DROP TABLE `pull_request_reviewers`;
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
