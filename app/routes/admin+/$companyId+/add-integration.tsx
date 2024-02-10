import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
} from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import Github from '~/app/components/icons/Github'
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
  Label,
  RadioGroup,
  RadioGroupItem,
  Stack,
  Textarea,
} from '~/app/components/ui'
import { createIntegration } from '~/app/models/admin/integration.server'

export const handle = { breadcrumb: () => ({ label: 'Add Integration' }) }

const schema = z.object({
  provider: z.enum(['github'], { required_error: 'provider is required' }),
  method: z.enum(['token'], { required_error: 'token is required' }),
  token: z.string().min(1, { message: 'token is required' }),
})

export const loader = ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  return { companyId }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return json(submission.reply())
  }

  try {
    await createIntegration({
      companyId,
      provider: submission.value.provider,
      method: submission.value.method,
      privateToken: submission.value.token,
    })
  } catch (e) {
    return submission.reply({
      formErrors: [`Integration creation failed: ${String(e)}`],
    })
  }

  return redirect(`/admin/${companyId}`)
}

const AddIntegrationPage = () => {
  const { companyId } = useLoaderData<typeof loader>()
  const lastResult = useActionData<typeof action>()
  const [form, { provider, method, token }] = useForm({
    id: 'add-integration-form',
    lastResult,
    defaultValue: {
      provider: 'github',
      method: 'token',
    },
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add integration</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...getFormProps(form)}>
          <Stack>
            <fieldset>
              <Label htmlFor={provider.id}>Provider</Label>
              <RadioGroup {...getInputProps(provider, { type: 'text' })}>
                <HStack>
                  <RadioGroupItem id="github" value="github" />
                  <Label htmlFor="github">
                    <HStack className="gap-1 text-github">
                      <Github />
                      <span>GitHub</span>
                    </HStack>
                  </Label>
                </HStack>
              </RadioGroup>
              <div className="text-destructive">{provider.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={method.id}>Method</Label>
              <RadioGroup {...getInputProps(method, { type: 'text' })}>
                <HStack>
                  <RadioGroupItem id="token" value="token" />
                  <Label htmlFor="token">トークン</Label>
                </HStack>
              </RadioGroup>
              <div className="text-destructive">{method.errors}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={token.id}>Token</Label>
              <Textarea {...getTextareaProps(token)} />
              <div className="text-destructive">{token.errors}</div>
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
            Add
          </Button>
          <Button asChild variant="ghost">
            <Link to={`/admin/${companyId}`}>Cancel</Link>
          </Button>
        </Stack>
      </CardFooter>
    </Card>
  )
}
AddIntegrationPage.displayName = 'AddIntegrationPage'
export default AddIntegrationPage
