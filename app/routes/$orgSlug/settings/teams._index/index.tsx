import { parseWithZod } from '@conform-to/zod/v4'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { data, href, useFetcher } from 'react-router'
import { dataWithError, dataWithSuccess } from 'remix-toast'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { ConfirmDialog } from '~/app/components/confirm-dialog'
import { EditableCell } from '~/app/components/editable-cell'
import { Button, HStack, Input, Stack } from '~/app/components/ui'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui/table'
import { getErrorMessage } from '~/app/libs/error-message'
import { hasFetcherError } from '~/app/libs/fetcher-error'
import { orgContext } from '~/app/middleware/context'
import ContentSection from '../+components/content-section'
import type { Route } from './+types/index'
import { addTeam, deleteTeam, updateTeam } from './mutations.server'
import { listTeams } from './queries.server'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Teams',
    to: href('/:orgSlug/settings/teams', { orgSlug: params.orgSlug }),
  }),
}

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const teams = await listTeams(organization.id)
  return { teams }
}

const addTeamSchema = z.object({
  intent: z.literal('add'),
  name: z.string().min(1),
  displayOrder: z.coerce.number().int().default(0),
})

const updateTeamSchema = z.object({
  intent: z.literal('update'),
  id: z.string().min(1),
  name: z.string().min(1),
  displayOrder: z.coerce.number().int().default(0),
  personalLimit: z.coerce.number().int().min(1).default(2),
})

const confirmDeleteTeamSchema = z.object({
  intent: z.literal('confirm-delete'),
  id: z.string().min(1),
})

const deleteTeamSchema = z.object({
  intent: z.literal('delete'),
  id: z.string().min(1),
})

const actionSchema = z.discriminatedUnion('intent', [
  addTeamSchema,
  updateTeamSchema,
  confirmDeleteTeamSchema,
  deleteTeamSchema,
])

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization } = context.get(orgContext)
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: actionSchema })
  if (submission.status !== 'success') {
    return data({ ok: false, lastResult: submission.reply() }, { status: 400 })
  }

  return match(submission.value)
    .with({ intent: 'add' }, async ({ name, displayOrder }) => {
      try {
        await addTeam({ name, displayOrder, organizationId: organization.id })
      } catch (e) {
        const message = getErrorMessage(e)
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
        { message: 'チームを追加しました' },
      )
    })
    .with(
      { intent: 'update' },
      async ({ id, name, displayOrder, personalLimit }) => {
        try {
          await updateTeam({
            id,
            name,
            displayOrder,
            personalLimit,
            organizationId: organization.id,
          })
        } catch (e) {
          const message = getErrorMessage(e)
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
          { message: 'チームを更新しました' },
        )
      },
    )
    .with({ intent: 'confirm-delete' }, () => {
      return data({ ok: false, lastResult: null, shouldConfirm: true })
    })
    .with({ intent: 'delete' }, async ({ id }) => {
      try {
        await deleteTeam(organization.id, id)
      } catch (e) {
        return data(
          {
            ok: false,
            lastResult: submission.reply({ formErrors: [getErrorMessage(e)] }),
            shouldConfirm: true,
          },
          { status: 400 },
        )
      }
      return dataWithSuccess(
        { ok: true, lastResult: null },
        { message: 'チームを削除しました' },
      )
    })
    .exhaustive()
}

function AddTeamForm() {
  const fetcher = useFetcher()
  const [name, setName] = useState('')

  return (
    <fetcher.Form method="post" onSubmit={() => setName('')}>
      <input type="hidden" name="intent" value="add" />
      <input type="hidden" name="displayOrder" value="0" />
      <HStack>
        <Input
          name="name"
          placeholder="Enter team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs"
          required
        />
        <Button
          type="submit"
          size="sm"
          loading={fetcher.state !== 'idle'}
          disabled={!name.trim()}
        >
          <PlusIcon size={16} />
          Add
        </Button>
      </HStack>
    </fetcher.Form>
  )
}

function TeamRow({
  team,
}: {
  team: {
    id: string
    name: string
    displayOrder: number
    personalLimit: number
  }
}) {
  const updateFetcher = useFetcher()
  const deleteFetcher = useFetcher()
  const updateError = hasFetcherError(updateFetcher)

  const submitUpdate = (
    fields: Partial<{
      name: string
      displayOrder: string
      personalLimit: string
    }>,
  ) => {
    const formData = new FormData()
    formData.set('intent', 'update')
    formData.set('id', team.id)
    formData.set('name', fields.name ?? team.name)
    formData.set(
      'displayOrder',
      fields.displayOrder ?? String(team.displayOrder),
    )
    formData.set(
      'personalLimit',
      fields.personalLimit ?? String(team.personalLimit),
    )
    updateFetcher.submit(formData, { method: 'post' })
  }

  return (
    <TableRow>
      <TableCell>
        <EditableCell
          value={team.name}
          pending={updateFetcher.state !== 'idle'}
          error={updateError}
          onSave={(newValue) => submitUpdate({ name: newValue })}
        />
      </TableCell>
      <TableCell>
        <EditableCell
          value={String(team.displayOrder)}
          pending={updateFetcher.state !== 'idle'}
          error={updateError}
          onSave={(newValue) => submitUpdate({ displayOrder: newValue })}
          type="number"
          className="w-20"
        />
      </TableCell>
      <TableCell>
        <EditableCell
          value={String(team.personalLimit)}
          pending={updateFetcher.state !== 'idle'}
          error={updateError}
          onSave={(newValue) => submitUpdate({ personalLimit: newValue })}
          type="number"
          className="w-20"
        />
      </TableCell>
      <TableCell>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            deleteFetcher.submit(
              { intent: 'confirm-delete', id: team.id },
              { method: 'post' },
            )
          }}
        >
          <TrashIcon size={14} />
        </Button>
        <ConfirmDialog
          title="Delete Team"
          desc={`Are you sure you want to delete "${team.name}"?`}
          confirmText="Delete"
          destructive
          fetcher={deleteFetcher}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={team.id} />
        </ConfirmDialog>
      </TableCell>
    </TableRow>
  )
}

export default function TeamsPage({
  loaderData: { teams },
}: Route.ComponentProps) {
  return (
    <ContentSection title="Teams" desc="Group and manage repositories by team.">
      <Stack gap="4">
        <AddTeamForm />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Name</TableHead>
                <TableHead className="w-24">Order</TableHead>
                <TableHead className="w-24">Limit</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length > 0 ? (
                teams.map((team) => <TeamRow key={team.id} team={team} />)
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No teams registered yet.
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
