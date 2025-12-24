import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
} from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { Form, useActionData } from 'react-router'
import Github from '~/app/components/icons/Github'
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
  Label,
  RadioGroup,
  RadioGroupItem,
  Stack,
  Textarea,
} from '~/app/components/ui'
import type { DB, Selectable } from '~/app/services/db.server'
import { INTENTS, integrationSettingsSchema as schema } from '../types'
import type { action } from './integration-settings.action.server'

interface IntegrationSettingsProps {
  integration?: Selectable<DB.Integrations>
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
    <Card>
      <CardHeader>
        <CardTitle>Integration</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...getFormProps(form)}>
          <input
            type="hidden"
            name="intent"
            value={INTENTS.integrationSettings}
          />
          <input type="hidden" name="id" value={integration?.id} />
          <Stack>
            <fieldset>
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

            <fieldset>
              <Label htmlFor={method.id}>Method</Label>
              <RadioGroup {...getInputProps(method, { type: 'text' })}>
                <HStack>
                  <RadioGroupItem id="token" value="token" />
                  <Label htmlFor="token">トークン</Label>
                </HStack>
              </RadioGroup>
              <div className="text-destructive">{method.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={privateToken.id}>Private Token</Label>
              <Textarea {...getTextareaProps(privateToken)} />
              <div className="text-destructive">{privateToken.errors}</div>
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
        <Stack direction="row">
          <Button type="submit" form={form.id}>
            Update
          </Button>
        </Stack>
      </CardFooter>
    </Card>
  )
}
