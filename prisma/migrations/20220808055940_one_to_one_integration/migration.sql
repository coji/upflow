/*
  Warnings:

  - A unique constraint covering the columns `[companyId]` on the table `Integration` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Integration_companyId_key" ON "Integration"("companyId");
