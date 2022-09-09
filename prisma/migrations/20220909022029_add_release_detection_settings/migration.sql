-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Repository" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "projectId" TEXT,
    "owner" TEXT,
    "repo" TEXT,
    "releaseDetectionMethod" TEXT NOT NULL DEFAULT 'branch',
    "releaseDetectionKeys" TEXT NOT NULL DEFAULT 'production',
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Repository_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Repository_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Repository" ("companyId", "id", "integrationId", "name", "owner", "projectId", "provider", "repo") SELECT "companyId", "id", "integrationId", "name", "owner", "projectId", "provider", "repo" FROM "Repository";
DROP TABLE "Repository";
ALTER TABLE "new_Repository" RENAME TO "Repository";
CREATE UNIQUE INDEX "Repository_integrationId_provider_projectId_owner_repo_key" ON "Repository"("integrationId", "provider", "projectId", "owner", "repo");
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "releaseDetectionMethod" TEXT NOT NULL DEFAULT 'branch',
    "releaseDetectionKeys" TEXT NOT NULL DEFAULT 'production',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Company" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
