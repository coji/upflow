import { PencilIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { data, useFetcher } from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
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
          placeholder="チーム名を入力"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs"
          required
        />
        <Button type="submit" size="sm" disabled={!name.trim()}>
          <PlusIcon size={16} />
          追加
        </Button>
      </HStack>
    </fetcher.Form>
  )
}

function TeamRow({
  team,
}: {
  team: { id: string; name: string; displayOrder: number }
}) {
  const fetcher = useFetcher()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(team.name)
  const [displayOrder, setDisplayOrder] = useState(String(team.displayOrder))

  return (
    <TableRow>
      {editing ? (
        <>
          <TableCell>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-xs"
              required
            />
          </TableCell>
          <TableCell>
            <Input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              className="w-20"
            />
          </TableCell>
          <TableCell>
            <HStack>
              <fetcher.Form method="post" onSubmit={() => setEditing(false)}>
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="id" value={team.id} />
                <input type="hidden" name="name" value={name} />
                <input type="hidden" name="displayOrder" value={displayOrder} />
                <Button type="submit" size="sm" variant="outline">
                  保存
                </Button>
              </fetcher.Form>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setName(team.name)
                  setDisplayOrder(String(team.displayOrder))
                  setEditing(false)
                }}
              >
                キャンセル
              </Button>
            </HStack>
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="font-medium">{team.name}</TableCell>
          <TableCell>{team.displayOrder}</TableCell>
          <TableCell>
            <HStack>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
              >
                <PencilIcon size={14} />
              </Button>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={team.id} />
                <Button type="submit" size="sm" variant="ghost">
                  <TrashIcon size={14} />
                </Button>
              </fetcher.Form>
            </HStack>
          </TableCell>
        </>
      )}
    </TableRow>
  )
}

export default function TeamsPage({
  loaderData: { teams },
}: Route.ComponentProps) {
  return (
    <ContentSection
      title="Teams"
      desc="リポジトリをチーム（事業部）ごとにグループ化して管理します。"
    >
      <Stack gap="4">
        <AddTeamForm />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>チーム名</TableHead>
                <TableHead className="w-24">表示順</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length > 0 ? (
                teams.map((team) => <TeamRow key={team.id} team={team} />)
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    チームがまだ登録されていません。
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
