import { FilterIcon, FilterXIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
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

  const settingsHref =
    isAdmin && orgSlug != null
      ? href('/:orgSlug/settings/pr-filters', { orgSlug })
      : null

  if (showFiltered) {
    return (
      <StatusDropdown
        Icon={FilterXIcon}
        label="Filter off"
        buttonClassName="text-muted-foreground"
        ariaLabel="Title filter is off"
        primaryAction={{
          href: buildHref(location, (p) => p.delete('showFiltered')),
          label: 'Re-enable filter',
        }}
        settingsHref={settingsHref}
      />
    )
  }

  if (!filterActive || excludedCount <= 0) {
    return null
  }

  return (
    <StatusDropdown
      Icon={FilterIcon}
      label={`${excludedCount} hidden`}
      ariaLabel={`${excludedCount} PRs hidden by title filter`}
      primaryAction={{
        href: buildHref(location, (p) => p.set('showFiltered', '1')),
        label: 'Show all PRs',
      }}
      settingsHref={settingsHref}
    />
  )
}

function StatusDropdown({
  Icon,
  label,
  buttonClassName,
  ariaLabel,
  primaryAction,
  settingsHref,
}: {
  Icon: LucideIcon
  label: ReactNode
  buttonClassName?: string
  ariaLabel: string
  primaryAction: { href: string; label: string }
  settingsHref: string | null
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={`h-8 gap-1.5 ${buttonClassName ?? ''}`}
          aria-label={ariaLabel}
        >
          <Icon size={14} />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={primaryAction.href} replace>
            {primaryAction.label}
          </Link>
        </DropdownMenuItem>
        {settingsHref != null && (
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

function buildHref(
  location: { pathname: string; search: string },
  mutate: (params: URLSearchParams) => void,
): string {
  const params = new URLSearchParams(location.search)
  mutate(params)
  const query = params.toString()
  return `${location.pathname}${query ? `?${query}` : ''}`
}
