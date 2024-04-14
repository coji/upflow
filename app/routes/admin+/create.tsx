import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node'
import { Form, Link, useActionData } from '@remix-run/react'
import { $path } from 'remix-routes'
import { z } from 'zod'
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
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return json(submission.reply())
  }
  const company = await createCompany(submission.value)
  if (!company) {
    return json(
      submission.reply({
        formErrors: ['Failed to create company'],
      }),
    )
  }
  return redirect($path('/admin/:companyId', { companyId: company.id }))
}

const CompanyNewPage = () => {
  const lastResult = useActionData<typeof action>()
  const [form, { companyId, companyName, teamId, teamName }] = useForm({
    defaultValue: {
      teamId: 'developers',
      teamName: 'Developers',
    },
    lastResult,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a new company</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...getFormProps(form)}>
          <Stack>
            <fieldset>
              <Label htmlFor={companyId.id}>Company ID</Label>
              <Input
                autoFocus
                {...getInputProps(companyId, { type: 'text' })}
              />
              <div className="text-destructive">{companyId.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={companyName.id}>Company name</Label>
              <Input {...getInputProps(companyName, { type: 'text' })} />
              <div className="text-destructive">{companyName.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={teamId.id}>Team ID</Label>
              <Input {...getInputProps(teamId, { type: 'text' })} />
              <div className="text-destructive">{teamId.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={teamName.id}>Initial team name</Label>
              <Input {...getInputProps(teamName, { type: 'text' })} />
              <div className="text-destructive">{teamName.errors}</div>
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
        <HStack>
          <Button type="submit" form={form.id}>
            Create
          </Button>

          <Button asChild type="button" variant="ghost">
            <Link to={$path('/admin')}>Cancel</Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
export default CompanyNewPage
