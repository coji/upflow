import { parseWithZod } from '@conform-to/zod/v4'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { data, href, useFetcher } from 'react-router'
import { dataWithError, dataWithSuccess } from 'remix-toast'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { ConfirmDialog } from '~/app/components/confirm-dialog'
import { Button, HStack, Input, Stack, Switch } from '~/app/components/ui'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui/table'
import { getErrorMessage } from '~/app/libs/error-message'
import {
  prTitleFilterPatternSchema,
  translatePrTitleFilterError,
} from '~/app/libs/pr-title-filter'
import { orgContext } from '~/app/middleware/context'
import {
  createPrTitleFilter,
  deletePrTitleFilter,
  updatePrTitleFilter,
} from '~/app/services/pr-title-filter-mutations.server'
import ContentSection from '../+components/content-section'
import type { Route } from './+types/index'
import { listPrTitleFiltersWithUsers } from './queries.server'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'PR Filters',
    to: href('/:orgSlug/settings/pr-filters', { orgSlug: params.orgSlug }),
  }),
}

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const filters = await listPrTitleFiltersWithUsers(organization.id)
  return { filters }
}

const createSchema = z.object({
  intent: z.literal('create'),
  pattern: prTitleFilterPatternSchema,
})

const toggleSchema = z.object({
  intent: z.literal('toggle'),
  id: z.string().min(1),
  isEnabled: z.enum(['0', '1']),
})

const confirmDeleteSchema = z.object({
  intent: z.literal('confirm-delete'),
  id: z.string().min(1),
})

const deleteSchema = z.object({
  intent: z.literal('delete'),
  id: z.string().min(1),
})

const actionSchema = z.discriminatedUnion('intent', [
  createSchema,
  toggleSchema,
  confirmDeleteSchema,
  deleteSchema,
])

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization, user } = context.get(orgContext)
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: actionSchema })
  if (submission.status !== 'success') {
    return data({ ok: false, lastResult: submission.reply() }, { status: 400 })
  }

  return match(submission.value)
    .with({ intent: 'create' }, async ({ pattern }) => {
      try {
        await createPrTitleFilter(organization.id, {
          pattern,
          userId: user.id,
        })
      } catch (e) {
        console.error('Failed to create pr-title-filter:', e)
        const message = translatePrTitleFilterError(getErrorMessage(e))
        return dataWithError(
          {
            ok: false,
            lastResult: submission.reply({ formErrors: [message] }),
          },
          { message },
        )
      }
      return dataWithSuccess(
        { ok: true, lastResult: null },
        { message: 'Filter added' },
      )
    })
    .with({ intent: 'toggle' }, async ({ id, isEnabled }) => {
      try {
        await updatePrTitleFilter(organization.id, id, {
          isEnabled: isEnabled === '1',
          userId: user.id,
        })
      } catch (e) {
        console.error('Failed to toggle pr-title-filter:', e)
        const message = translatePrTitleFilterError(getErrorMessage(e))
        return dataWithError(
          {
            ok: false,
            lastResult: submission.reply({ formErrors: [message] }),
          },
          { message },
        )
      }
      return dataWithSuccess(
        { ok: true, lastResult: null },
        { message: 'Filter updated' },
      )
    })
    .with({ intent: 'confirm-delete' }, () => {
      return data({ ok: false, lastResult: null, shouldConfirm: true })
    })
    .with({ intent: 'delete' }, async ({ id }) => {
      try {
        await deletePrTitleFilter(organization.id, id)
      } catch (e) {
        console.error('Failed to delete pr-title-filter:', e)
        const message = translatePrTitleFilterError(getErrorMessage(e))
        return data(
          {
            ok: false,
            lastResult: submission.reply({ formErrors: [message] }),
            shouldConfirm: true,
          },
          { status: 400 },
        )
      }
      return dataWithSuccess(
        { ok: true, lastResult: null },
        { message: 'Filter deleted' },
      )
    })
    .exhaustive()
}

function AddFilterForm() {
  const fetcher = useFetcher()
  const [pattern, setPattern] = useState('')

  return (
    <fetcher.Form method="post" onSubmit={() => setPattern('')}>
      <input type="hidden" name="intent" value="create" />
      <HStack>
        <Input
          name="pattern"
          placeholder="e.g. [DO NOT MERGE]"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          className="max-w-sm"
          required
          minLength={2}
          maxLength={200}
        />
        <Button
          type="submit"
          size="sm"
          loading={fetcher.state !== 'idle'}
          disabled={pattern.trim().length < 2}
        >
          <PlusIcon size={16} />
          Add
        </Button>
      </HStack>
    </fetcher.Form>
  )
}

function FilterRow({
  filter,
}: {
  filter: {
    id: string
    pattern: string
    isEnabled: boolean
    createdByName: string | null
    updatedByName: string | null
    updatedAt: string
  }
}) {
  const toggleFetcher = useFetcher()
  const deleteFetcher = useFetcher()

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{filter.pattern}</TableCell>
      <TableCell>
        <Switch
          checked={filter.isEnabled}
          disabled={toggleFetcher.state !== 'idle'}
          onCheckedChange={(checked) => {
            const formData = new FormData()
            formData.set('intent', 'toggle')
            formData.set('id', filter.id)
            formData.set('isEnabled', checked ? '1' : '0')
            toggleFetcher.submit(formData, { method: 'post' })
          }}
        />
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {filter.updatedByName ?? '(deleted user)'}
      </TableCell>
      <TableCell>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            deleteFetcher.submit(
              { intent: 'confirm-delete', id: filter.id },
              { method: 'post' },
            )
          }}
        >
          <TrashIcon size={14} />
        </Button>
        <ConfirmDialog
          title="Delete filter"
          desc={`Are you sure you want to delete the filter "${filter.pattern}"?`}
          confirmText="Delete"
          destructive
          fetcher={deleteFetcher}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={filter.id} />
        </ConfirmDialog>
      </TableCell>
    </TableRow>
  )
}

export default function PrFiltersPage({
  loaderData: { filters },
}: Route.ComponentProps) {
  return (
    <ContentSection
      title="PR Title Filters"
      desc="Hide PRs whose titles contain any of the patterns below. Case-insensitive substring match. Applies to all dashboard views (Review Stacks, throughput, analysis)."
    >
      <Stack gap="4">
        <AddFilterForm />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pattern</TableHead>
                <TableHead className="w-24">Enabled</TableHead>
                <TableHead className="w-40">Last edited by</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filters.length > 0 ? (
                filters.map((filter) => (
                  <FilterRow key={filter.id} filter={filter} />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No filters yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Stack>
    </ContentSection>
  )
}
