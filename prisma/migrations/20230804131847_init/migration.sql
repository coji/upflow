-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pictureUrl" TEXT,
    "locale" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "releaseDetectionMethod" TEXT NOT NULL DEFAULT 'branch',
    "releaseDetectionKey" TEXT NOT NULL DEFAULT 'production',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "CompanyUser" (
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invitedAt" DATETIME,
    "activatedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("companyId", "userId"),
    CONSTRAINT "CompanyUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Team_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamUser" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("teamId", "userId"),
    CONSTRAINT "TeamUser_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "privateToken" TEXT,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Integration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "projectId" TEXT,
    "owner" TEXT,
    "repo" TEXT,
    "releaseDetectionMethod" TEXT NOT NULL DEFAULT 'branch',
    "releaseDetectionKey" TEXT NOT NULL DEFAULT 'production',
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Repository_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Repository_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PullRequest" (
    "repo" TEXT NOT NULL,
    "number" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "ExportSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportSetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Calendar" (
    "d" DATETIME NOT NULL,
    "dayofweek" INTEGER NOT NULL,
    "weekday" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_companyId_key" ON "Integration"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_integrationId_provider_projectId_owner_repo_key" ON "Repository"("integrationId", "provider", "projectId", "owner", "repo");

-- CreateIndex
CREATE UNIQUE INDEX "ExportSetting_companyId_key" ON "ExportSetting"("companyId");

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_calendar_1" ON "Calendar"("d");
Pragma writable_schema=0;
