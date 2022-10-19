-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "releaseDetectionMethod" TEXT NOT NULL DEFAULT 'branch',
    "releaseDetectionKey" TEXT NOT NULL DEFAULT 'production',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Company" ("createdAt", "id", "name", "releaseDetectionKey", "releaseDetectionMethod", "updatedAt") SELECT "createdAt", "id", "name", "releaseDetectionKey", "releaseDetectionMethod", "updatedAt" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
