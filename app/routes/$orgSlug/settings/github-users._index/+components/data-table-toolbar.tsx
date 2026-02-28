import { PlusIcon, XIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { SearchInput } from '~/app/components/search-input'
import { Button } from '~/app/components/ui/button'
import { Input } from '~/app/components/ui/input'
import { useDataTableState } from '../+hooks/use-data-table-state'

export function DataTableToolbar() {
  const { queries, updateQueries, isFiltered, resetFilters } =
    useDataTableState()
  const fetcher = useFetcher()
  const [isAdding, setIsAdding] = useState(false)
  const loginRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    const login = loginRef.current?.value.trim()
    if (!login) return
    fetcher.submit(
      { intent: 'add', login, displayName: login },
      { method: 'POST' },
    )
    setIsAdding(false)
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
        <SearchInput
          value={queries.search}
          onChange={(value) => {
            updateQueries({ search: value })
          }}
          placeholder="Filter GitHub users..."
          className="w-48 lg:w-64"
        />
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => resetFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <XIcon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isAdding ? (
          <>
            <Input
              ref={loginRef}
              placeholder="GitHub login"
              className="h-8 w-48"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAdd()
                }
                if (e.key === 'Escape') {
                  setIsAdding(false)
                }
              }}
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={fetcher.state !== 'idle'}
            >
              追加
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsAdding(false)}
            >
              キャンセル
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <PlusIcon className="mr-1 h-4 w-4" />
            追加
          </Button>
        )}
      </div>
    </div>
  )
}
