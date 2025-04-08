-- CreateTable
CREATE TABLE "organization_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "release_detection_method" TEXT NOT NULL DEFAULT 'branch',
    "release_detection_key" TEXT NOT NULL DEFAULT 'production',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_company_github_users" (
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "login" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "picture_url" TEXT,
    "display_name" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT,

    PRIMARY KEY ("company_id", "login"),
    CONSTRAINT "company_github_users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_company_github_users" ("company_id", "created_at", "display_name", "email", "login", "name", "picture_url", "updated_at", "user_id") SELECT "company_id", "created_at", "display_name", "email", "login", "name", "picture_url", "updated_at", "user_id" FROM "company_github_users";
DROP TABLE "company_github_users";
ALTER TABLE "new_company_github_users" RENAME TO "company_github_users";
CREATE INDEX "company_github_users_organization_id_idx" ON "company_github_users"("organization_id");
CREATE TABLE "new_export_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT,
    "sheet_id" TEXT NOT NULL,
    "client_email" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT,
    CONSTRAINT "export_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_export_settings" ("client_email", "company_id", "created_at", "id", "private_key", "sheet_id", "updated_at") SELECT "client_email", "company_id", "created_at", "id", "private_key", "sheet_id", "updated_at" FROM "export_settings";
DROP TABLE "export_settings";
ALTER TABLE "new_export_settings" RENAME TO "export_settings";
CREATE UNIQUE INDEX "export_settings_company_id_key" ON "export_settings"("company_id");
CREATE UNIQUE INDEX "export_settings_organization_id_key" ON "export_settings"("organization_id");
CREATE TABLE "new_integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "private_token" TEXT,
    "company_id" TEXT,
    "organization_id" TEXT,
    CONSTRAINT "integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_integrations" ("company_id", "id", "method", "private_token", "provider") SELECT "company_id", "id", "method", "private_token", "provider" FROM "integrations";
DROP TABLE "integrations";
ALTER TABLE "new_integrations" RENAME TO "integrations";
CREATE UNIQUE INDEX "integrations_organization_id_key" ON "integrations"("organization_id");
CREATE INDEX "integrations_organization_id_idx" ON "integrations"("organization_id");
CREATE TABLE "new_repositories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT,
    "integration_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "release_detection_method" TEXT NOT NULL DEFAULT 'branch',
    "release_detection_key" TEXT NOT NULL DEFAULT 'production',
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT,
    CONSTRAINT "repositories_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "repositories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_repositories" ("company_id", "created_at", "id", "integration_id", "owner", "provider", "release_detection_key", "release_detection_method", "repo", "updated_at") SELECT "company_id", "created_at", "id", "integration_id", "owner", "provider", "release_detection_key", "release_detection_method", "repo", "updated_at" FROM "repositories";
DROP TABLE "repositories";
ALTER TABLE "new_repositories" RENAME TO "repositories";
CREATE INDEX "repositories_organization_id_idx" ON "repositories"("organization_id");
CREATE UNIQUE INDEX "repositories_organization_id_integration_id_owner_repo_key" ON "repositories"("organization_id", "integration_id", "owner", "repo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_organization_id_key" ON "organization_settings"("organization_id");
