import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { ActionFunctionArgs, LoaderFunctionArgs, json } from '@remix-run/node'
import { Form, Link } from '@remix-run/react'
import { redirectWithSuccess } from 'remix-toast'
import { z } from 'zod'
import { zx } from 'zodix'
import { Button, HStack, Input, Label, Stack } from '~/app/components/ui'
import { addTeam } from '~/app/models/admin/team.server'

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

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  return json({ companyId })
}

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = await parse(await request.formData(), { schema })
  if (!submission.value) {
    return submission
  }

  const { id, name } = submission.value
  await addTeam({
    id,
    name,
    company: { connect: { id: companyId } },
  })

  return redirectWithSuccess('..', `Team ${id} ${name} created`)
}

export default function TeamAddPage() {
  const [form, { id, name }] = useForm({
    id: 'team-add',
    onValidate: ({ formData }) => {
      return parse(formData, { schema })
    },
  })

  return (
    <Form method="POST" {...form.props}>
      <Stack>
        <h3 className="text-md font-bold">Add Team</h3>

        <fieldset>
          <Label htmlFor={id.id}>ID</Label>
          <Input {...conform.input(id)} />
          {id.error && <div className="text-destructive text-sm">{id.error}</div>}
        </fieldset>

        <fieldset>
          <Label>Name</Label>
          <Input {...conform.input(name)} />
          {name.error && <div className="text-destructive text-sm">{name.error}</div>}
        </fieldset>

        <HStack>
          <Button asChild variant="ghost">
            <Link to="..">Cancel</Link>
          </Button>
          <Button type="submit">Create</Button>
        </HStack>
      </Stack>
    </Form>
  )
}
