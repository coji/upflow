-- CreateTable
CREATE TABLE "MergeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "title" TEXT NOT NULL
);
