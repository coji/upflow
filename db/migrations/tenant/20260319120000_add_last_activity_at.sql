-- Add last_activity_at column to company_github_users
ALTER TABLE company_github_users ADD COLUMN last_activity_at text NULL;

-- Backfill from existing PR and review data
UPDATE company_github_users SET last_activity_at = (
  SELECT MAX(activity_at) FROM (
    SELECT MAX(pull_request_created_at) AS activity_at
    FROM pull_requests WHERE LOWER(author) = LOWER(company_github_users.login)
    UNION ALL
    SELECT MAX(submitted_at) AS activity_at
    FROM pull_request_reviews WHERE LOWER(reviewer) = LOWER(company_github_users.login)
  )
);
