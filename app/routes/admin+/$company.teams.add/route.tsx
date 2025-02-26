import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { Form } from 'react-router'
import { redirectWithSuccess } from 'remix-toast'
import { $path } from 'safe-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Stack,
} from '~/app/components/ui'
import type { Route } from './+types/route'
import { addTeam } from './mutations.server'

export const handle = {
  breadcrumb: ({ companyId }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'Create a team',
    to: $path('/admin/:company/teams/add', { company: companyId }),
  }),
}

const schema = z.object({
  id: z
    .string()
    .max(20)
    .regex(/^[a-zA-Z0-9]+$/, 'Must be alphanumeric'),
  name: z
    .string()
    .max(20)
    .regex(/^[a-zA-Z0-9]+$/, 'Must be alphanumeric'),
})

export const loader = ({ params }: Route.LoaderArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  return { companyId }
}

export const action = async ({ params, request }: Route.ActionArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  const { id, name } = submission.value
  try {
    await addTeam({ id, name, companyId })
  } catch (e) {
    return {
      lastResult: submission.reply({
        formErrors: [`Error saving team: ${String(e)}`],
      }),
    }
  }

  return redirectWithSuccess(
    $path('/admin/:company/teams/:team', { company: companyId, team: id }),
    `Team ${id} ${name} created`,
  )
}

export default function TeamAddPage({ actionData }: Route.ComponentProps) {
  const [form, { id, name }] = useForm({
    id: 'team-add',
    lastResult: actionData?.lastResult,
    constraint: getZodConstraint(schema),
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a team</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...getFormProps(form)}>
          <Stack>
            <fieldset>
              <Label htmlFor={id.id}>ID</Label>
              <Input {...getInputProps(id, { type: 'text' })} />
              <div className="text-destructive text-sm">{id.errors}</div>
            </fieldset>

            <fieldset>
              <Label>Name</Label>
              <Input {...getInputProps(name, { type: 'text' })} />
              <div className="text-destructive text-sm">{name.errors}</div>
            </fieldset>

            {form.errors && (
              <Alert variant="destructive">
                <AlertTitle>システムエラー</AlertTitle>
                <AlertDescription>{form.errors}</AlertDescription>
              </Alert>
            )}
          </Stack>
        </Form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form={form.id}>
          Create
        </Button>
      </CardFooter>
    </Card>
  )
}
