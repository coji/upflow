import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
} from '@conform-to/react'
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
import { INTENTS, companySettingsSchema as schema } from '../types'
import type { action } from './company-settings.action.server'

export const CompanySettings = ({
  company,
}: {
  company: Selectable<DB.Company>
}) => {
  const actionData = useActionData<typeof action>()
  const [form, fields] = useForm({
    lastResult:
      (actionData?.intent === INTENTS.companySettings &&
        actionData?.lastResult) ||
      undefined,
    defaultValue: company,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...getFormProps(form)}>
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
          <Button
            type="submit"
            form={form.id}
            name="intent"
            value={INTENTS.companySettings}
          >
            Update
          </Button>
        </Stack>
      </CardFooter>
    </Card>
  )
}
