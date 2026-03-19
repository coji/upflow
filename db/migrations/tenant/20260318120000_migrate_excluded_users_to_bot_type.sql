-- Migrate excludedUsers setting to companyGithubUsers.type='Bot'
-- 1. Copy excluded users from organization_settings to company_github_users with type='Bot'
INSERT INTO company_github_users (login, display_name, type, is_active, updated_at)
SELECT
  LOWER(TRIM(value)) AS login,
  LOWER(TRIM(value)) AS display_name,
  'Bot' AS type,
  0 AS is_active,
  CURRENT_TIMESTAMP AS updated_at
FROM organization_settings, json_each('["' || REPLACE(COALESCE(excluded_users, ''), ',', '","') || '"]')
WHERE COALESCE(excluded_users, '') != ''
  AND TRIM(value) != ''
ON CONFLICT (login) DO UPDATE SET type = 'Bot';

-- 2. Ensure 'copilot' is registered as Bot (case-insensitive - stored lowercase)
INSERT INTO company_github_users (login, display_name, type, is_active, updated_at)
VALUES ('copilot', 'copilot', 'Bot', 0, CURRENT_TIMESTAMP)
ON CONFLICT (login) DO UPDATE SET type = 'Bot';

-- 3. Drop excluded_users column from organization_settings
ALTER TABLE organization_settings DROP COLUMN excluded_users;
