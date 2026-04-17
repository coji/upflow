import { FilterIcon, FilterXIcon } from 'lucide-react'
import { Link, href, useLocation, useParams } from 'react-router'

export interface PrFilterBannerState {
  excludedCount: number
  filterActive: boolean
  showFiltered: boolean
  isAdmin: boolean
}

/**
 * 表示:
 *  - showFiltered=true → `フィルタ無効化中` バナー + 元に戻すリンク
 *  - filterActive=true && excludedCount>0 → `N 件除外中` バナー + すべて表示 (+ admin なら 設定へ)
 *  - それ以外 → null
 */
export function PrTitleFilterBanner({
  excludedCount,
  filterActive,
  showFiltered,
  isAdmin,
}: PrFilterBannerState) {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const location = useLocation()

  if (showFiltered) {
    const params = new URLSearchParams(location.search)
    params.delete('showFiltered')
    const restoreHref = `${location.pathname}${
      params.toString() ? `?${params.toString()}` : ''
    }`
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <FilterXIcon size={12} />
        <span>Title filter disabled. Showing all PRs.</span>
        <Link
          to={restoreHref}
          replace
          className="text-foreground underline-offset-2 hover:underline"
        >
          Re-enable
        </Link>
      </div>
    )
  }

  if (!filterActive || excludedCount <= 0) {
    return null
  }

  const params = new URLSearchParams(location.search)
  params.set('showFiltered', '1')
  const showAllHref = `${location.pathname}?${params.toString()}`

  const settingsHref =
    orgSlug != null ? href('/:orgSlug/settings/pr-filters', { orgSlug }) : null

  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs">
      <FilterIcon size={12} />
      <span>
        {excludedCount} hidden by title filter
        <span aria-hidden> · </span>
      </span>
      <Link
        to={showAllHref}
        replace
        className="text-foreground underline-offset-2 hover:underline"
      >
        Show all
      </Link>
      {isAdmin && settingsHref != null && (
        <>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <Link
            to={settingsHref}
            className="text-foreground underline-offset-2 hover:underline"
          >
            Manage
          </Link>
        </>
      )}
    </div>
  )
}
