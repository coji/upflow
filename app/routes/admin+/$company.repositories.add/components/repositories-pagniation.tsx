import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button, HStack } from '~/app/components/ui'

interface RepositoriesPaginationProps {
  page: number
  link: {
    first?: string
    prev?: string
    next?: string
    last?: string
  }
}
export const RepositoriesPagination = ({
  page,
  link,
}: RepositoriesPaginationProps) => {
  const [searchParams, setSearchParams] = useSearchParams()

  return (
    <HStack className="justify-end">
      <div className="text-xs">
        Page {page} / {link.last}
      </div>

      <HStack>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={!link.first}
          onClick={() => {
            if (link.prev) {
              setSearchParams(
                (prev) => {
                  prev.delete('page')
                  return prev
                },
                {
                  preventScrollReset: true,
                },
              )
            }
          }}
        >
          <ChevronsLeftIcon className="h-4 w-4" />
          <span className="sr-only">First</span>
        </Button>

        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={!link.prev}
          onClick={() => {
            setSearchParams(
              (prev) => {
                if (link.prev === undefined || link.prev === '1') {
                  prev.delete('page')
                } else {
                  prev.set('page', link.prev)
                }
                return prev
              },
              {
                preventScrollReset: true,
              },
            )
          }}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          <span className="sr-only">Previous</span>
        </Button>

        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={!link.next}
          onClick={() => {
            setSearchParams(
              (prev) => {
                if (link.next) {
                  prev.set('page', link.next)
                }
                return prev
              },
              {
                preventScrollReset: true,
              },
            )
          }}
        >
          <ChevronRightIcon className="h-4 w-4" />
          <span className="sr-only">Next</span>
        </Button>

        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={!link.last}
          onClick={() => {
            setSearchParams(
              (prev) => {
                if (link.last) {
                  prev.set('page', link.last)
                }
                return prev
              },
              {
                preventScrollReset: true,
              },
            )
          }}
        >
          <ChevronsRightIcon className="h-4 w-4" />
          <span className="sr-only">Last</span>
        </Button>
      </HStack>
    </HStack>
  )
}
