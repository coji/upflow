export const crawlConcurrencyKey = (orgId: string) => `crawl:${orgId}` as const
export const processConcurrencyKey = (orgId: string) =>
  `process:${orgId}` as const
