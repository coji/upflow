import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { json, redirect, type ActionArgs } from '@remix-run/node'
import { Form } from '@remix-run/react'
import { z } from 'zod'
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label } from '~/app/components/ui'
import { createCompany } from '~/app/models/admin/company.server'

export const schema = z.object({
  name: z.string().min(1, { message: 'Company name is required' }),
})

export const action = async ({ request }: ActionArgs) => {
  const submission = await parse(await request.formData(), { schema })
  if (!submission.value) {
    return json({ error: submission.error })
  }
  const company = await createCompany(submission.value.name)
  if (!company) {
    throw new Error('Failed to create company')
  }
  return redirect(`/admin/${company.id}`)
}

const CompanyNewPage = () => {
  const [form, { name }] = useForm({
    onValidate({ form, formData }) {
      return parse(formData, { schema })
    },
    id: 'company-new-form',
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a new company</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...form.props}>
          <Label htmlFor={name.id}>Company name</Label>
          <Input autoFocus {...conform.input(name)} />
          <div className="text-destructive">{name.error}</div>
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
export default CompanyNewPage
