export function canAdmitGithubLogin(input: {
  activeCompanyUser: boolean
  firstUser: boolean
  existingMembership: boolean
  existingSuperAdmin: boolean
  pendingHandoff: boolean
}): boolean {
  if (input.activeCompanyUser || input.firstUser) return true
  if (input.existingMembership || input.existingSuperAdmin) return false
  return input.pendingHandoff
}
