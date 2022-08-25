-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Repository" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "projectId" TEXT,
    "owner" TEXT,
    "repo" TEXT,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Repository_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Repository_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Repository" ("companyId", "id", "integrationId", "projectId", "provider") SELECT "companyId", "id", "integrationId", "projectId", "provider" FROM "Repository";
DROP TABLE "Repository";
ALTER TABLE "new_Repository" RENAME TO "Repository";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
