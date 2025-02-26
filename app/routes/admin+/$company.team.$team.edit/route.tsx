import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { Form, Link, href } from 'react-router'
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
import type { Route } from './+types/route'
import { deleteTeam, getTeam, updateTeam } from './functions.server'

export const handle = {
  breadcrumb: ({ companyId, team }: Awaited<ReturnType<typeof loader>>) => ({
    label: team.name,
    to: href('/admin/:company/teams/:team', {
      company: companyId,
      team: team.id,
    }),
  }),
}

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { company: companyId, team: teamId } = zx.parseParams(params, {
    company: z.string(),
    team: z.string(),
  })
  const team = await getTeam(companyId, teamId)
  if (!team) {
    throw new Error('チームが見つかりません')
  }
  return { companyId, team }
}

const schema = z.object({
  name: z
    .string({ required_error: '必須です' })
    .max(20, { message: '20文字以内です' }),
  intent: z.enum(['update', 'delete']),
})

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { company: companyId, team: teamId } = zx.parseParams(params, {
    company: z.string(),
    team: z.string(),
  })
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
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
    return {
      lastResult: submission.reply({
        formErrors: [`Failed to ${intent} team: ${String(e)}`],
      }),
    }
  }

  return redirectWithSuccess(
    href('/admin/:company/teams', { company: companyId }),
    toastMessage,
  )
}

export default function TeamDetailPage({
  loaderData: { team },
  actionData,
}: Route.ComponentProps) {
  const [form, { name }] = useForm({
    defaultValue: team,
    lastResult: actionData?.lastResult,
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
            <div className="text-destructive text-sm">{name.errors}</div>
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
