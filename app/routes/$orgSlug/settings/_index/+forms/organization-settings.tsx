import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
} from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { Form, useActionData, useNavigation } from 'react-router'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  HStack,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Switch,
} from '~/app/components/ui'
import { DEFAULT_TIMEZONE } from '~/app/libs/constants'
import { INTENTS, organizationSettingsSchema as schema } from '../+schema'
import type { action } from '../../_index/index'

const timezones = Intl.supportedValuesOf('timeZone')

export const OrganizationSettings = ({
  organization,
  organizationSetting,
}: {
  organization: {
    name: string
  }
  organizationSetting: {
    releaseDetectionMethod: string
    releaseDetectionKey: string
    isActive: number
    excludedUsers: string
    timezone: string
  }
}) => {
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === INTENTS.organizationSettings
  const [form, fields] = useForm({
    lastResult:
      (actionData?.intent === INTENTS.organizationSettings &&
        actionData?.lastResult) ||
      undefined,
    defaultValue: {
      name: organization.name,
      releaseDetectionMethod: organizationSetting?.releaseDetectionMethod,
      releaseDetectionKey: organizationSetting?.releaseDetectionKey,
      isActive: organizationSetting?.isActive ? '1' : undefined,
      excludedUsers: organizationSetting?.excludedUsers,
      timezone: organizationSetting?.timezone ?? DEFAULT_TIMEZONE,
    },
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
  })

  return (
    <Form method="POST" {...getFormProps(form)}>
      <Stack>
        <fieldset className="space-y-1">
          <Label htmlFor={fields.name.id}>Organization Name</Label>
          <Input {...getInputProps(fields.name, { type: 'text' })} />
          <div className="text-destructive">{fields.name.errors}</div>
        </fieldset>

        <fieldset className="space-y-1">
          <Label htmlFor={fields.releaseDetectionMethod.id}>
            Release Detection Method
          </Label>
          <Select
            name={fields.releaseDetectionMethod.name}
            defaultValue={fields.releaseDetectionMethod.initialValue}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a method" />
            </SelectTrigger>
            <SelectContent {...getSelectProps(fields.releaseDetectionMethod)}>
              <SelectGroup>
                <SelectItem value="branch">Branch</SelectItem>
                <SelectItem value="tags">Tags</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="text-destructive">
            {fields.releaseDetectionMethod.errors}
          </div>
        </fieldset>

        <fieldset className="space-y-1">
          <Label htmlFor={fields.releaseDetectionKey.id}>
            Release Detection Key
          </Label>
          <Input
            {...getInputProps(fields.releaseDetectionKey, {
              type: 'text',
            })}
          />
          <div className="text-destructive">
            {fields.releaseDetectionKey.errors}
          </div>
        </fieldset>

        <fieldset className="space-y-1">
          <Label htmlFor={fields.timezone.id}>Timezone</Label>
          <Select
            name={fields.timezone.name}
            defaultValue={fields.timezone.initialValue}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a timezone" />
            </SelectTrigger>
            <SelectContent {...getSelectProps(fields.timezone)}>
              <SelectGroup>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-sm">
            Timezone used for displaying dates throughout the dashboard.
          </p>
          <div className="text-destructive">{fields.timezone.errors}</div>
        </fieldset>

        <fieldset className="space-y-1">
          <HStack>
            <Label htmlFor={fields.isActive.id}>Active</Label>
            <Switch
              name={fields.isActive.name}
              id={fields.isActive.id}
              defaultChecked={fields.isActive.initialValue === '1'}
            />
          </HStack>
          <div className="text-destructive">{fields.isActive.errors}</div>
        </fieldset>

        <fieldset className="space-y-1">
          <Label htmlFor={fields.excludedUsers.id}>
            Excluded Users (comma separated)
          </Label>
          <Input
            {...getInputProps(fields.excludedUsers, { type: 'text' })}
            placeholder="e.g. my-org-bot, some-other-bot"
          />
          <p className="text-muted-foreground text-sm">
            Copilot is excluded by default. Add additional usernames to exclude
            from cycle time calculations.
          </p>
          <div className="text-destructive">{fields.excludedUsers.errors}</div>
        </fieldset>

        {form.errors && (
          <Alert variant="destructive">
            <AlertTitle>System Error</AlertTitle>
            <AlertDescription>{form.errors}</AlertDescription>
          </Alert>
        )}

        <div>
          <Button
            type="submit"
            name="intent"
            value={INTENTS.organizationSettings}
            loading={isSubmitting}
          >
            Update
          </Button>
        </div>
      </Stack>
    </Form>
  )
}
