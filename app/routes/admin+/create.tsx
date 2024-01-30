import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node'
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

export const handle = { breadcrumb: () => ({ label: 'Create Company' }) }

export const schema = z.object({
  companyId: z
    .string()
    .max(20)
    .regex(/^[a-zA-Z0-9]+$/, 'Must be alphanumeric'),
  companyName: z.string().min(1).max(20),
  teamId: z
    .string()
    .max(20)
    .regex(/^[a-zA-Z0-9]+$/, 'Must be alphanumeric'),
  teamName: z.string().max(20),
})

export const action = async ({ request }: ActionFunctionArgs) => {
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
  const [form, { companyId, companyName, teamId, teamName }] = useForm({
    id: 'company-add-form',
    defaultValue: {
      teamId: 'developers',
      teamName: 'Developers',
    },
    onValidate: ({ formData }) => parse(formData, { schema }),
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
              <Label htmlFor={companyId.id}>Company ID</Label>
              <Input autoFocus {...conform.input(companyId)} />
              <div className="text-destructive">{companyId.error}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={companyName.id}>Company name</Label>
              <Input {...conform.input(companyName)} />
              <div className="text-destructive">{companyName.error}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={teamId.id}>Team ID</Label>
              <Input {...conform.input(teamId)} />
              <div className="text-destructive">{teamId.error}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={teamName.id}>Initial team name</Label>
              <Input {...conform.input(teamName)} />
              <div className="text-destructive">{teamName.error}</div>
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
