import { ListFilterIcon } from 'lucide-react'
import { Link, href, useParams, useSearchParams } from 'react-router'
import { Button } from '~/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/app/components/ui/dropdown-menu'
import {
  HIDDEN_PR_REASON_LABELS,
  type HiddenPrReason,
  type HiddenPrSummary,
} from '~/app/libs/hidden-prs'
import { OPTIONAL_PR_TYPES, type OptionalPrType } from '~/app/libs/pr-type'
import {
  parseIncludedPrTypes,
  setIncludedPrTypes,
} from '~/app/libs/pr-type-filter'

const isOptionalPrType = (reason: HiddenPrReason): reason is OptionalPrType =>
  (OPTIONAL_PR_TYPES as readonly string[]).includes(reason)

/** reason を隠す (hidden=true) / 表示する状態に URL を書き換える */
export function setReasonHidden(
  params: URLSearchParams,
  reason: HiddenPrReason,
  hidden: boolean,
): URLSearchParams {
  if (isOptionalPrType(reason)) {
    const included = parseIncludedPrTypes(params)
    return setIncludedPrTypes(
      params,
      hidden ? included.filter((t) => t !== reason) : [...included, reason],
    )
  }
  if (reason === 'draft') {
    if (hidden) params.set('hideDrafts', '1')
    else params.delete('hideDrafts')
    return params
  }
  if (hidden) params.delete('showFiltered')
  else params.set('showFiltered', '1')
  return params
}

/** URL パラメータがないときの状態。種別とフィルタは隠す、Draft は表示する */
const DEFAULT_HIDDEN: Record<HiddenPrReason, boolean> = {
  release: true,
  'template-merge': true,
  dependency: true,
  draft: false,
  filter: true,
}

/**
 * 画面から隠している PR の件数と、その理由ごとの切り替え。
 * 種別 (`?prTypes=`)、Draft (`?hideDrafts=1`)、タイトル・ブランチのフィルタ
 * (`?showFiltered=1`) を 1 つにまとめる。チェックは「いま隠している」を表す。
 */
export function HiddenPrsMenu({
  summary,
  isAdmin,
}: {
  summary: HiddenPrSummary
  isAdmin: boolean
}) {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  // 件数 0 で既定どおりの行は出さない (該当 PR がない理由を並べても判断材料にならない)。
  // 既定から外した行は 0 件でも残し、元に戻せるようにする
  const rows = summary.reasons.filter(
    (r) => r.count > 0 || r.active !== DEFAULT_HIDDEN[r.reason],
  )
  if (rows.length === 0) {
    return null
  }

  const label =
    summary.hiddenCount > 0 ? `${summary.hiddenCount}件を非表示` : '非表示なし'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 tabular-nums"
          aria-label={`${label}。非表示にする PR を選ぶ`}
        >
          <ListFilterIcon size={14} />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>この画面で非表示にしている PR</DropdownMenuLabel>
        {rows.map(({ reason, active, count }) => (
          <DropdownMenuCheckboxItem
            key={reason}
            checked={active}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => {
              setSearchParams(
                (prev) => setReasonHidden(prev, reason, checked === true),
                { replace: true },
              )
            }}
          >
            <span>{HIDDEN_PR_REASON_LABELS[reason]}</span>
            <span
              className={`ml-auto tabular-nums ${count === 0 ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}
            >
              {count}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={summary.hiddenCount === 0}
          onSelect={() => {
            setSearchParams(
              (prev) =>
                summary.reasons.reduce(
                  (params, { reason }) =>
                    setReasonHidden(params, reason, false),
                  prev,
                ),
              { replace: true },
            )
          }}
        >
          すべて表示する
        </DropdownMenuItem>
        {isAdmin && orgSlug != null && (
          <DropdownMenuItem asChild>
            <Link to={href('/:orgSlug/settings/pr-filters', { orgSlug })}>
              フィルタを管理…
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
