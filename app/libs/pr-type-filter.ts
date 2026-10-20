import { OPTIONAL_PR_TYPES, type OptionalPrType, type PrType } from './pr-type'

/**
 * 集計に含める PR 種別の URL パラメータ (#429)。
 * normal は常に含め、release / template-merge / dependency は
 * `?prTypes=release,dependency` のように明示したときだけ含める。
 */
export const PR_TYPES_SEARCH_PARAM = 'prTypes'

export function parseIncludedPrTypes(
  searchParams: URLSearchParams,
): OptionalPrType[] {
  const raw = searchParams.get(PR_TYPES_SEARCH_PARAM)
  if (!raw) return []
  const requested = new Set(raw.split(','))
  return OPTIONAL_PR_TYPES.filter((t) => requested.has(t))
}

export function toAllowedPrTypes(
  included: readonly OptionalPrType[],
): PrType[] {
  return ['normal', ...included]
}

export function setIncludedPrTypes(
  searchParams: URLSearchParams,
  included: readonly OptionalPrType[],
): URLSearchParams {
  const ordered = OPTIONAL_PR_TYPES.filter((t) => included.includes(t))
  if (ordered.length === 0) {
    searchParams.delete(PR_TYPES_SEARCH_PARAM)
  } else {
    searchParams.set(PR_TYPES_SEARCH_PARAM, ordered.join(','))
  }
  return searchParams
}
