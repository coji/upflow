/*
  Warnings:

  - The primary key for the `PullRequest` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `number` on the `PullRequest` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PullRequest" (
    "repo" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "sourceBranch" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "firstCommittedAt" TEXT,
    "pullRequestCreatedAt" TEXT NOT NULL,
    "firstReviewedAt" TEXT,
    "mergedAt" TEXT,
    "releasedAt" TEXT,
    "codingTime" REAL,
    "pickupTime" REAL,
    "reviewTime" REAL,
    "deployTime" REAL,
    "totalTime" REAL,
    "repositoryId" TEXT NOT NULL,
    "updatedAt" TEXT,

    PRIMARY KEY ("repositoryId", "number"),
    CONSTRAINT "PullRequest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PullRequest" ("author", "codingTime", "deployTime", "firstCommittedAt", "firstReviewedAt", "mergedAt", "number", "pickupTime", "pullRequestCreatedAt", "releasedAt", "repo", "repositoryId", "reviewTime", "sourceBranch", "state", "targetBranch", "title", "totalTime", "updatedAt", "url") SELECT "author", "codingTime", "deployTime", "firstCommittedAt", "firstReviewedAt", "mergedAt", "number", "pickupTime", "pullRequestCreatedAt", "releasedAt", "repo", "repositoryId", "reviewTime", "sourceBranch", "state", "targetBranch", "title", "totalTime", "updatedAt", "url" FROM "PullRequest";
DROP TABLE "PullRequest";
ALTER TABLE "new_PullRequest" RENAME TO "PullRequest";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
