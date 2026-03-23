/** Branded type for organization IDs to prevent mixing with arbitrary strings */
export type OrganizationId = string & { readonly __brand: 'OrganizationId' }

/** Cast a plain string to OrganizationId. For use in tests only. */
export const toOrgId = (s: string) => s as OrganizationId
