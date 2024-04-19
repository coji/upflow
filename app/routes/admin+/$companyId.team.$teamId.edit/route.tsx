import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react'
import { $path } from 'remix-routes'
import { redirectWithSuccess } from 'remix-toast'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertTitle,
  Button,
  HStack,
  Input,
  Label,
  Spacer,
  Stack,
} from '~/app/components/ui'
import { deleteTeam, getTeam, updateTeam } from './functions.server'

export const handle = {
  breadcrumb: ({
    companyId,
    team,
  }: {
    companyId: string
    team: NonNullable<Awaited<ReturnType<typeof getTeam>>>
  }) => ({
    label: team.name,
    to: $path('/admin/:companyId/teams/:teamId', {
      companyId,
      teamId: team.id,
    }),
  }),
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId, teamId } = zx.parseParams(params, {
    companyId: z.string(),
    teamId: z.string(),
  })
  const team = await getTeam(companyId, teamId)
  if (!team) {
    throw new Error('チームが見つかりません')
  }
  return json({ companyId, team })
}

const schema = z.object({
  name: z
    .string({ required_error: '必須です' })
    .max(20, { message: '20文字以内です' }),
  intent: z.enum(['update', 'delete']),
})

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId, teamId } = zx.parseParams(params, {
    companyId: z.string(),
    teamId: z.string(),
  })
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return json(submission.reply())
  }

  const { intent, ...value } = submission.value
  let toastMessage = ''
  try {
    if (intent === 'delete') {
      await deleteTeam(teamId)
      toastMessage = `Team ${teamId} deleted`
    }

    if (intent === 'update') {
      await updateTeam(teamId, value)
      toastMessage = `Team ${teamId} updated`
    }
  } catch (e) {
    return json(
      submission.reply({
        formErrors: [`Failed to ${intent} team: ${String(e)}`],
      }),
    )
  }

  return redirectWithSuccess(
    $path('/admin/:companyId/teams', { companyId }),
    toastMessage,
  )
}

export default function TeamDetailPage() {
  const { team } = useLoaderData<typeof loader>()
  const lastResult = useActionData<typeof action>()
  const [form, { name }] = useForm({
    defaultValue: team,
    lastResult,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
  })

  return (
    <div>
      <Form method="POST" {...getFormProps(form)}>
        <Stack>
          <fieldset>
            <Label>TeamID</Label>
            <Input disabled defaultValue={team.id} />
          </fieldset>

          <fieldset>
            <Label htmlFor={name.id}>Name</Label>
            <Input {...getInputProps(name, { type: 'text' })} />
            <div className="text-sm text-destructive">{name.errors}</div>
          </fieldset>

          {form.errors && (
            <Alert variant="destructive">
              <AlertTitle>システムエラー</AlertTitle>
              <AlertDescription>{form.errors}</AlertDescription>
            </Alert>
          )}

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
                    This action cannot be undone. It will permanently delete
                    your team and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    form={form.id}
                    name="intent"
                    value="delete"
                    type="submit"
                  >
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
