import { LockIcon } from 'lucide-react'
import { useFetcher } from 'react-router'
import { Button, HStack } from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import { cn } from '~/app/libs/utils'
import type { Repository } from '../functions/get-repositories-by-owner-and-keyword'

export const RepositoryItem = ({
  repo,
  isAdded,
  isLast,
}: {
  repo: Repository
  isAdded: boolean
  isLast: boolean
}) => {
  const fetcher = useFetcher({
    key: `repo-${repo.owner}/${repo.name}`,
  })

  return (
    <HStack key={repo.id} className={cn('px-4 py-1', !isLast && 'border-b')}>
      <div className="text-sm">
        {repo.owner}/{repo.name}
      </div>
      {repo.visibility === 'PRIVATE' && (
        <div>
          <LockIcon className="text-muted-foreground h-3 w-3" />
        </div>
      )}
      <div className="text-muted-foreground">·</div>
      <div className="text-muted-foreground text-xs">
        {dayjs(repo.pushedAt).fromNow()}
      </div>

      <div className="flex-1" />

      <fetcher.Form method="POST">
        <input type="hidden" name="owner" value={repo.owner} />
        <input type="hidden" name="name" value={repo.name} />
        <Button
          type="submit"
          size="xs"
          variant="outline"
          disabled={isAdded || fetcher.state !== 'idle'}
        >
          {isAdded ? 'Added' : 'Add'}
        </Button>
      </fetcher.Form>
    </HStack>
  )
}
