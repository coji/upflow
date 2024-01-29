PRAGMA foreign_keys=off;

CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "picture_url" TEXT,
    "locale" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "users" SELECT
    "id",
    "email",
    "displayName",
    "pictureUrl",
    "locale",
    "role",
    "updatedAt",
    "createdAt"
FROM "User";

CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "release_detection_method" TEXT NOT NULL DEFAULT 'branch',
    "release_detection_key" TEXT NOT NULL DEFAULT 'production',
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "companies" SELECT
    "id",
    "name",
    "releaseDetectionMethod",
    "releaseDetectionKey",
    "updatedAt",
    "createdAt",
    "isActive"
FROM "Company";

CREATE TABLE "company_users" (
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invited_at" DATETIME,
    "activated_at" DATETIME,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("company_id", "user_id"),
    CONSTRAINT "company_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "company_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "company_users" SELECT
    "companyId",
    "userId",
    "role",
    "invitedAt",
    "activatedAt",
    "updatedAt",
    "createdAt"
FROM "CompanyUser";

CREATE TABLE "teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" TEXT NOT NULL,
    CONSTRAINT "teams_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "teams" SELECT
    "id",
    "name",
    "updatedAt",
    "createdAt",
    "companyId"
FROM "Team";

CREATE TABLE "team_users" (
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("team_id", "user_id"),
    CONSTRAINT "team_users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "team_users" SELECT
    "teamId",
    "userId",
    "role",
    "updatedAt",
    "createdAt"
FROM "TeamUser";

CREATE TABLE "integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "private_token" TEXT,
    "company_id" TEXT NOT NULL,
    CONSTRAINT "integrations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "integrations" SELECT
    "id",
    "provider",
    "method",
    "privateToken",
    "companyId"
FROM "Integration";

CREATE TABLE "repositories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integration_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "project_id" TEXT,
    "owner" TEXT,
    "repo" TEXT,
    "release_detection_method" TEXT NOT NULL DEFAULT 'branch',
    "release_detection_key" TEXT NOT NULL DEFAULT 'production',
    "company_id" TEXT NOT NULL,
    CONSTRAINT "repositories_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "repositories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "repositories" SELECT
    "id",
    "integrationId",
    "provider",
    "name",
    "projectId",
    "owner",
    "repo",
    "releaseDetectionMethod",
    "releaseDetectionKey",
    "companyId"
FROM "Repository";

CREATE TABLE "pull_requests" (
    "repo" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "source_branch" TEXT NOT NULL,
    "target_branch" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "first_committed_at" TEXT,
    "pull_request_created_at" TEXT NOT NULL,
    "first_reviewed_at" TEXT,
    "merged_at" TEXT,
    "released_at" TEXT,
    "coding_time" REAL,
    "pickup_time" REAL,
    "review_time" REAL,
    "deploy_time" REAL,
    "total_time" REAL,
    "repository_id" TEXT NOT NULL,
    "updated_at" TEXT,

    PRIMARY KEY ("repository_id", "number"),
    CONSTRAINT "pull_requests_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "pull_requests" SELECT
    "repo",
    "number",
    "sourceBranch",
    "targetBranch",
    "state",
    "author",
    "title",
    "url",
    "firstCommittedAt",
    "pullRequestCreatedAt",
    "firstReviewedAt",
    "mergedAt",
    "releasedAt",
    "codingTime",
    "pickupTime",
    "reviewTime",
    "deployTime",
    "totalTime",
    "repositoryId",
    "updatedAt"
FROM "PullRequest";

CREATE TABLE "export_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "client_email" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "export_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "export_settings" SELECT
    "id",
    "companyId",
    "sheetId",
    "clientEmail",
    "privateKey",
    "updatedAt",
    "createdAt"
FROM "ExportSetting";

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "integrations_company_id_key" ON "integrations"("company_id");
CREATE UNIQUE INDEX "repositories_integration_id_provider_project_id_owner_repo_key" ON "repositories"("integration_id", "provider", "project_id", "owner", "repo");
CREATE UNIQUE INDEX "export_settings_company_id_key" ON "export_settings"("company_id");

-- DropTable
DROP TABLE "Calendar";
DROP TABLE "Company";
DROP TABLE "CompanyUser";
DROP TABLE "ExportSetting";
DROP TABLE "Integration";
DROP TABLE "PullRequest";
DROP TABLE "Repository";
DROP TABLE "Team";
DROP TABLE "TeamUser";
DROP TABLE "User";

PRAGMA foreign_keys=on;