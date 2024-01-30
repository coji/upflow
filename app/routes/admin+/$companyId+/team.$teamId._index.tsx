import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from '@remix-run/node'
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  HStack,
  Input,
  Label,
  Spacer,
  Stack,
} from '~/app/components/ui'
import { deleteTeam, getTeam, updateTeam } from '~/app/models/admin/team.server'

export const handle = {
  breadcrumb: ({ companyId, team }: { companyId: string; team: NonNullable<Awaited<ReturnType<typeof getTeam>>> }) => ({
    label: team.name,
    to: `/admin/${companyId}/team/${team.id}`,
  }),
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId, teamId } = zx.parseParams(params, { companyId: z.string(), teamId: z.string() })
  const team = await getTeam(teamId)
  if (!team) {
    throw new Error('チームが見つかりません')
  }
  return json({ companyId, team })
}

const schema = z.object({
  name: z.string({ required_error: '必須です' }).max(20, { message: '20文字以内です' }),
  intent: z.enum(['update', 'delete']),
})

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { teamId } = zx.parseParams(params, { teamId: z.string() })
  const submission = parse(await request.formData(), { schema })
  if (!submission.value) {
    return { submission }
  }

  const { intent, ...value } = submission.value
  if (intent === 'delete') {
    await deleteTeam(teamId)
  } else if (intent === 'update') {
    await updateTeam(teamId, value)
  }
  return redirect(`/admin/${params.companyId}/team`)
}

export default function TeamDetailPage() {
  const { team } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const [form, { name }] = useForm({
    id: 'team-detail',
    defaultValue: team,
    lastSubmission: actionData?.submission,
    onValidate: ({ formData }) => parse(formData, { schema }),
  })

  return (
    <div>
      <Form method="POST" {...form.props}>
        <Stack>
          <fieldset>
            <Label>TeamID</Label>
            <Input disabled defaultValue={team.id} />
          </fieldset>

          <fieldset>
            <Label htmlFor={name.id}>Name</Label>
            <Input {...conform.input(name)} />
            {name.error && <div className="text-destructive text-sm">{name.error}</div>}
          </fieldset>

          <HStack>
            <Button type="submit" name="intent" value="update">
              Update
            </Button>

            <Button variant="ghost" asChild>
              <Link to="..">Cancel</Link>
            </Button>

            <Spacer />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete...</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. It will permanently delete your team and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction form={form.id} name="intent" value="delete" type="submit">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </HStack>
        </Stack>
      </Form>
    </div>
  )
}
