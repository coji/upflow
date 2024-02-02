import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  json,
  redirect,
} from '@remix-run/node'
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react'
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
import {
  getExportSetting,
  upsertExportSetting,
} from '~/app/models/admin/export-setting.server'

export const handle = { breadcrumb: () => ({ label: 'Export Settings' }) }

const schema = z.object({
  sheetId: z.string(),
  clientEmail: z.string().email(),
  privateKey: z.string(),
})

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const exportSetting = await getExportSetting(companyId)
  return json({ companyId, exportSetting })
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return json(submission.reply())
  }

  try {
    const { sheetId, clientEmail, privateKey } = submission.value
    await upsertExportSetting({ companyId, sheetId, clientEmail, privateKey })
  } catch (e) {
    return json(
      submission.reply({
        formErrors: [`Error saving export settings: ${String(e)}`],
      }),
    )
  }

  return redirect(`/admin/${params.companyId}`)
}

const ExportSetting = () => {
  const { companyId, exportSetting } = useLoaderData<typeof loader>()
  const lastResult = useActionData<typeof action>()

  const [form, { sheetId, clientEmail, privateKey }] = useForm({
    id: 'export-setting-form',
    lastResult,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
    defaultValue: {
      sheetId: exportSetting?.sheetId,
      clientEmail: exportSetting?.clientEmail,
      privateKey: exportSetting?.privateKey,
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...getFormProps(form)}>
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
          <Button type="submit" form={form.id}>
            Add
          </Button>
          <Button variant="ghost" asChild>
            <Link to={`/admin/${companyId}`}>Cancel</Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
export default ExportSetting
