import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react'
import { Button } from '~/app/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui/select'
import {
  PAGINATION_PER_PAGE_ITEMS,
  useDataTableState,
} from '../+hooks/use-data-table-state'

export interface PaginationProps {
  currentPage: number
  pageSize: number
  totalPages: number
  totalItems: number
}

export function DataTablePagination({
  pagination: { currentPage, pageSize, totalPages, totalItems },
}: {
  pagination: PaginationProps
}) {
  const { updatePagination } = useDataTableState()

  return (
    <div className="flex items-center justify-between overflow-auto px-2">
      <div className="text-muted-foreground hidden flex-1 text-sm sm:block">
        {totalItems} GitHub user(s) total.
      </div>
      <div className="flex items-center sm:space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="hidden text-sm font-medium sm:block">Rows per page</p>
          <Select
            defaultValue={`${pageSize}`}
            onValueChange={(value) => {
              const newPerPage = Number(value)
              const newTotalPages = Math.ceil(totalItems / newPerPage)
              updatePagination({
                per_page: newPerPage,
                ...(currentPage > newTotalPages ? { page: newTotalPages } : {}),
              })
            }}
          >
            <SelectTrigger className="h-8 w-17.5">
              <SelectValue placeholder={`${pageSize}`} />
            </SelectTrigger>
            <SelectContent side="top">
              {PAGINATION_PER_PAGE_ITEMS.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-25 items-center justify-center text-sm font-medium">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => updatePagination({ page: 1 })}
            disabled={currentPage === 1}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => updatePagination({ page: currentPage - 1 })}
            disabled={currentPage === 1}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => updatePagination({ page: currentPage + 1 })}
            disabled={currentPage === totalPages || totalPages === 1}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => updatePagination({ page: totalPages })}
            disabled={currentPage === totalPages || totalPages === 1}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
