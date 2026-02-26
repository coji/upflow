import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
} from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { Form, useActionData } from 'react-router'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Label,
  Stack,
  Textarea,
} from '~/app/components/ui'
import type { DB, Selectable } from '~/app/services/db.server'
import { INTENTS, exportSettingsSchema as schema } from '../+schema'
import type { action } from '../../export/index'

interface ExportSettingsProps {
  exportSetting?: Selectable<DB.ExportSettings>
}

export const ExportSettings = ({ exportSetting }: ExportSettingsProps) => {
  const actionData = useActionData<typeof action>()
  const [form, { sheetId, clientEmail, privateKey }] = useForm({
    lastResult:
      (actionData?.intent === INTENTS.exportSettings &&
        actionData?.lastResult) ||
      undefined,
    defaultValue: exportSetting,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
  })

  return (
    <Form method="POST" {...getFormProps(form)}>
      <Stack>
        <fieldset className="space-y-1">
          <Label htmlFor={sheetId.id}>Sheet Id</Label>
          <Input {...getInputProps(sheetId, { type: 'text' })} />
          <div className="text-destructive">{sheetId.errors}</div>
        </fieldset>

        <fieldset className="space-y-1">
          <Label htmlFor={clientEmail.id}>Client Email</Label>
          <Input {...getInputProps(clientEmail, { type: 'text' })} />
          <div className="text-destructive">{clientEmail.errors}</div>
        </fieldset>

        <fieldset className="space-y-1">
          <Label htmlFor={privateKey.id}>Private Key</Label>
          <Textarea {...getTextareaProps(privateKey)} />
          <div className="text-destructive">{privateKey.errors}</div>
        </fieldset>

        {form.errors && (
          <Alert variant="destructive">
            <AlertTitle>System Error</AlertTitle>
            <AlertDescription>{form.errors}</AlertDescription>
          </Alert>
        )}

        <div>
          <Button type="submit" name="intent" value={INTENTS.exportSettings}>
            Update
          </Button>
        </div>
      </Stack>
    </Form>
  )
}
