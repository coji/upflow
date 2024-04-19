import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { Form, useActionData } from '@remix-run/react'
import { nanoid } from 'nanoid'
import { $path } from 'remix-routes'
import { redirectWithSuccess } from 'remix-toast'
import { z } from 'zod'
import { zx } from 'zodix'
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
import { insertExportSetting, updateExportSetting } from './mutations'

export const handle = { breadcrumb: () => ({ label: 'Export Settings' }) }

const schema = z.object({
  id: z.string().optional(),
  sheet_id: z.string(),
  client_email: z.string().email(),
  private_key: z.string(),
})

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return json(submission.reply())
  }

  try {
    const { id, sheet_id, client_email, private_key } = submission.value
    if (id) {
      await updateExportSetting(id, {
        company_id: companyId,
        sheet_id,
        client_email,
        private_key,
        updated_at: new Date().toISOString(),
      })
    } else {
      await insertExportSetting({
        id: nanoid(),
        company_id: companyId,
        sheet_id,
        client_email,
        private_key,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
    }
  } catch (e) {
    return json(
      submission.reply({
        formErrors: [`Error saving export settings: ${String(e)}`],
      }),
    )
  }
  return redirectWithSuccess(
    $path('/admin/:companyId/settings', { companyId }),
    {
      message: 'Update export settings successfully',
    },
  )
}

interface ExportSettingsProps {
  companyId: string
  exportSetting?: Selectable<DB.ExportSetting>
}

export const ExportSettings = ({
  companyId,
  exportSetting,
}: ExportSettingsProps) => {
  const lastResult = useActionData<typeof action>()
  const [form, { id, sheet_id, client_email, private_key }] = useForm({
    lastResult,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
    defaultValue: exportSetting,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export</CardTitle>
      </CardHeader>
      <CardContent>
        <Form
          method="POST"
          action={$path('/admin/:companyId/settings/export', { companyId })}
          {...getFormProps(form)}
        >
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
          <Button type="submit" form={form.id}>
            Update
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
