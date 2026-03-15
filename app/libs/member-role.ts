export type MemberRole = 'owner' | 'admin' | 'member'

export const isOrgAdmin = (role: MemberRole): boolean =>
  role === 'owner' || role === 'admin'
