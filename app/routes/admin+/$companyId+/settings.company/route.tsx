import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
} from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { Form } from '@remix-run/react'
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Switch,
} from '~/app/components/ui'
import type { DB, Selectable } from '~/app/services/db.server'
import { updateCompany } from './mutations.server'

const schema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  release_detection_method: z.enum(['branch', 'tags']),
  release_detection_key: z.string(),
  is_active: z
    .literal('on')
    .optional()
    .transform((val) => (val === 'on' ? 1 : 0)),
})

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return json(submission.reply())
  }

  try {
    await updateCompany(companyId, submission.value)
  } catch (e) {
    return json(submission.reply({ formErrors: ['Failed to update company'] }))
  }

  return redirectWithSuccess(
    $path('/admin/:companyId/settings', { companyId }),
    {
      message: 'Company updated successfully',
    },
  )
}

export const CompanySettings = ({
  company,
}: {
  company: Selectable<DB.Company>
}) => {
  const [form, fields] = useForm({
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
    defaultValue: company,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company</CardTitle>
      </CardHeader>
      <CardContent>
        <Form
          method="POST"
          action={$path('/admin/:companyId/settings/company', {
            companyId: company.id,
          })}
          {...getFormProps(form)}
        >
          <Stack>
            <fieldset>
              <Label htmlFor={fields.name.id}>Company Name</Label>
              <Input {...getInputProps(fields.name, { type: 'text' })} />
              <div className="text-destructive">{fields.name.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={fields.release_detection_method.id}>
                Release Detection Method
              </Label>
              <Select
                name={fields.release_detection_method.name}
                defaultValue={fields.release_detection_method.initialValue}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a method" />
                </SelectTrigger>
                <SelectContent
                  {...getSelectProps(fields.release_detection_method)}
                >
                  <SelectGroup>
                    <SelectItem value="branch">Branch</SelectItem>
                    <SelectItem value="tags">Tags</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="text-destructive">
                {fields.release_detection_method.errors}
              </div>
            </fieldset>

            <fieldset>
              <Label htmlFor={fields.release_detection_key.id}>
                Release Detection Key
              </Label>
              <Input
                {...getInputProps(fields.release_detection_key, {
                  type: 'text',
                })}
              />
              <div className="text-destructive">
                {fields.release_detection_key.errors}
              </div>
            </fieldset>

            <fieldset>
              <HStack>
                <Label htmlFor={fields.is_active.id}>Active</Label>
                <Switch
                  name={fields.is_active.name}
                  id={fields.is_active.id}
                  defaultChecked={fields.is_active.initialValue === '1'}
                />
              </HStack>
              <div className="text-destructive">{fields.is_active.errors}</div>
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
