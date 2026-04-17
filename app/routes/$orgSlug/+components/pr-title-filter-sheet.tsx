import { AlertCircleIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { href, useFetcher, useParams } from 'react-router'
import { Badge, Button, Input, Label, Stack } from '~/app/components/ui'
import { Alert, AlertDescription } from '~/app/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '~/app/components/ui/sheet'
import {
  extractPatternCandidates,
  matchesPattern,
  normalizePattern,
  PR_TITLE_FILTER_PATTERN_MAX_LENGTH,
  PR_TITLE_FILTER_PATTERN_MIN_LENGTH,
} from '~/app/libs/pr-title-filter'

interface RecentTitleRow {
  repositoryId: string
  number: number
  title: string
}

interface PrTitleFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** trigger 起動時の PR タイトル (候補自動抽出の種) */
  pullRequestTitle: string | null
}

/**
 * 管理者が PR 行 `⋯` メニューから起動する Sheet。
 * 1) 開いた瞬間に recent titles を lazy fetch
 * 2) 候補チップ + 自由入力、それぞれ直近 90 日のマッチ件数とプレビューを即時表示
 * 3) `POST /{orgSlug}/settings/pr-filters` に submit し、成功したら close
 */
export function PrTitleFilterSheet({
  open,
  onOpenChange,
  pullRequestTitle,
}: PrTitleFilterSheetProps) {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const titlesFetcher = useFetcher<{ titles: RecentTitleRow[]; days: number }>()
  // lastResult は Conform の SubmissionResult 形状 (error['']?.[0] に formErrors)。
  // UNIQUE 違反等のサーバー側エラーを Sheet 内に表示するために参照する。
  const submitFetcher = useFetcher<{
    ok?: boolean
    lastResult?: { error?: Record<string, string[] | undefined> | null } | null
  }>()

  const [pattern, setPattern] = useState('')

  // open 時に lazy fetch (1 回だけ)。close 時は state をリセットして再 fetch 可能に。
  useEffect(() => {
    if (!open || !orgSlug) return
    if (titlesFetcher.state === 'idle' && titlesFetcher.data == null) {
      titlesFetcher.load(
        href('/:orgSlug/resources/pr-titles-recent', { orgSlug }),
      )
    }
  }, [open, orgSlug, titlesFetcher])

  // submit 成功後は close
  useEffect(() => {
    if (submitFetcher.state === 'idle' && submitFetcher.data?.ok === true) {
      onOpenChange(false)
    }
  }, [submitFetcher.state, submitFetcher.data, onOpenChange])

  // close するたびに pattern 入力をリセット (別 PR 行で開いたとき前の入力が残らないように)
  useEffect(() => {
    if (!open) {
      setPattern('')
    }
  }, [open])

  const candidates = useMemo(
    () => (pullRequestTitle ? extractPatternCandidates(pullRequestTitle) : []),
    [pullRequestTitle],
  )

  const titles = titlesFetcher.data?.titles ?? []
  const days = titlesFetcher.data?.days ?? 90

  const countMatches = useCallback(
    (p: string) => {
      const normalized = normalizePattern(p)
      if (normalized.length < PR_TITLE_FILTER_PATTERN_MIN_LENGTH) return 0
      let count = 0
      for (const t of titles) {
        if (matchesPattern(t.title, normalized)) count++
      }
      return count
    },
    [titles],
  )

  const trimmedPattern = pattern.trim()
  const normalized = normalizePattern(pattern)
  const canSubmit =
    normalized.length >= PR_TITLE_FILTER_PATTERN_MIN_LENGTH &&
    normalized.length <= PR_TITLE_FILTER_PATTERN_MAX_LENGTH &&
    submitFetcher.state === 'idle'

  const previewMatches = useMemo(() => {
    if (normalized.length < PR_TITLE_FILTER_PATTERN_MIN_LENGTH) return []
    const out: RecentTitleRow[] = []
    for (const t of titles) {
      if (matchesPattern(t.title, normalized)) {
        out.push(t)
        if (out.length >= 20) break
      }
    }
    return out
  }, [titles, normalized])

  const matchCount = useMemo(
    () => countMatches(trimmedPattern),
    [countMatches, trimmedPattern],
  )

  const submitError =
    submitFetcher.data?.ok === false
      ? (submitFetcher.data.lastResult?.error?.[''] ?? [])[0]
      : undefined

  const handleSubmit = () => {
    if (!orgSlug || !canSubmit) return
    const formData = new FormData()
    formData.set('intent', 'create')
    formData.set('pattern', trimmedPattern)
    submitFetcher.submit(formData, {
      method: 'post',
      action: href('/:orgSlug/settings/pr-filters', { orgSlug }),
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Hide PRs by title</SheetTitle>
          <SheetDescription>
            Pick a suggested pattern or type your own. Case-insensitive
            substring match. This filter applies across the entire organization.
          </SheetDescription>
        </SheetHeader>

        <Stack gap="4" className="p-4">
          {candidates.length > 0 && (
            <Stack gap="2">
              <Label>Suggested patterns</Label>
              <div className="flex flex-wrap gap-2">
                {candidates.map((c) => {
                  const cnt = countMatches(c.value)
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setPattern(c.value)}
                      className="group"
                    >
                      <Badge variant="outline" className="font-mono">
                        {c.label}
                        <span className="text-muted-foreground ml-2 text-xs">
                          {cnt}
                        </span>
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </Stack>
          )}

          <Stack gap="1">
            <Label htmlFor="pr-filter-pattern">Pattern</Label>
            <Input
              id="pr-filter-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. [DO NOT MERGE]"
              maxLength={PR_TITLE_FILTER_PATTERN_MAX_LENGTH}
              className="font-mono"
            />
            <p className="text-muted-foreground text-xs">
              {matchCount} PR{matchCount === 1 ? '' : 's'} match in the last{' '}
              {days} days across the organization.
            </p>
          </Stack>

          {previewMatches.length > 0 && (
            <Stack gap="1">
              <Label>Preview (top 20)</Label>
              <ul className="max-h-64 overflow-auto rounded-md border">
                {previewMatches.map((p) => (
                  <li
                    key={`${p.repositoryId}:${p.number}`}
                    className="border-b px-3 py-1.5 text-sm last:border-0"
                  >
                    {p.title}
                  </li>
                ))}
              </ul>
            </Stack>
          )}

          {submitError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
        </Stack>

        <SheetFooter>
          <Button
            type="button"
            onClick={handleSubmit}
            loading={submitFetcher.state !== 'idle'}
            disabled={!canSubmit}
          >
            Add filter
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
