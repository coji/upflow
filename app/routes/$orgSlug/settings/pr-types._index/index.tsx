import { href } from 'react-router'
import { Badge, Stack } from '~/app/components/ui'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui/table'
import { PR_TYPES, PR_TYPE_LABELS, type PrType } from '~/app/libs/pr-type'
import { orgContext } from '~/app/middleware/context'
import ContentSection from '../+components/content-section'
import type { Route } from './+types/index'
import {
  countPullRequestsByType,
  listSignalConflictPullRequests,
} from './queries.server'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'PR Types',
    to: href('/:orgSlug/settings/pr-types', { orgSlug: params.orgSlug }),
  }),
}

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const [counts, conflicts] = await Promise.all([
    countPullRequestsByType(organization.id),
    listSignalConflictPullRequests(organization.id),
  ])
  return { counts, conflicts }
}

export default function PrTypesSettingsPage({
  loaderData: { counts, conflicts },
}: Route.ComponentProps) {
  const countOf = (type: PrType | null) =>
    counts.find((c) => c.prType === type)?.count ?? 0
  const unclassified = countOf(null)

  return (
    <ContentSection
      title="PR Types"
      desc="Pull requests are classified by title, branch and author. Dashboards count only normal PRs unless other types are included from the PR types menu."
      fullWidth
    >
      <Stack gap="6">
        <div className="flex flex-wrap gap-2">
          {PR_TYPES.map((type) => (
            <Badge key={type} variant="outline">
              {PR_TYPE_LABELS[type]}: {countOf(type).toLocaleString()}
            </Badge>
          ))}
          {unclassified > 0 && (
            <Badge variant="secondary">
              Not classified yet: {unclassified.toLocaleString()}
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <h4 className="font-medium">Naming conflicts</h4>
          <p className="text-muted-foreground text-sm">
            The title and the branch point to different types (for example, a
            release title on a feature branch). The PR is still classified, but
            its naming does not follow the usual conventions.
          </p>
        </div>

        {conflicts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No conflicts.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pull request</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Classified as</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conflicts.map((pr) => (
                  <TableRow key={`${pr.repositoryId}:${pr.number}`}>
                    <TableCell className="max-w-md">
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        <span className="text-muted-foreground">
                          {pr.owner}/{pr.repo}#{pr.number}
                        </span>{' '}
                        {pr.title}
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {pr.sourceBranch} → {pr.targetBranch}
                    </TableCell>
                    <TableCell>
                      {pr.prType
                        ? PR_TYPE_LABELS[pr.prType as PrType]
                        : 'Not classified'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Stack>
    </ContentSection>
  )
}
