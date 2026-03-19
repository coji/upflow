import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { z } from 'zod'
import { useDebounce } from '~/app/hooks/use-debounce'

export const PAGINATION_PER_PAGE_DEFAULT = '20'
export const PAGINATION_PER_PAGE_ITEMS = ['10', '20', '30', '40', '50'] as const

export const QuerySchema = z.object({
  search: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.string().optional().default(''),
  ),
  loginStatus: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.string().optional().default(''),
  ),
})

export const SortSchema = z.object({
  sort_by: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.string().optional(),
  ),
  sort_order: z.preprocess(
    (val) => (val === null ? undefined : val),
    z
      .union([z.literal('asc'), z.literal('desc')])
      .optional()
      .default('desc'),
  ),
})

export const PaginationSchema = z.object({
  page: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.string().optional().default('1').transform(Number),
  ),
  per_page: z.preprocess(
    (val) => (val === null ? undefined : val),
    z
      .enum(PAGINATION_PER_PAGE_ITEMS)
      .optional()
      .default(PAGINATION_PER_PAGE_DEFAULT)
      .transform(Number),
  ),
})

export type Queries = z.infer<typeof QuerySchema>
export type Sort = z.infer<typeof SortSchema>
export type Pagination = z.infer<typeof PaginationSchema>

export function useDataTableState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const debounce = useDebounce(200)

  const queries: Queries = useMemo(() => {
    return QuerySchema.parse({
      search: searchParams.get('search'),
      loginStatus: searchParams.get('loginStatus'),
    })
  }, [searchParams])

  const sort: Sort = useMemo(() => {
    return SortSchema.parse({
      sort_by: searchParams.get('sort_by'),
      sort_order: searchParams.get('sort_order') as 'asc' | 'desc' | null,
    })
  }, [searchParams])

  const pagination: Pagination = useMemo(() => {
    return PaginationSchema.parse({
      page: searchParams.get('page'),
      per_page: searchParams.get('per_page'),
    })
  }, [searchParams])

  const updateQueries = (newQueries: Partial<Queries>) => {
    debounce(() => {
      setSearchParams(
        (prev) => {
          for (const [key, value] of Object.entries(newQueries)) {
            if (value === undefined || value === '') {
              prev.delete(key)
            } else {
              prev.set(key, value)
            }
          }
          prev.delete('page')
          return prev
        },
        { preventScrollReset: true },
      )
    })
  }

  const updateSort = (newSort: Partial<Sort>) => {
    setSearchParams(
      (prev) => {
        if (newSort.sort_by) {
          prev.set('sort_by', newSort.sort_by)
          prev.set('sort_order', newSort.sort_order || 'desc')
        } else {
          prev.delete('sort_by')
          prev.delete('sort_order')
        }
        prev.delete('page')
        return prev
      },
      { preventScrollReset: true },
    )
  }

  const updatePagination = (newPagination: Partial<Pagination>) => {
    setSearchParams(
      (prev) => {
        if (newPagination.page !== undefined) {
          if (newPagination.page === 1) {
            prev.delete('page')
          } else {
            prev.set('page', String(newPagination.page))
          }
        }

        if (newPagination.per_page !== undefined) {
          if (newPagination.per_page === Number(PAGINATION_PER_PAGE_DEFAULT)) {
            prev.delete('per_page')
          } else {
            prev.set('per_page', String(newPagination.per_page))
          }
        }
        return prev
      },
      { preventScrollReset: true },
    )
  }

  const isFiltered = Object.values(queries).some((query) => query !== '')
  const resetFilters = () => {
    setSearchParams({}, { preventScrollReset: true })
  }

  return {
    queries,
    sort,
    pagination,
    updateQueries,
    updateSort,
    updatePagination,
    isFiltered,
    resetFilters,
  }
}
