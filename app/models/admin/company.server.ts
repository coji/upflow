import type { Company } from '@prisma/client'
import { prisma } from '~/app/utils/db.server'
export type { Company } from '@prisma/client'

export const getCompanies = async () => prisma.company.findMany({})

export const getCompany = async (companyId: string) =>
  prisma.company.findUnique({
    where: { id: companyId },
    include: {
      teams: true,
      integration: true,
      repositories: true,
      users: { include: { user: true } },
      exportSetting: true
    }
  })

export const updateCompany = async ({
  companyId,
  name,
  releaseDetectionMethod,
  releaseDetectionKey
}: {
  companyId: Company['id']
  name: Company['name']
  releaseDetectionMethod: Company['releaseDetectionMethod']
  releaseDetectionKey: Company['releaseDetectionKey']
}) => {
  const ret = await prisma.$transaction([
    prisma.company.update({
      data: { name, releaseDetectionMethod, releaseDetectionKey },
      where: { id: companyId }
    }),
    // 関連リポジトリの release detection もまとめて更新する
    // TODO: 暗黙っぽいのでリファクタ
    prisma.repository.updateMany({
      data: { releaseDetectionMethod, releaseDetectionKey },
      where: { companyId }
    })
  ])

  return ret[0]
}

export const createCompany = async (name: string) => prisma.company.create({ data: { name } })

export const deleteCompany = async (companyId: string) => prisma.company.delete({ where: { id: companyId } })
