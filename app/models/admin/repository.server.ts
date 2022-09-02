import invariant from 'tiny-invariant'
import { prisma } from '~/app/db.server'

interface createRepositoryProps {
  companyId: string
  projectId?: string
  owner?: string
  repo?: string
}
export const createRepository = async ({ companyId, projectId, owner, repo }: createRepositoryProps) => {
  const integration = await prisma.integration.findFirstOrThrow({ where: { companyId } })
  if (integration.provider === 'github') {
    invariant(owner, 'github repo must specify owner')
    invariant(repo, 'github repo must specify repo')

    return await prisma.repository.create({
      data: {
        companyId,
        integrationId: integration.id,
        provider: integration.provider,
        owner,
        repo,
        name: `${owner}/${repo}`
      }
    })
  }

  if (integration.provider === 'gitlab') {
    invariant(projectId, 'gitlab repo must speficy projectId')
    return await prisma.repository.create({
      data: {
        companyId,
        integrationId: integration.id,
        provider: integration.provider,
        projectId,
        name: `${projectId}`
      }
    })
  }

  return null
}

export const deleteRepository = async (repositoryId: string) =>
  await prisma.repository.delete({ where: { id: repositoryId } })
export const getRepository = async (repositoryId: string) =>
  await prisma.repository.findFirst({ where: { id: repositoryId } })
