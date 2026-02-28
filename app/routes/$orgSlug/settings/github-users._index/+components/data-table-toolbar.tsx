import type { Table } from '@tanstack/react-table'
import { ExternalLinkIcon, LoaderIcon, PlusIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher, useSearchParams } from 'react-router'
import { AppDataTableViewOptions } from '~/app/components/AppDataTableViewOption'
import { SearchInput } from '~/app/components/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import { Button } from '~/app/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/app/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui/popover'
import { useDataTableState } from '../+hooks/use-data-table-state'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { queries, updateQueries, isFiltered, resetFilters } =
    useDataTableState()
  const currentLoginStatus = searchParams.get('loginStatus') ?? '__all__'
  const searchFetcher = useFetcher<{
    candidates: { login: string; avatarUrl: string }[]
  }>()
  const addFetcher = useFetcher()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const isComposingRef = useRef(false)
  const loadRef = useRef(searchFetcher.load)
  loadRef.current = searchFetcher.load

  const debouncedSearch = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) return
    debounceRef.current = setTimeout(() => {
      loadRef.current(`?q=${encodeURIComponent(value.trim())}`)
    }, 300)
  }, [])

  useEffect(() => {
    if (!isComposingRef.current) {
      debouncedSearch(searchValue)
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchValue, debouncedSearch])

  const existingLogins = new Set(
    table.getCoreRowModel().rows.map((row) => row.id),
  )
  const candidates = searchFetcher.data?.candidates ?? []
  const isSearching = searchFetcher.state === 'loading'

  const handleSelect = (login: string) => {
    if (existingLogins.has(login)) return
    addFetcher.submit(
      { intent: 'add', login, displayName: login },
      { method: 'POST' },
    )
    setOpen(false)
    setSearchValue('')
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
        <Select
          value={currentLoginStatus}
          onValueChange={(value) => {
            setSearchParams(
              (prev) => {
                if (value === '__all__') {
                  prev.delete('loginStatus')
                } else {
                  prev.set('loginStatus', value)
                }
                prev.delete('page')
                return prev
              },
              { preventScrollReset: true },
            )
          }}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="Login" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            <SelectItem value="allowed">Allowed</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
          </SelectContent>
        </Select>
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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm">
              <PlusIcon className="mr-1 h-4 w-4" />
              追加
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="GitHub login を検索..."
                value={searchValue}
                onValueChange={setSearchValue}
                onCompositionStart={() => {
                  isComposingRef.current = true
                }}
                onCompositionEnd={() => {
                  isComposingRef.current = false
                  debouncedSearch(searchValue)
                }}
              />
              <CommandList>
                {isSearching ? (
                  <div className="flex items-center justify-center py-6">
                    <LoaderIcon className="text-muted-foreground h-4 w-4 animate-spin" />
                  </div>
                ) : searchValue.trim() ? (
                  <>
                    <CommandEmpty>見つかりませんでした</CommandEmpty>
                    <CommandGroup>
                      {candidates.map((user) => (
                        <CommandItem
                          key={user.login}
                          value={user.login}
                          disabled={existingLogins.has(user.login)}
                          onSelect={() => handleSelect(user.login)}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <Avatar className="mr-2 h-6 w-6">
                              <AvatarImage
                                src={user.avatarUrl}
                                alt={user.login}
                              />
                              <AvatarFallback>
                                {user.login.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{user.login}</span>
                            {existingLogins.has(user.login) && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                登録済み
                              </span>
                            )}
                          </div>
                          <a
                            href={`https://github.com/${user.login}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground ml-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLinkIcon className="h-3.5 w-3.5" />
                          </a>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                ) : (
                  <div className="text-muted-foreground py-6 text-center text-sm">
                    GitHub login を入力してください
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <AppDataTableViewOptions table={table} />
      </div>
    </div>
  )
}
