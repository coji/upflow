import { parseWithZod } from '@conform-to/zod'
import { ChevronRightIcon, ChevronsLeftIcon, LockIcon } from 'lucide-react'
import { Form, redirect, useSearchParams } from 'react-router'
import { $path } from 'safe-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  HStack,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
} from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import { cn } from '~/app/libs/utils'
import type { Route } from './+types/route'
import { addRepository, getIntegration } from './functions.server'
import { getRepositoriesByOwnerAndKeyword } from './functions/get-repositories-by-owner-and-keyword'
import { getUniqueOwners } from './functions/get-unique-owners'
export const handle = { breadcrumb: () => ({ label: 'Add Repositories' }) }

const RepoSchema = z.object({
  repos: z.array(
    z.object({
      owner: z.string(),
      repo: z.string(),
    }),
  ),
})

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  let { owner, cursor, query } = zx.parseQuery(request, {
    owner: z.string().optional(),
    cursor: z.string().optional(),
    query: z.string().optional(),
  })

  const integration = await getIntegration(params.company)
  if (!integration) {
    throw new Error('integration not created')
  }
  if (!integration.privateToken) {
    throw new Error('integration not configured')
  }

  const owners = await getUniqueOwners(integration.privateToken)
  if (owner && !owners.includes(owner)) {
    // invalid
    throw new Error('invalid owner')
  }
  // set default owner
  if (!owner && owners.length > 0) {
    owner = owners[0]
  }

  const { pageInfo, repos } = await getRepositoriesByOwnerAndKeyword({
    token: integration.privateToken,
    cursor,
    owner,
    keyword: query ?? '',
  })

  return { pageInfo, query, owner, owners, repos }
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  const integraiton = await getIntegration(params.company)
  if (!integraiton) {
    throw new Error('integration not created')
  }

  const submission = parseWithZod(await request.formData(), {
    schema: RepoSchema,
  })
  if (submission.status !== 'success') {
    return submission.reply()
  }

  try {
    const repos = submission.value.repos
    for (const repo of repos) {
      await addRepository(params.company, {
        owner: repo.owner,
        repo: repo.repo,
      })
    }
  } catch (e) {
    return submission.reply({
      formErrors: ['Failed to add repository'],
    })
  }
  return redirect(
    $path('/admin/:company/repositories', { company: params.company }),
  )
}

export default function AddRepositoryPage({
  loaderData: { pageInfo, query, owner, owners, repos },
}: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Repositories</CardTitle>
        <CardDescription>Add repositories to the company</CardDescription>
      </CardHeader>
      <CardContent>
        <Stack>
          <Label>Organization</Label>
          <Select
            defaultValue={owner}
            onValueChange={(value) => {
              setSearchParams((prev) => {
                prev.set('owner', value)
                prev.delete('cursor')
                prev.delete('query')
                return prev
              })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {owners.map((owner) => (
                <SelectItem key={owner} value={owner}>
                  {owner}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Form
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              const query = formData.get('query') as string
              setSearchParams((prev) => {
                prev.set('query', query)
                return prev
              })
            }}
          >
            <Input
              name="query"
              placeholder="Search repositories..."
              defaultValue={query}
            />
          </Form>

          <div className="rounded border">
            <div>
              {repos.map((repo, index) => {
                const isLast = index === repos.length - 1

                return (
                  <HStack
                    key={repo.id}
                    className={cn('px-4 py-1', !isLast && 'border-b')}
                  >
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
                    <div>
                      <Button type="button" size="xs" variant="link">
                        Add
                      </Button>
                    </div>
                  </HStack>
                )
              })}
            </div>
          </div>

          <HStack>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={searchParams.get('cursor') === null}
              onClick={() => {
                setSearchParams((prev) => {
                  prev.delete('cursor')
                  return prev
                })
              }}
            >
              <ChevronsLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!pageInfo.hasNextPage}
              onClick={() => {
                setSearchParams((prev) => {
                  if (pageInfo.endCursor) {
                    prev.set('cursor', pageInfo.endCursor)
                  } else {
                    prev.delete('cursor')
                  }
                  return prev
                })
              }}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </HStack>
        </Stack>
      </CardContent>
    </Card>
  )

  // const handleAddRepository = (repos:  GithubRepo[]) => {
  //   const keyValues: Record<string, string> = {}
  //   for (const [idx, repo] of repos.entries()) {
  //     keyValues[`repos[${idx}].owner`] = repo.owner
  //     keyValues[`repos[${idx}].repo`] = repo.name
  //   }
  //   fetcher.submit(keyValues, { method: 'POST' })
  //   return true
  // }
  // const { RepositoryAddModal } = useRepositoryAddModal({
  //   integration,
  //   onSubmit: handleAddRepository,
  // })

  // if (!integration) {
  //   return <p>integration not found</p>
  // }

  // return <>{integration.provider === 'github' && RepositoryAddModal}</>
}
