import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { Form, Link, useActionData, useNavigation } from 'react-router'
import { Button, HStack, Input, Label, Stack } from '~/app/components/ui'
import { useTimezone } from '~/app/hooks/use-timezone'
import dayjs from '~/app/libs/dayjs'
import { INTENTS, deleteOrganizationSchema as schema } from '../+schema'
import type { action } from '../../danger/index'

interface DeleteOrganizationProps {
  organization: {
    id: string
    name: string
    slug: string
    createdAt: string
  }
}
export const DeleteOrganization = ({
  organization,
}: DeleteOrganizationProps) => {
  const timezone = useTimezone()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === INTENTS.deleteOrganization
  const [form, { confirm }] = useForm({
    lastResult:
      (actionData?.intent === INTENTS.deleteOrganization &&
        actionData.lastResult) ||
      undefined,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
    shouldValidate: 'onInput',
  })

  return (
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
            .tz(timezone)
            .format('YYYY-MM-DD HH:mm:ss')}
        </div>
      </div>

      <Form method="POST" {...getFormProps(form)}>
        <input type="hidden" name="organizationId" value={organization.id} />
        <Input
          {...getInputProps(confirm, { type: 'text' })}
          placeholder="type 'delete this organization' here"
        />
        <div id={confirm.errorId} className="text-destructive text-sm">
          {confirm.errors}
        </div>
      </Form>

      <HStack>
        <Button
          type="submit"
          disabled={!form.valid}
          variant="destructive"
          form={form.id}
          name="intent"
          value={INTENTS.deleteOrganization}
          loading={isSubmitting}
        >
          DELETE
        </Button>

        <Button asChild variant="ghost">
          <Link to={`/${organization.slug}/settings`}>Cancel</Link>
        </Button>
      </HStack>
    </Stack>
  )
}
