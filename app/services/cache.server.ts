// Process-local org-scoped cache. The store is a `Map` in process memory:
// it survives across requests within a single Node process but is invisible
// to other processes / restarts. Mutations that go through this codebase
// must call `clearOrgCache(orgId)` after the write so the next read sees
// the fresh state — see existing call sites in `pr-title-filter-mutations`,
// `github-app-mutations`, `api.github.setup`, `github-webhook.server`,
// and the `crawl` / `shared-steps` jobs.
//
// Cross-process / bypass-the-app caveat: a raw SQL write to a tenant DB
// (e.g. `fly ssh` + `sqlite3` for an emergency disable) cannot invalidate
// this Map, so cached results stay live for up to the TTL (default 5 min).
// If you bypass the app to write, also restart the process or call
// `clearAllCache()` on app start. This is the architectural cost of using
// process-local caching; documented in
// `docs/rdd/issue-307-pr-title-filter.md:469` for the pr_title_filters
// emergency-disable case but the rule is general to every cached table.

type CacheEntry = { data: Promise<unknown>; expires: number }

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
    return entry.data as Promise<T>
  }
  // Store the in-flight promise so concurrent callers share a single loader
  // invocation. Without this, N concurrent cold-miss requests for the same key
  // all run loader() in parallel.
  const promise = loader()
  store.set(key, { data: promise, expires: now + ttl })
  promise.catch(() => {
    if (store.get(key)?.data === promise) {
      store.delete(key)
    }
  })
  return promise
}

export const clearOrgCache = (orgId: string) => {
  orgCacheStore.delete(orgId)
}

export const clearAllCache = () => {
  orgCacheStore.clear()
}
