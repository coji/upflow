import { prisma } from '~/db.server'
import type { MergeRequest } from '@prisma/client'
export type { MergeRequest } from '@prisma/client'

export function getMergeRequestItems() {
  return prisma.mergeRequest.findMany({
    orderBy: { mergerequest_created_at: 'desc' }
  })
}

export function upsertMergeRequest(mergeRequest: MergeRequest) {
  return prisma.mergeRequest.upsert({
    where: { id: mergeRequest.id },
    create: mergeRequest,
    update: mergeRequest
  })
}

export function deleteMergeRequest({ id }: Pick<MergeRequest, 'id'>) {
  return prisma.mergeRequest.delete({
    where: { id }
  })
}
