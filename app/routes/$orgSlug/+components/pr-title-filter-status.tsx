import { FilterIcon, FilterXIcon } from 'lucide-react'
import { Link, href, useLocation, useParams } from 'react-router'
import { Button } from '~/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/app/components/ui/dropdown-menu'

export interface PrFilterBannerState {
  excludedCount: number
  filterActive: boolean
  showFiltered: boolean
  isAdmin: boolean
}

/**
 * PageHeaderActions 右上などに置く、フィルタ状態を示す小さい button + dropdown。
 *  - filterActive && excludedCount>0 → 件数表示 button + "Show all" / "Manage"
 *  - showFiltered=true → "Filter off" button + "Re-enable"
 *  - それ以外 → null
 */
export function PrTitleFilterStatus({
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
      <Button
        asChild
        size="sm"
        variant="outline"
        className="h-8 gap-1.5"
        title="Re-enable title filter"
      >
        <Link to={restoreHref} replace aria-label="Re-enable title filter">
          <FilterXIcon size={14} />
          Filter off
        </Link>
      </Button>
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          aria-label={`${excludedCount} PRs hidden by title filter`}
        >
          <FilterIcon size={14} />
          {excludedCount} hidden
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={showAllHref} replace>
            Show all PRs
          </Link>
        </DropdownMenuItem>
        {isAdmin && settingsHref != null && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={settingsHref}>Manage filters…</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
