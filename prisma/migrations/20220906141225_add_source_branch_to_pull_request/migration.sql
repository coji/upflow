/*
  Warnings:

  - Added the required column `sourceBranch` to the `PullRequest` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PullRequest" (
    "repo" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sourceBranch" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isReleased" BOOLEAN NOT NULL,
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

    PRIMARY KEY ("repositoryId", "number"),
    CONSTRAINT "PullRequest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PullRequest" ("author", "codingTime", "deployTime", "firstCommittedAt", "firstReviewedAt", "isReleased", "mergedAt", "number", "pickupTime", "pullRequestCreatedAt", "releasedAt", "repo", "repositoryId", "reviewTime", "state", "targetBranch", "title", "totalTime", "url") SELECT "author", "codingTime", "deployTime", "firstCommittedAt", "firstReviewedAt", "isReleased", "mergedAt", "number", "pickupTime", "pullRequestCreatedAt", "releasedAt", "repo", "repositoryId", "reviewTime", "state", "targetBranch", "title", "totalTime", "url" FROM "PullRequest";
DROP TABLE "PullRequest";
ALTER TABLE "new_PullRequest" RENAME TO "PullRequest";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
