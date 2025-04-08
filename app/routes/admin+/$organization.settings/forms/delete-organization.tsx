import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { Form, href, Link, useActionData } from 'react-router'
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
import dayjs from '~/app/libs/dayjs'
import type { DB, Selectable } from '~/app/services/db.server'
import { INTENTS, deleteOrganizationSchema as schema } from '../types'
import type { action } from './delete-organization.action.server'

interface DeleteOrganizationProps {
  organization: Selectable<DB.Organization>
}
export const DeleteOrganization = ({
  organization,
}: DeleteOrganizationProps) => {
  const actionData = useActionData<typeof action>()
  const [form, { confirm }] = useForm({
    lastResult:
      (actionData?.intent === INTENTS.deleteOrganization &&
        actionData.lastResult) ||
      undefined,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
    shouldValidate: 'onInput',
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete Organization</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack>
          <div className="grid grid-cols-[auto_1fr] items-baseline gap-2 gap-y-4">
            <Label>ID</Label>
            <div> {organization.id}</div>

            <Label>Name</Label>
            <div> {organization.name}</div>

            <Label>Created At</Label>
            <div>
              {' '}
              {dayjs
                .utc(organization.createdAt)
                .tz('asia/tokyo')
                .format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>

          <Form method="POST" {...getFormProps(form)}>
            <input
              type="hidden"
              name="organizationId"
              value={organization.id}
            />
            <Input
              {...getInputProps(confirm, { type: 'text' })}
              placeholder="type 'delete this organization' here"
            />
            <div id={confirm.errorId} className="text-destructive text-sm">
              {confirm.errors}
            </div>
          </Form>
        </Stack>
      </CardContent>
      <CardFooter>
        <HStack>
          <Button
            type="submit"
            disabled={!form.valid}
            variant="destructive"
            form={form.id}
            name="intent"
            value={INTENTS.deleteOrganization}
          >
            DELETE
          </Button>

          <Button asChild variant="ghost">
            <Link
              to={href('/admin/:organization/settings', {
                organization: organization.id,
              })}
            >
              Cancel
            </Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
