import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { json, redirect, type ActionArgs, type LoaderArgs } from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
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
  Textarea,
} from '~/app/components/ui'
import { getExportSetting, upsertExportSetting } from '~/app/models/admin/export-setting.server'

const schema = z.object({
  sheetId: z.string().nonempty(),
  clientEmail: z.string().email().nonempty(),
  privateKey: z.string().nonempty(),
})

export const loader = async ({ params }: LoaderArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const exportSetting = await getExportSetting(companyId)
  return json({ exportSetting })
}

export const action = async ({ request, params }: ActionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = parse(await request.formData(), { schema })
  if (!submission.value) {
    throw new Error('Invalid form data')
  }
  const { sheetId, clientEmail, privateKey } = submission.value
  await upsertExportSetting({ companyId, sheetId, clientEmail, privateKey })
  return redirect(`/admin/${params.companyId}`)
}

const ExportSetting = () => {
  const { exportSetting } = useLoaderData<typeof loader>()

  const [form, { sheetId, clientEmail, privateKey }] = useForm({
    id: 'export-setting-form',
    onValidate({ formData }) {
      return parse(formData, { schema })
    },
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
        <Form method="POST" {...form.props}>
          <Stack>
            <fieldset>
              <Label htmlFor={sheetId.id}>Sheet Id</Label>
              <Input {...conform.input(sheetId)}></Input>
              <div className="text-destructive">{sheetId.error}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={clientEmail.id}>Client Email</Label>
              <Input {...conform.input(clientEmail)}></Input>
              <div className="text-destructive">{clientEmail.error}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={privateKey.id}>Private Key</Label>
              <Textarea {...conform.input(privateKey)}></Textarea>
              <div className="text-destructive">{privateKey.error}</div>
            </fieldset>
          </Stack>
        </Form>
      </CardContent>
      <CardFooter>
        <HStack>
          <Button type="submit" form={form.id}>
            Add
          </Button>
          <Button variant="ghost" asChild>
            <Link to="..">Cancel</Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
export default ExportSetting
