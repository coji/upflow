import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
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
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  HStack,
  Input,
  Label,
  Stack,
} from '~/app/components/ui'
import { addTeam } from './mutations.server'

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

export const loader = ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  return json({ companyId })
}

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return json(submission.reply())
  }

  const { id, name } = submission.value
  try {
    await addTeam({ id, name, company_id: companyId })
  } catch (e) {
    return json(
      submission.reply({
        formErrors: [`Error saving team: ${String(e)}`],
      }),
    )
  }

  return redirectWithSuccess(
    $path('/admin/:companyId/teams/:teamId', { companyId, teamId: id }),
    `Team ${id} ${name} created`,
  )
}

export default function TeamAddPage() {
  const { companyId } = useLoaderData<typeof loader>()
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
        <CardTitle>Add Team</CardTitle>
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

            <HStack>
              <Button asChild variant="ghost">
                <Link to={$path('/admin/:companyId', { companyId })}>
                  Cancel
                </Link>
              </Button>
              <Button type="submit">Create</Button>
            </HStack>
          </Stack>
        </Form>
      </CardContent>
    </Card>
  )
}
