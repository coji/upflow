// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const cacheStore: Record<string, { data: any; expires: number }> = {}

export function getCachedData<T>(
  key: string,
  loader: () => Promise<T>,
  ttl = 300000,
): Promise<T> {
  const now = Date.now()
  const entry = cacheStore[key]
  if (entry && entry.expires > now) {
    return entry.data
  }
  return loader().then((data) => {
    cacheStore[key] = { data, expires: now + ttl }
    return data
  })
}

export const clearAllCache = () => {
  for (const key in cacheStore) {
    delete cacheStore[key]
  }
}

export const clearCache = (key: string) => {
  delete cacheStore[key]
}
