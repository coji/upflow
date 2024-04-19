import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { Form, useActionData } from '@remix-run/react'
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
  exportSetting?: Selectable<DB.ExportSetting>
}

export const ExportSettings = ({ exportSetting }: ExportSettingsProps) => {
  const actionData = useActionData<typeof action>()
  const [form, { id, sheet_id, client_email, private_key }] = useForm({
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
              <Label htmlFor={sheet_id.id}>Sheet Id</Label>
              <Input {...getInputProps(sheet_id, { type: 'text' })} />
              <div className="text-destructive">{sheet_id.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={client_email.id}>Client Email</Label>
              <Input {...getInputProps(client_email, { type: 'text' })} />
              <div className="text-destructive">{client_email.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={private_key.id}>Private Key</Label>
              <Textarea {...getInputProps(private_key, { type: 'text' })} />
              <div className="text-destructive">{private_key.errors}</div>
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
