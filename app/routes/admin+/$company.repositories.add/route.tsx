import { parseWithZod } from '@conform-to/zod'
import { ChevronRightIcon, ChevronsLeftIcon, RefreshCwIcon } from 'lucide-react'
import {
  Form,
  isRouteErrorResponse,
  redirect,
  useRouteError,
  useSearchParams,
} from 'react-router'
import { dataWithError, dataWithSuccess } from 'remix-toast'
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
import { clearAllCache, getCachedData } from '~/app/services/cache.server'
import type { Route } from './+types/route'
import { RepositoryItem, RepositoryList } from './components'
import {
  addRepository,
  getIntegration,
  getRepositoriesByOwnerAndKeyword,
  getUniqueOwners,
} from './functions.server'

export const handle = { breadcrumb: () => ({ label: 'Add Repositories' }) }

const AddRepoSchema = z.object({
  owner: z.string(),
  name: z.string(),
})

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { owner, cursor, query, refresh } = zx.parseQuery(request, {
    owner: z.string().optional(),
    cursor: z.string().optional(),
    query: z.string().optional().default(''),
    refresh: z.string().optional(),
  })

  if (refresh) {
    const searchParams = new URL(request.url).searchParams
    searchParams.delete('refresh')
    clearAllCache()
    throw redirect(
      `/admin/${params.company}/repositories/add?${searchParams.toString()}`,
    )
  }

  const integration = await getIntegration(params.company)
  if (!integration) {
    throw new Error('integration not created')
  }
  if (!integration.privateToken) {
    throw new Error('integration not configured')
  }
  const token = integration.privateToken
  const owners = await getCachedData(
    'owners',
    () => getUniqueOwners(token),
    300000, // 5 minutes
  )
  if (owner && !owners.includes(owner)) {
    // invalid
    throw new Error('invalid owner')
  }

  const { pageInfo, repos } = await getCachedData(
    `repos-${owner}-${cursor}-${query}`,
    () =>
      getRepositoriesByOwnerAndKeyword({
        token,
        cursor,
        owner,
        keyword: query,
      }),
    300000, // 5 minutes
  )

  return { integration, pageInfo, query, owner, owners, repos }
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  const integraiton = await getIntegration(params.company)
  if (!integraiton) {
    throw new Error('integration not created')
  }

  const submission = parseWithZod(await request.formData(), {
    schema: AddRepoSchema,
  })
  if (submission.status !== 'success') {
    return dataWithError({}, { message: 'Invalid form submission' })
  }

  try {
    await addRepository(params.company, {
      owner: submission.value.owner,
      repo: submission.value.name,
    })
  } catch (e) {
    return dataWithError(
      {},
      { message: `Failed to add repository: ${String(e)}` },
    )
  }

  return dataWithSuccess(
    {},
    {
      message: `Repository added: ${submission.value.owner}/${submission.value.name}`,
    },
  )
}

export default function AddRepositoryPage({
  loaderData: { integration, pageInfo, query, owner, owners, repos },
}: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  return (
    <Card>
      <CardHeader>
        <HStack>
          <div className="flex-1">
            <CardTitle>Add Repositories</CardTitle>
            <CardDescription>Add repositories to the company</CardDescription>
          </div>
          <Form method="get">
            {/* 既存のURLパラメタをすべてつける */}
            {[...searchParams.entries()].map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <input type="hidden" name="refresh" value="true" />
            <Button type="submit" variant="outline" size="icon">
              <RefreshCwIcon className="text-muted-foreground scale-70" />
            </Button>
          </Form>
        </HStack>
      </CardHeader>
      <CardContent>
        <Stack>
          <Label>Organization</Label>
          <Select
            defaultValue={owner}
            onValueChange={(value) => {
              setSearchParams(
                (prev) => {
                  prev.set('owner', value)
                  prev.delete('cursor')
                  prev.delete('query')
                  prev.delete('refresh')
                  return prev
                },
                {
                  preventScrollReset: true,
                },
              )
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select organization..." />
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
            method="get"
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              const query = formData.get('query') as string
              setSearchParams(
                (prev) => {
                  prev.set('query', query)
                  prev.delete('refresh')
                  return prev
                },
                {
                  preventScrollReset: true,
                },
              )
            }}
          >
            <HStack>
              <Input
                name="query"
                type="search"
                placeholder="Search repositories..."
                defaultValue={query}
              />
              <Button type="submit" variant="outline">
                Search
              </Button>
            </HStack>
          </Form>

          <RepositoryList>
            {repos.length === 0 ? (
              <div className="text-muted-foreground p-4 text-center text-sm">
                No repositories found
              </div>
            ) : (
              repos.map((repo, index) => (
                <RepositoryItem
                  key={repo.id}
                  repo={repo}
                  isAdded={integration.repositories.some(
                    (r) => r.owner === repo.owner && r.repo === repo.name,
                  )}
                  isLast={index === repos.length - 1}
                />
              ))
            )}
          </RepositoryList>

          <HStack>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={searchParams.get('cursor') === null}
              onClick={() => {
                setSearchParams(
                  (prev) => {
                    prev.delete('cursor')
                    prev.delete('refresh')
                    return prev
                  },
                  {
                    preventScrollReset: true,
                  },
                )
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
                setSearchParams(
                  (prev) => {
                    if (pageInfo.endCursor) {
                      prev.set('cursor', pageInfo.endCursor)
                    } else {
                      prev.delete('cursor')
                    }
                    prev.delete('refresh')
                    return prev
                  },
                  {
                    preventScrollReset: true,
                  },
                )
              }}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </HStack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export const ErrorBoundary = () => {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </main>
    )
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Error!</h1>
      <p>
        {error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Unknown error'}
      </p>
    </main>
  )
}
