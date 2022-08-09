/*
  Warnings:

  - The primary key for the `MergeRequest` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "MergeRequest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MergeRequest" ("author", "first_commited_at", "first_reviewd_at", "id", "is_release_committed", "merged_at", "mergerequest_created_at", "num_of_comments", "num_of_commits", "released_at", "repositoryId", "state", "target_branch", "title") SELECT "author", "first_commited_at", "first_reviewd_at", "id", "is_release_committed", "merged_at", "mergerequest_created_at", "num_of_comments", "num_of_commits", "released_at", "repositoryId", "state", "target_branch", "title" FROM "MergeRequest";
DROP TABLE "MergeRequest";
ALTER TABLE "new_MergeRequest" RENAME TO "MergeRequest";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
