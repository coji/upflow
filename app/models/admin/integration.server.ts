import { prisma } from '~/app/services/db.server'

export const getIntegration = async (companyId: string) => await prisma.integration.findFirst({ where: { companyId } })

interface addIntegrationProps {
  companyId: string
  provider: 'github'
  method: string
  privateToken: string
}

export const createIntegration = async ({ companyId, provider, method, privateToken }: addIntegrationProps) =>
  await prisma.integration.create({
    data: {
      companyId,
      provider,
      method,
      privateToken,
    },
  })
