import { parseWithZod } from '@conform-to/zod'
import { LockIcon } from 'lucide-react'
import React from 'react'
import { Await, Form, redirect, useSearchParams } from 'react-router'
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
  Stack,
} from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import { cn } from '~/app/libs/utils'
import type { Route } from './+types/route'
import { addRepository, getIntegration } from './functions.server'
import { listGithubRepos } from './functions/listGithubRepos'

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
  const { page, perPage, query } = zx.parseQuery(request, {
    page: z.string().optional().default('1').transform(Number),
    perPage: z.string().optional().default('10').transform(Number),
    query: z.string().optional(),
  })

  const integration = await getIntegration(params.company)
  if (!integration) {
    throw new Error('integration not created')
  }
  if (!integration.privateToken) {
    throw new Error('integration not configured')
  }

  const repos = listGithubRepos({
    token: integration.privateToken,
    page,
    perPage,
  })

  return { page, perPage, query, integration, repos }
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
  loaderData: { integration, repos, page, perPage },
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
          <Form>
            <Input name="query" placeholder="Search repositories..." />
          </Form>

          <React.Suspense fallback={<div>Loading...</div>}>
            <Await
              resolve={repos}
              errorElement={<div>Could not load repositories</div>}
            >
              {(repos) => {
                return (
                  <>
                    <div className="rounded border">
                      <div>
                        {repos.data.map((repo, index) => {
                          const isFirst = index === 0
                          const isLast = index === repos.data.length - 1

                          return (
                            <HStack
                              key={repo.id}
                              className={cn(
                                'px-4 py-1',
                                isFirst && 'border-b',
                                !isFirst && !isLast && 'border-b',
                              )}
                            >
                              <div className="text-sm">{repo.full_name}</div>
                              {repo.visibility === 'private' && (
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

                    {/* pagination */}
                    <HStack className="justify-between">
                      <Button
                        type="button"
                        size="sm"
                        variant="link"
                        disabled={!repos.link.prev}
                        onClick={() => {
                          if (repos.link.prev) {
                            setSearchParams(
                              (prev) => {
                                return {
                                  ...prev,
                                  page: repos.link.prev,
                                }
                              },
                              {
                                preventScrollReset: true,
                              },
                            )
                          }
                        }}
                      >
                        Previous
                      </Button>

                      <div className="text-xs">
                        Page {page} / {repos.link.last}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="link"
                        disabled={!repos.link.next}
                        onClick={() => {
                          if (repos.link.next) {
                            setSearchParams(
                              (prev) => {
                                return {
                                  ...prev,
                                  page: repos.link.next,
                                }
                              },
                              {
                                preventScrollReset: true,
                              },
                            )
                          }
                        }}
                      >
                        Next
                      </Button>
                    </HStack>
                  </>
                )
              }}
            </Await>
          </React.Suspense>
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
