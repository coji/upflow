import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting data migration from Company to Organization...')

  // Fetch all companies
  const companies = await prisma.company.findMany({
    // Corrected: prisma.company (lowercase c)
    // Removed include block as relations are no longer on Company model in schema
  })

  console.log(`Found ${companies.length} companies to migrate.`)

  let migratedCount = 0
  let errorCount = 0

  for (const company of companies) {
    try {
      console.log(
        `\nMigrating Company ID: ${company.id}, Name: ${company.name}`,
      )

      // 1. Create Organization
      // We assume Organization doesn't exist yet for this ID
      // If better-auth might have created some, add findUnique first
      const organization = await prisma.organization.create({
        data: {
          id: company.id, // Reusing company ID
          name: company.name,
          // Add slug, logo, metadata if available/needed from Company or defaults
          createdAt: company.createdAt, // Preserve original creation time if desired
        },
      })
      console.log(` -> Created Organization ID: ${organization.id}`)

      // 2. Create OrganizationSetting
      const setting = await prisma.organizationSetting.create({
        // Corrected: prisma.organizationSetting
        data: {
          organizationId: organization.id,
          releaseDetectionMethod: company.releaseDetectionMethod,
          releaseDetectionKey: company.releaseDetectionKey,
          isActive: company.isActive,
          createdAt: company.createdAt, // Or default to now()
          updatedAt: company.updatedAt, // Or default to now()
        },
      })
      console.log(` -> Created OrganizationSetting ID: ${setting.id}`)

      // 3. Update related records
      // It's often safer/simpler to update based on the original companyId

      // Update Integration (1:1)
      const updatedIntegration = await prisma.integration.updateMany({
        where: { companyId: company.id },
        data: { organizationId: organization.id },
      })
      if (updatedIntegration.count > 0) {
        console.log(
          ` -> Updated ${updatedIntegration.count} Integration record(s).`,
        )
      }

      // Update Repositories (1:N)
      const updatedRepositories = await prisma.repository.updateMany({
        where: { companyId: company.id },
        data: { organizationId: organization.id },
      })
      if (updatedRepositories.count > 0) {
        console.log(
          ` -> Updated ${updatedRepositories.count} Repository record(s).`,
        )
      }

      // Update ExportSetting (1:1)
      const updatedExportSetting = await prisma.exportSetting.updateMany({
        where: { companyId: company.id },
        data: { organizationId: organization.id },
      })
      if (updatedExportSetting.count > 0) {
        console.log(
          ` -> Updated ${updatedExportSetting.count} ExportSetting record(s).`,
        )
      }

      // Update CompanyGithubUser (1:N)
      // Note: The PK temporarily uses companyId, so we update based on that.
      const updatedGithubUsers = await prisma.companyGithubUser.updateMany({
        // Corrected: prisma.companyGithubUser
        where: { companyId: company.id },
        data: { organizationId: organization.id },
      })
      if (updatedGithubUsers.count > 0) {
        console.log(
          ` -> Updated ${updatedGithubUsers.count} CompanyGithubUser record(s).`,
        )
      }

      migratedCount++
    } catch (error) {
      console.error(
        `Failed to migrate Company ID: ${company.id}. Error:`,
        error,
      )
      errorCount++
    }
  }

  console.log('\nMigration finished.') // Fixed Biome lint error (removed unnecessary template literal)
  console.log(`Successfully migrated: ${migratedCount}`)
  console.log(`Failed migrations: ${errorCount}`)
}

main()
  .catch((e) => {
    console.error('An error occurred during migration:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
