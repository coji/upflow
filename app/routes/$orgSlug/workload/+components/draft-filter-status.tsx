import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { Button } from '~/app/components/ui/button'

export interface DraftFilterStatusState {
  draftCount: number
  hideDrafts: boolean
}

/**
 * Review Stacks 右上に置く Draft フィルタのトグル。
 *  - hideDrafts=false && draftCount>0 → "Hide N drafts" button (?hideDrafts=1 へ)
 *  - hideDrafts=true && draftCount>0 → "N drafts hidden" button (解除へ)
 *  - draftCount=0 → null
 */
export function DraftFilterStatus({
  draftCount,
  hideDrafts,
}: DraftFilterStatusState) {
  const location = useLocation()

  if (draftCount <= 0) {
    return null
  }

  const label = `${draftCount} draft${draftCount === 1 ? '' : 's'}`

  if (hideDrafts) {
    return (
      <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild>
        <Link
          to={buildHref(location, (p) => p.delete('hideDrafts'))}
          replace
          aria-label={`Show all drafts (${label} hidden)`}
        >
          <EyeOffIcon size={14} />
          {label} hidden
        </Link>
      </Button>
    )
  }

  return (
    <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild>
      <Link
        to={buildHref(location, (p) => p.set('hideDrafts', '1'))}
        replace
        aria-label={`Hide ${label}`}
      >
        <EyeIcon size={14} />
        Hide {label}
      </Link>
    </Button>
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
