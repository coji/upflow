-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Drop "organization_settings" table
DROP TABLE IF EXISTS `organization_settings`;
-- Drop "export_settings" table
DROP TABLE IF EXISTS `export_settings`;
-- Drop "integrations" table
DROP TABLE IF EXISTS `integrations`;
-- Drop "repositories" table
DROP TABLE IF EXISTS `repositories`;
-- Drop "pull_requests" table
DROP TABLE IF EXISTS `pull_requests`;
-- Drop "company_github_users" table
DROP TABLE IF EXISTS `company_github_users`;
-- Drop "pull_request_reviews" table
DROP TABLE IF EXISTS `pull_request_reviews`;
-- Drop "pull_request_reviewers" table
DROP TABLE IF EXISTS `pull_request_reviewers`;
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
