import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
} from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { Form, useActionData } from 'react-router'
import Github from '~/app/components/icons/Github'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  HStack,
  Label,
  RadioGroup,
  RadioGroupItem,
  Stack,
  Textarea,
} from '~/app/components/ui'
import { INTENTS, integrationSettingsSchema as schema } from '../+schema'
import type { action } from '../../integration/index'

interface IntegrationSettingsProps {
  integration?: {
    provider: string
    method: string
    privateToken: string | null
  }
}

export const IntegrationSettings = ({
  integration,
}: IntegrationSettingsProps) => {
  const actionData = useActionData<typeof action>()
  const [form, { provider, method, privateToken }] = useForm({
    lastResult:
      actionData?.intent === INTENTS.integrationSettings
        ? actionData.lastResult
        : undefined,
    defaultValue: integration,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
  })

  return (
    <Form method="POST" {...getFormProps(form)}>
      <input type="hidden" name="intent" value={INTENTS.integrationSettings} />
      <Stack>
        <fieldset className="space-y-1">
          <Label htmlFor={provider.id}>Provider</Label>
          <RadioGroup {...getInputProps(provider, { type: 'text' })}>
            <HStack>
              <RadioGroupItem id="github" value="github" />
              <Label htmlFor="github">
                <HStack className="text-github gap-1">
                  <Github />
                  <span>GitHub</span>
                </HStack>
              </Label>
            </HStack>
          </RadioGroup>
          <div className="text-destructive">{provider.errors}</div>
        </fieldset>

        <fieldset className="space-y-1">
          <Label htmlFor={method.id}>Method</Label>
          <RadioGroup {...getInputProps(method, { type: 'text' })}>
            <HStack>
              <RadioGroupItem id="token" value="token" />
              <Label htmlFor="token">Token</Label>
            </HStack>
          </RadioGroup>
          <div className="text-destructive">{method.errors}</div>
        </fieldset>

        <fieldset className="space-y-1">
          <Label htmlFor={privateToken.id}>Private Token</Label>
          <Textarea {...getTextareaProps(privateToken)} />
          <div className="text-destructive">{privateToken.errors}</div>
        </fieldset>

        {form.errors && (
          <Alert variant="destructive">
            <AlertTitle>System Error</AlertTitle>
            <AlertDescription>{form.errors}</AlertDescription>
          </Alert>
        )}

        <div>
          <Button type="submit">Update</Button>
        </div>
      </Stack>
    </Form>
  )
}
