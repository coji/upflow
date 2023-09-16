import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { RiGithubFill, RiGitlabFill } from 'react-icons/ri'
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
  Label,
  RadioGroup,
  RadioGroupItem,
  Stack,
  Textarea,
} from '~/app/components/ui'
import { createIntegration } from '~/app/models/admin/integration.server'

export const handle = { breadcrumb: () => ({ label: 'Add Integration' }) }

const schema = z.object({
  provider: z.enum(['github', 'gitlab'], { required_error: 'provider is required' }),
  method: z.enum(['token'], { required_error: 'token is required' }),
  token: z.string().min(1, { message: 'token is required' }),
})

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  return { companyId }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = await parse(await request.formData(), { schema })
  if (!submission.value) {
    throw new Error('Failed to parse form data')
  }
  await createIntegration({
    companyId,
    provider: submission.value.provider,
    method: submission.value.method,
    privateToken: submission.value.token,
  })
  return redirect(`/admin/${companyId}`)
}

const AddIntegrationPage = () => {
  const { companyId } = useLoaderData<typeof loader>()
  const [form, { provider, method, token }] = useForm({
    id: 'add-integration-form',
    onValidate({ form, formData }) {
      return parse(formData, { schema })
    },
    defaultValue: {
      provider: 'github',
      method: 'token',
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add integration</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...form.props}>
          <Stack>
            <fieldset>
              <Label htmlFor={provider.id}>Provider</Label>
              <RadioGroup {...conform.input(provider)}>
                <HStack>
                  <RadioGroupItem id="github" value="github"></RadioGroupItem>
                  <Label htmlFor="github">
                    <HStack className="gap-1 text-github">
                      <RiGithubFill />
                      <span>GitHub</span>
                    </HStack>
                  </Label>
                </HStack>
                <HStack>
                  <RadioGroupItem id="gitlab" value="gitlab"></RadioGroupItem>
                  <Label htmlFor="gitlab">
                    <HStack className="gap-1 text-gitlab">
                      <RiGitlabFill />
                      <span>GitLab</span>
                    </HStack>
                  </Label>
                </HStack>
              </RadioGroup>
              <div className="text-destructive">{provider.error}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={method.id}>Method</Label>
              <RadioGroup {...conform.input(method)}>
                <HStack>
                  <RadioGroupItem id="token" value="token"></RadioGroupItem>
                  <Label htmlFor="token">トークン</Label>
                </HStack>
              </RadioGroup>
              <div className="text-destructive">{method.error}</div>
            </fieldset>

            <fieldset>
              <Label htmlFor={token.id}>Token</Label>
              <Textarea {...conform.textarea(token)}></Textarea>
              <div className="text-destructive">{token.error}</div>
            </fieldset>
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
