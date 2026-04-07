export const crawlConcurrencyKey = (orgId: string) => `crawl:${orgId}` as const
export const crawlRepoConcurrencyKey = (orgId: string, repoId: string) =>
  `crawl:${orgId}:${repoId}` as const
export const processConcurrencyKey = (orgId: string) =>
  `process:${orgId}` as const
