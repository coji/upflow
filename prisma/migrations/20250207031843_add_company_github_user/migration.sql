-- CreateTable
CREATE TABLE "company_github_users" (
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "login" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "picture_url" TEXT,
    "display_name" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("company_id", "login"),
    CONSTRAINT "company_github_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
