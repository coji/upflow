import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { Form, href, Link, redirect } from 'react-router'
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
import type { Route } from './+types/route'
import { createCompany } from './mutations.server'

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

export const action = async ({ request }: Route.ActionArgs) => {
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  try {
    const { company } = await createCompany(submission.value)
    return redirect(href('/admin/:company', { company: company.id }))
  } catch (e) {
    return {
      lastResult: submission.reply({
        formErrors: [`Failed to create company: ${String(e)}`],
      }),
    }
  }
}

const CompanyNewPage = ({ actionData }: Route.ComponentProps) => {
  const [form, { companyId, companyName, teamId, teamName }] = useForm({
    lastResult: actionData?.lastResult,
    defaultValue: {
      teamId: 'developers',
      teamName: 'Developers',
    },
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
                <AlertDescription>
                  {JSON.stringify(form.errors)}
                </AlertDescription>
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
            <Link to={href('/admin')}>Cancel</Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
export default CompanyNewPage
