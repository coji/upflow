import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import type { ActionFunctionArgs } from '@remix-run/node'
import { Form, useActionData } from '@remix-run/react'
import { $path } from 'remix-routes'
import { redirectWithSuccess } from 'remix-toast'
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
import { addTeam } from './mutations.server'

export const handle = {
  breadcrumb: ({ companyId }: { companyId: string }) => ({
    label: 'Create a team',
    to: $path('/admin/:companyId/teams/add', { companyId }),
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

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return submission.reply()
  }

  const { id, name } = submission.value
  try {
    await addTeam({ id, name, companyId })
  } catch (e) {
    return submission.reply({
      formErrors: [`Error saving team: ${String(e)}`],
    })
  }

  return redirectWithSuccess(
    $path('/admin/:companyId/teams/:teamId', { companyId, teamId: id }),
    `Team ${id} ${name} created`,
  )
}

export default function TeamAddPage() {
  const lastResult = useActionData<typeof action>()
  const [form, { id, name }] = useForm({
    id: 'team-add',
    lastResult,
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
              <div className="text-sm text-destructive">{id.errors}</div>
            </fieldset>

            <fieldset>
              <Label>Name</Label>
              <Input {...getInputProps(name, { type: 'text' })} />
              <div className="text-sm text-destructive">{name.errors}</div>
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
