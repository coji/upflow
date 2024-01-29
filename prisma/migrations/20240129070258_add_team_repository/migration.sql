-- CreateTable
CREATE TABLE "team_repositories" (
    "team_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("team_id", "repository_id"),
    CONSTRAINT "team_repositories_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_repositories_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
