import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { json, redirect, type ActionArgs } from '@remix-run/node'
import { Form, Link } from '@remix-run/react'
import { z } from 'zod'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  HStack,
  Input,
  Label,
  Stack,
} from '~/app/components/ui'
import { createCompany } from '~/app/models/admin/company.server'

export const schema = z.object({
  id: z.string().min(1, { message: 'Company ID is required' }),
  name: z.string().min(1, { message: 'Company name is required' }),
})

export const action = async ({ request }: ActionArgs) => {
  const submission = await parse(await request.formData(), { schema })
  if (!submission.value) {
    return json({ error: submission.error })
  }
  const company = await createCompany(submission.value)
  if (!company) {
    throw new Error('Failed to create company')
  }
  return redirect(`/admin/${company.id}`)
}

const CompanyNewPage = () => {
  const [form, { id, name }] = useForm({
    onValidate({ formData }) {
      return parse(formData, { schema })
    },
    id: 'company-add-form',
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a new company</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...form.props}>
          <Stack>
            <fieldset>
              <Label htmlFor={id.id}>ID</Label>
              <Input {...conform.input(id)} />
              <div className="text-destructive">{id.error}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={name.id}>Company name</Label>
              <Input {...conform.input(name)} />
              <div className="text-destructive">{name.error}</div>
            </fieldset>
          </Stack>
        </Form>
      </CardContent>
      <CardFooter>
        <HStack>
          <Button type="submit" form={form.id}>
            Create
          </Button>

          <Button asChild type="button" variant="ghost">
            <Link to="/admin">Cancel</Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
export default CompanyNewPage
