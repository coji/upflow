import { PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { data, useFetcher } from 'react-router'
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
import { requireOrgAdmin } from '~/app/libs/auth.server'
import ContentSection from '../+components/content-section'
import type { Route } from './+types/index'
import { addTeam, deleteTeam, updateTeam } from './mutations.server'
import { listTeams } from './queries.server'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Teams',
    to: `/${params.orgSlug}/settings/teams`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const teams = await listTeams(organization.id)
  return { teams }
}

const addSchema = z.object({
  name: z.string().min(1),
  displayOrder: z.coerce.number().int().default(0),
})

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  displayOrder: z.coerce.number().int().default(0),
  personalLimit: z.coerce.number().int().min(1).default(2),
})

const deleteSchema = z.object({
  id: z.string().min(1),
})

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  return match(intent)
    .with('add', async () => {
      const parsed = addSchema.parse({
        name: formData.get('name'),
        displayOrder: formData.get('displayOrder'),
      })
      await addTeam({ ...parsed, organizationId: organization.id })
      return data({ ok: true })
    })
    .with('update', async () => {
      const parsed = updateSchema.parse({
        id: formData.get('id'),
        name: formData.get('name'),
        displayOrder: formData.get('displayOrder'),
        personalLimit: formData.get('personalLimit'),
      })
      await updateTeam({ ...parsed, organizationId: organization.id })
      return data({ ok: true })
    })
    .with('delete', async () => {
      const { id } = deleteSchema.parse({ id: formData.get('id') })
      await deleteTeam(organization.id, id)
      return data({ ok: true })
    })
    .otherwise(() => data({ error: 'Invalid intent' }, { status: 400 }))
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
  const [deleteOpen, setDeleteOpen] = useState(false)

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
          onSave={(newValue) => submitUpdate({ name: newValue })}
        />
      </TableCell>
      <TableCell>
        <EditableCell
          value={String(team.displayOrder)}
          pending={updateFetcher.state !== 'idle'}
          onSave={(newValue) => submitUpdate({ displayOrder: newValue })}
          type="number"
          className="w-20"
        />
      </TableCell>
      <TableCell>
        <EditableCell
          value={String(team.personalLimit)}
          pending={updateFetcher.state !== 'idle'}
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
          onClick={() => setDeleteOpen(true)}
        >
          <TrashIcon size={14} />
        </Button>
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
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
