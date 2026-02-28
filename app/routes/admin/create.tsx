import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { Form, href, Link, redirect, useNavigation } from 'react-router'
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
import { requireSuperAdmin } from '~/app/libs/auth.server'
import { createOrganization } from './+create/mutations.server'
import type { Route } from './+types/create'

export const handle = { breadcrumb: () => ({ label: 'Create Organization' }) }

export const schema = z.object({
  organizationSlug: z
    .string()
    .max(40)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Must be lowercase alphanumeric with single hyphens, no leading/trailing hyphens',
    ),
  organizationName: z.string().min(1).max(40),
})

export const action = async ({ request }: Route.ActionArgs) => {
  const { user } = await requireSuperAdmin(request)
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  try {
    const { organization } = await createOrganization({
      ...submission.value,
      creatorUserId: user.id,
    })
    return redirect(`/${organization.slug}`)
  } catch (e) {
    return {
      lastResult: submission.reply({
        formErrors: [`Failed to create organization: ${String(e)}`],
      }),
    }
  }
}

const OrganizationNewPage = ({ actionData }: Route.ComponentProps) => {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const [form, { organizationSlug, organizationName }] = useForm({
    lastResult: actionData?.lastResult,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a new organization</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...getFormProps(form)}>
          <Stack>
            <fieldset className="space-y-1">
              <Label htmlFor={organizationSlug.id}>Organization Slug</Label>
              <Input
                autoFocus
                placeholder="my-team"
                {...getInputProps(organizationSlug, { type: 'text' })}
              />
              <div className="text-muted-foreground text-xs">
                URL: /{organizationSlug.value || 'slug'}
              </div>
              <div className="text-destructive">{organizationSlug.errors}</div>
            </fieldset>

            <fieldset className="space-y-1">
              <Label htmlFor={organizationName.id}>Organization Name</Label>
              <Input {...getInputProps(organizationName, { type: 'text' })} />
              <div className="text-destructive">{organizationName.errors}</div>
            </fieldset>

            {form.errors && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{form.errors?.join(', ')}</AlertDescription>
              </Alert>
            )}
          </Stack>
        </Form>
      </CardContent>
      <CardFooter>
        <HStack>
          <Button type="submit" form={form.id} loading={isSubmitting}>
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
