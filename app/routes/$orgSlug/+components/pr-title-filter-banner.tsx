import { FilterIcon, FilterXIcon } from 'lucide-react'
import { Link, href, useLocation, useParams } from 'react-router'
import { Alert, AlertDescription } from '~/app/components/ui/alert'
import { Button } from '~/app/components/ui/button'

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
      <Alert>
        <FilterXIcon />
        <AlertDescription>
          <div className="flex items-center justify-between gap-2">
            <span>Title filter disabled. Showing all PRs.</span>
            <Button asChild size="sm" variant="outline">
              <Link to={restoreHref} replace>
                Re-enable filter
              </Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
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
    <Alert>
      <FilterIcon />
      <AlertDescription>
        <div className="flex items-center justify-between gap-2">
          <span>
            {excludedCount} PR{excludedCount === 1 ? '' : 's'} hidden by title
            filter in this view.
          </span>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to={showAllHref} replace>
                Show all
              </Link>
            </Button>
            {isAdmin && settingsHref != null && (
              <Button asChild size="sm" variant="outline">
                <Link to={settingsHref}>Manage filters</Link>
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}
