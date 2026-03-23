import type { Members } from '~/app/services/type'

export type MemberRole = Members['role']

export const isOrgAdmin = (role: MemberRole): boolean =>
  role === 'owner' || role === 'admin'

export const isOrgOwner = (role: MemberRole): boolean => role === 'owner'
