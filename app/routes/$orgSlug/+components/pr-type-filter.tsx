import { ListFilterIcon } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '~/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/app/components/ui/dropdown-menu'
import { OPTIONAL_PR_TYPES, PR_TYPE_LABELS } from '~/app/libs/pr-type'
import {
  parseIncludedPrTypes,
  setIncludedPrTypes,
} from '~/app/libs/pr-type-filter'

/**
 * 集計に含める PR 種別のトグル (#429)。normal は常に含み、release /
 * template-merge / dependency を個別に追加できる。状態は `?prTypes=` に持つ。
 */
export function PrTypeFilter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const included = parseIncludedPrTypes(searchParams)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="PR types to include">
          <ListFilterIcon className="h-4 w-4" />
          PR types
          {included.length > 0 && (
            <span className="text-muted-foreground">+{included.length}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Include in metrics</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked disabled>
          {PR_TYPE_LABELS.normal}
        </DropdownMenuCheckboxItem>
        {OPTIONAL_PR_TYPES.map((type) => (
          <DropdownMenuCheckboxItem
            key={type}
            checked={included.includes(type)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => {
              setSearchParams((prev) =>
                setIncludedPrTypes(
                  prev,
                  checked
                    ? [...included, type]
                    : included.filter((t) => t !== type),
                ),
              )
            }}
          >
            {PR_TYPE_LABELS[type]}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <p className="text-muted-foreground px-2 py-1.5 text-xs">
          Release, template merge and dependency PRs are excluded by default:
          their cycle time does not reflect human work.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
