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
import { getCompany, updateCompany } from './queries.server'

export const handle = { breadcrumb: () => ({ label: 'Config' }) }

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('No company', { status: 404 })
  }
  console.log({ company })

  return json({ companyId, company })
}

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
    { is_active, name, release_detection_key, release_detection_method },
  ] = useForm({
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
              <Label htmlFor={release_detection_method.id}>
                Release Detection Method
              </Label>
              <Select
                name={release_detection_method.name}
                defaultValue={release_detection_method.initialValue}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a method" />
                </SelectTrigger>
                <SelectContent {...getSelectProps(release_detection_method)}>
                  <SelectGroup>
                    <SelectItem value="branch">Branch</SelectItem>
                    <SelectItem value="tags">Tags</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="text-destructive">
                {release_detection_method.errors}
              </div>
            </fieldset>

            <fieldset>
              <Label htmlFor={release_detection_key.id}>
                Release Detection Key
              </Label>
              <Input
                {...getInputProps(release_detection_key, { type: 'text' })}
              />
              <div className="text-destructive">
                {release_detection_key.errors}
              </div>
            </fieldset>

            <fieldset>
              <HStack>
                <Label htmlFor={is_active.id}>Active</Label>
                <Switch
                  name={is_active.name}
                  id={is_active.id}
                  defaultChecked={is_active.initialValue === '1'}
                />
              </HStack>
              <div className="text-destructive">{is_active.errors}</div>
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
