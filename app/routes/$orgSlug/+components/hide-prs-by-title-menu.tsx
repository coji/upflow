import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontalIcon } from 'lucide-react'
import { createContext, useContext } from 'react'
import { Button } from '~/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/app/components/ui/dropdown-menu'
import { cn } from '~/app/libs/utils'

/**
 * `HidePRsByTitleMenu` 内で trigger を出すための context。
 * null (provide されない) / null 値の場合はボタン非表示。admin のみ表示する親ページが value を設定する。
 */
export const PRHideByTitleFilterContext = createContext<
  ((title: string) => void) | null
>(null)

export function HidePRsByTitleMenu({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  const onHideByTitle = useContext(PRHideByTitleFilterContext)
  if (!onHideByTitle) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn('size-5', className)}
          aria-label="More actions"
        >
          <MoreHorizontalIcon size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onHideByTitle(title)}>
          Hide PRs by title…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * TanStack Table の末尾に差し込む「admin 専用 actions 列」を返す。
 * 非 admin には空配列を返すので spread で呼び出し側に負担を残さない。
 */
export function hidePrActionsColumn<T>(
  isAdmin: boolean,
  getTitle: (row: T) => string | null | undefined,
): ColumnDef<T>[] {
  if (!isAdmin) return []
  return [
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const title = getTitle(row.original)
        return title ? <HidePRsByTitleMenu title={title} /> : null
      },
      enableHiding: false,
      enableSorting: false,
    },
  ]
}
