/*
  Warnings:

  - A unique constraint covering the columns `[integrationId,provider,projectId,owner,repo]` on the table `Repository` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Repository_integrationId_provider_projectId_owner_repo_key" ON "Repository"("integrationId", "provider", "projectId", "owner", "repo");
