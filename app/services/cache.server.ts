// biome-ignore lint/suspicious/noExplicitAny: simple in-memory cache implementation
type CacheEntry = { data: any; expires: number }

/** org-scoped two-level cache: orgId → key → entry */
const orgCacheStore = new Map<string, Map<string, CacheEntry>>()

function getOrgStore(orgId: string): Map<string, CacheEntry> {
  let store = orgCacheStore.get(orgId)
  if (!store) {
    store = new Map()
    orgCacheStore.set(orgId, store)
  }
  return store
}

export function getOrgCachedData<T>(
  orgId: string,
  key: string,
  loader: () => Promise<T>,
  ttl = 300000,
): Promise<T> {
  const now = Date.now()
  const store = getOrgStore(orgId)
  const entry = store.get(key)
  if (entry && entry.expires > now) {
    return entry.data
  }
  return loader().then((data) => {
    store.set(key, { data, expires: now + ttl })
    return data
  })
}

export const clearOrgCache = (orgId: string) => {
  orgCacheStore.delete(orgId)
}

export const clearAllCache = () => {
  orgCacheStore.clear()
}
