/** Branded type for organization IDs to prevent mixing with arbitrary strings */
export type OrganizationId = string & { readonly __brand: 'OrganizationId' }
