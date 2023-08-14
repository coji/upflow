import type { Repository } from '@prisma/client'
import invariant from 'tiny-invariant'
import { prisma } from '~/app/services/db.server'

interface createRepositoryProps {
  companyId: string
  projectId?: string
  owner?: string
  repo?: string
}
export const createRepository = async ({ companyId, projectId, owner, repo }: createRepositoryProps) => {
  const company = await prisma.company.findFirstOrThrow({ where: { id: companyId } })
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
        name: `${owner}/${repo}`,
        releaseDetectionKey: company.releaseDetectionKey,
        releaseDetectionMethod: company.releaseDetectionMethod,
      },
    })
  }

  if (integration.provider === 'gitlab') {
    invariant(projectId, 'gitlab repo must specify projectId')
    return await prisma.repository.create({
      data: {
        companyId,
        integrationId: integration.id,
        provider: integration.provider,
        projectId,
        name: `${projectId}`,
        releaseDetectionKey: company.releaseDetectionKey,
        releaseDetectionMethod: company.releaseDetectionMethod,
      },
    })
  }

  return null
}

export const updateRepository = async (repositoryId: string, data: Partial<Repository>) => {
  return await prisma.repository.update({ data, where: { id: repositoryId } })
}

export const deleteRepository = async (repositoryId: string) =>
  await prisma.repository.delete({ where: { id: repositoryId } })

export const getRepository = async (repositoryId: string) =>
  await prisma.repository.findFirst({ where: { id: repositoryId }, include: { integration: true } })
