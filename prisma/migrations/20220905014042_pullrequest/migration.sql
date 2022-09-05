/*
  Warnings:

  - You are about to drop the `MergeRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MergeRequest";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "PullRequest" (
    "repo" TEXT NOT NULL,
    "number" TEXT NOT NULL,
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
