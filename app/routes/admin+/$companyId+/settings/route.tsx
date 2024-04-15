import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
} from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
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
import { getCompany, updateCompany } from '~/app/models/admin/company.server'

export const handle = { breadcrumb: () => ({ label: 'Config' }) }

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('No company', { status: 404 })
  }
  return { companyId, company }
}

const schema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  releaseDetectionMethod: z.enum(['branch', 'tags']),
  releaseDetectionKey: z.string().nonempty(),
  isActive: z
    .string()
    .optional()
    .transform((val) => !!val),
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
    return json(
      submission.reply({
        formErrors: ['Failed to update company'],
      }),
    )
  }

  return redirect(`/admin/${companyId}`)
}

const EditCompany = () => {
  const { companyId, company } = useLoaderData<typeof loader>()

  const [
    form,
    { isActive, name, releaseDetectionKey, releaseDetectionMethod },
  ] = useForm({
    id: 'edit-company-form',
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
    defaultValue: company,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...getFormProps(form)}>
          <Stack>
            <fieldset>
              <Label htmlFor={name.id}>Company Name</Label>
              <Input {...getInputProps(name, { type: 'text' })} />
              <div className="text-destructive">{name.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={releaseDetectionMethod.id}>
                Release Detection Method
              </Label>
              <Select
                name={releaseDetectionMethod.name}
                defaultValue={releaseDetectionMethod.initialValue}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a method" />
                </SelectTrigger>
                <SelectContent {...getSelectProps(releaseDetectionMethod)}>
                  <SelectGroup>
                    <SelectItem value="branch">Branch</SelectItem>
                    <SelectItem value="tags">Tags</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="text-destructive">
                {releaseDetectionMethod.errors}
              </div>
            </fieldset>

            <fieldset>
              <Label htmlFor={releaseDetectionKey.id}>
                Release Detection Key
              </Label>
              <Input
                {...getInputProps(releaseDetectionKey, { type: 'text' })}
              />
              <div className="text-destructive">
                {releaseDetectionKey.errors}
              </div>
            </fieldset>

            <fieldset>
              <HStack>
                <Label htmlFor={isActive.id}>Active</Label>
                <Switch
                  name={isActive.name}
                  id={isActive.id}
                  defaultChecked={!!isActive.initialValue}
                />
              </HStack>
              <div className="text-destructive">{isActive.errors}</div>
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

          <Button variant="ghost" asChild>
            <Link to={`/admin/${companyId}`}>Cancel</Link>
          </Button>
        </Stack>
      </CardFooter>
    </Card>
  )
}
export default EditCompany
