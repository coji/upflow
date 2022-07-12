import type { MergeRequest } from '@prisma/client'
export type { MergeRequest } from '@prisma/client'
import { prisma } from '~/libs/db.server'

export function getMergeRequestItems() {
  return prisma.mergeRequest.findMany({
    orderBy: { mergerequest_created_at: 'desc' }
  })
}

export function upsertMergeRequest(mergeRequest: MergeRequest) {
  const data = prisma.mergeRequest.upsert({
    where: { id: mergeRequest.id },
    create: mergeRequest,
    update: mergeRequest
  })
  return { data, error: false, status: 200 }
}

export function deleteMergeRequest({ id }: Pick<MergeRequest, 'id'>) {
  return prisma.mergeRequest.delete({
    where: { id }
  })
}
