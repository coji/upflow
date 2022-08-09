-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Integration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "privateToken" TEXT,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Integration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Integration" ("companyId", "id", "method", "privateToken", "provider") SELECT "companyId", "id", "method", "privateToken", "provider" FROM "Integration";
DROP TABLE "Integration";
ALTER TABLE "new_Integration" RENAME TO "Integration";
CREATE UNIQUE INDEX "Integration_companyId_key" ON "Integration"("companyId");
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Team_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("companyId", "id", "name") SELECT "companyId", "id", "name" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE TABLE "new_Repository" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Repository_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Repository_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Repository" ("companyId", "id", "integrationId", "projectId", "provider") SELECT "companyId", "id", "integrationId", "projectId", "provider" FROM "Repository";
DROP TABLE "Repository";
ALTER TABLE "new_Repository" RENAME TO "Repository";
CREATE TABLE "new_MergeRequest" (
    "id" TEXT NOT NULL,
    "target_branch" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "num_of_commits" INTEGER,
    "num_of_comments" INTEGER,
    "first_commited_at" TEXT,
    "mergerequest_created_at" TEXT NOT NULL,
    "first_reviewd_at" TEXT,
    "merged_at" TEXT,
    "released_at" TEXT,
    "is_release_committed" BOOLEAN NOT NULL,
    "author" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,

    PRIMARY KEY ("repositoryId", "id"),
    CONSTRAINT "MergeRequest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MergeRequest" ("author", "first_commited_at", "first_reviewd_at", "id", "is_release_committed", "merged_at", "mergerequest_created_at", "num_of_comments", "num_of_commits", "released_at", "repositoryId", "state", "target_branch", "title") SELECT "author", "first_commited_at", "first_reviewd_at", "id", "is_release_committed", "merged_at", "mergerequest_created_at", "num_of_comments", "num_of_commits", "released_at", "repositoryId", "state", "target_branch", "title" FROM "MergeRequest";
DROP TABLE "MergeRequest";
ALTER TABLE "new_MergeRequest" RENAME TO "MergeRequest";
CREATE TABLE "new_CompanyUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invitedAt" DATETIME,
    "activatedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CompanyUser" ("activatedAt", "companyId", "createdAt", "id", "invitedAt", "role", "updatedAt", "userId") SELECT "activatedAt", "companyId", "createdAt", "id", "invitedAt", "role", "updatedAt", "userId" FROM "CompanyUser";
DROP TABLE "CompanyUser";
ALTER TABLE "new_CompanyUser" RENAME TO "CompanyUser";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
