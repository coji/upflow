import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { Form, useActionData } from 'react-router'
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
  Textarea,
} from '~/app/components/ui'
import type { DB, Selectable } from '~/app/services/db.server'
import { INTENTS, exportSettingsSchema as schema } from '../types'
import type { action } from './export-settings.action.server'

interface ExportSettingsProps {
  exportSetting?: Selectable<DB.ExportSettings>
}

export const ExportSettings = ({ exportSetting }: ExportSettingsProps) => {
  const actionData = useActionData<typeof action>()
  const [form, { id, sheetId, clientEmail, privateKey }] = useForm({
    lastResult:
      (actionData?.intent === INTENTS.exportSettings &&
        actionData?.lastResult) ||
      undefined,
    defaultValue: exportSetting,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...getFormProps(form)}>
          <input type="hidden" name="id" defaultValue={id.value} />
          <Stack>
            <fieldset>
              <Label htmlFor={sheetId.id}>Sheet Id</Label>
              <Input {...getInputProps(sheetId, { type: 'text' })} />
              <div className="text-destructive">{sheetId.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={clientEmail.id}>Client Email</Label>
              <Input {...getInputProps(clientEmail, { type: 'text' })} />
              <div className="text-destructive">{clientEmail.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={privateKey.id}>Private Key</Label>
              <Textarea {...getInputProps(privateKey, { type: 'text' })} />
              <div className="text-destructive">{privateKey.errors}</div>
            </fieldset>
          </Stack>

          {form.errors && (
            <Alert variant="destructive">
              <AlertTitle>システムエラー</AlertTitle>
              <AlertDescription>{form.errors}</AlertDescription>
            </Alert>
          )}
        </Form>
      </CardContent>
      <CardFooter>
        <HStack>
          <Button
            type="submit"
            form={form.id}
            name="intent"
            value={INTENTS.exportSettings}
          >
            Update
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
