const PARSE_LINK_HEADER_MAXLEN = process.env.PARSE_LINK_HEADER_MAXLEN
  ? Number.parseInt(process.env.PARSE_LINK_HEADER_MAXLEN)
  : 2000
const PARSE_LINK_HEADER_THROW_ON_MAXLEN_EXCEEDED =
  process.env.PARSE_LINK_HEADER_THROW_ON_MAXLEN_EXCEEDED != null

export type LinkRel = 'first' | 'prev' | 'next' | 'last'

export interface GitHubLink {
  url: string
  rel: string // ヘッダー内では複数指定の可能性があるため string
  page?: string
  per_page?: string
  sort?: string
  [key: string]: string | undefined
}

export type GitHubLinkMap = Partial<Record<LinkRel, GitHubLink>>

const allowedRels: LinkRel[] = ['first', 'prev', 'next', 'last']

function hasRel(x: unknown): x is GitHubLink {
  return typeof x === 'object' && x !== null && 'rel' in x
}

function intoRels(acc: GitHubLinkMap, x: GitHubLink): GitHubLinkMap {
  for (const rel of x.rel.split(/\s+/)) {
    if (allowedRels.includes(rel as LinkRel)) {
      acc[rel as LinkRel] = { ...x, rel }
    }
  }
  return acc
}

function createObjects(
  acc: Record<string, string>,
  p: string,
): Record<string, string> {
  const m = p.match(/\s*(.+)\s*=\s*"?([^"]+)"?/)
  if (m) acc[m[1]] = m[2]
  return acc
}

function parseLink(link: string): GitHubLink | null {
  try {
    const m = link.match(/<?([^>]*)>(.*)/)
    if (!m) return null
    const linkUrl = m[1]
    const parts = m[2].split(';')
    parts.shift()

    const urlObj = new URL(linkUrl, 'http://example.com')
    const query: Record<string, string> = {}
    urlObj.searchParams.forEach((value, key) => {
      query[key] = value
    })
    const attrs = parts.reduce(createObjects, {} as Record<string, string>)
    return { ...query, ...attrs, url: linkUrl, rel: attrs.rel || '' }
  } catch {
    return null
  }
}

function checkHeader(linkHeader: string): boolean {
  if (linkHeader.length > PARSE_LINK_HEADER_MAXLEN) {
    if (PARSE_LINK_HEADER_THROW_ON_MAXLEN_EXCEEDED) {
      throw new Error(
        `Input string too long, it should be under ${PARSE_LINK_HEADER_MAXLEN} characters.`,
      )
    }
    return false
  }
  return true
}

export function parseLinkHeader(linkHeader?: string): GitHubLinkMap {
  const defaultMap: GitHubLinkMap = {
    first: undefined,
    prev: undefined,
    next: undefined,
    last: undefined,
  }
  if (linkHeader === undefined) return defaultMap
  if (!checkHeader(linkHeader)) return defaultMap
  return linkHeader
    .split(/,\s*</)
    .map(parseLink)
    .filter((link): link is GitHubLink => link !== null && hasRel(link))
    .reduce(intoRels, defaultMap)
}
