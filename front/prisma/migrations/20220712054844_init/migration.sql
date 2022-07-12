-- CreateTable
CREATE TABLE "MergeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "target_branch" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "num_of_commits" INTEGER NOT NULL,
    "num_of_comments" INTEGER NOT NULL,
    "first_commited_at" DATETIME NOT NULL,
    "mergerequest_created_at" DATETIME NOT NULL,
    "first_reviewd_at" DATETIME NOT NULL,
    "merged_at" DATETIME NOT NULL,
    "released_at" DATETIME NOT NULL,
    "is_release_committed" BOOLEAN NOT NULL,
    "author" TEXT NOT NULL,
    "title" TEXT NOT NULL
);
