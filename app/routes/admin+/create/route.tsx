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
import { createOrganization } from './mutations.server'

export const handle = { breadcrumb: () => ({ label: 'Create Company' }) }

export const schema = z.object({
  organizationId: z
    .string()
    .max(20)
    .regex(/^[a-zA-Z0-9]+$/, 'Must be alphanumeric'),
  organizationName: z.string().min(1).max(20),
})

export const action = async ({ request }: Route.ActionArgs) => {
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  try {
    const { organization } = await createOrganization(submission.value)
    return redirect(
      href('/admin/:organization', { organization: organization.id }),
    )
  } catch (e) {
    return {
      lastResult: submission.reply({
        formErrors: [`Failed to create organization: ${String(e)}`],
      }),
    }
  }
}

const OrganizationNewPage = ({ actionData }: Route.ComponentProps) => {
  const [form, { organizationId, organizationName }] = useForm({
    lastResult: actionData?.lastResult,
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
              <Label htmlFor={organizationId.id}>Company ID</Label>
              <Input
                autoFocus
                {...getInputProps(organizationId, { type: 'text' })}
              />
              <div className="text-destructive">{organizationId.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={organizationName.id}>Company name</Label>
              <Input {...getInputProps(organizationName, { type: 'text' })} />
              <div className="text-destructive">{organizationName.errors}</div>
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
export default OrganizationNewPage
