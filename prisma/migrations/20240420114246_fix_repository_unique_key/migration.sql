/*
  Warnings:

  - You are about to drop the column `name` on the `repositories` table. All the data in the column will be lost.
  - You are about to drop the column `project_id` on the `repositories` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `repositories` table without a default value. This is not possible if the table is not empty.
  - Made the column `owner` on table `repositories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `repo` on table `repositories` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_repositories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "release_detection_method" TEXT NOT NULL DEFAULT 'branch',
    "release_detection_key" TEXT NOT NULL DEFAULT 'production',
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "repositories_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "repositories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_repositories" ("company_id", "id", "integration_id", "owner", "provider", "release_detection_key", "release_detection_method", "repo", "updated_at", "created_at") SELECT "company_id", "id", "integration_id", "owner", "provider", "release_detection_key", "release_detection_method", "repo", CURRENT_TIMESTAMP as "updated_at", CURRENT_TIMESTAMP as "created_at" FROM "repositories";
DROP TABLE "repositories";
ALTER TABLE "new_repositories" RENAME TO "repositories";
CREATE UNIQUE INDEX "repositories_company_id_integration_id_owner_repo_key" ON "repositories"("company_id", "integration_id", "owner", "repo");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
