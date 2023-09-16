import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
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
  const submission = await parse(await request.formData(), { schema })
  if (!submission.value) {
    throw new Error('Invalid submission')
  }
  const company = await updateCompany(companyId, submission.value)
  return redirect(`/admin/${company.id}`)
}

const EditCompany = () => {
  const { companyId, company } = useLoaderData<typeof loader>()

  const [form, { isActive, name, releaseDetectionKey, releaseDetectionMethod }] = useForm({
    id: 'edit-company-form',
    onValidate({ formData }) {
      return parse(formData, { schema })
    },
    defaultValue: company,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Config</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...form.props}>
          <Stack>
            <fieldset>
              <Label htmlFor={name.id}>Company Name</Label>
              <Input {...conform.input(name)} />
              <div className="text-destructive">{name.error}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={releaseDetectionMethod.id}>Release Detection Method</Label>
              <Select name={releaseDetectionMethod.name} defaultValue={releaseDetectionMethod.defaultValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a method"></SelectValue>
                </SelectTrigger>
                <SelectContent {...conform.select(releaseDetectionMethod)}>
                  <SelectGroup>
                    <SelectItem value="branch">Branch</SelectItem>
                    <SelectItem value="tags">Tags</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="text-destructive">{releaseDetectionMethod.error}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={releaseDetectionKey.id}>Release Detection Key</Label>
              <Input {...conform.input(releaseDetectionKey)} />
              <div className="text-destructive">{releaseDetectionKey.error}</div>
            </fieldset>

            <fieldset>
              <HStack>
                <Label htmlFor={isActive.id}>Active</Label>
                <Switch name={isActive.name} id={isActive.id} defaultChecked={!!isActive.defaultValue}></Switch>
              </HStack>
              <div className="text-destructive">{isActive.error}</div>
            </fieldset>
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
