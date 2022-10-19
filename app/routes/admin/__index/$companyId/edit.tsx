import { Button, Stack } from '@chakra-ui/react'
import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { withZod } from '@remix-validated-form/with-zod'
import { zfd } from 'zod-form-data'
import { ValidatedForm, validationError } from 'remix-validated-form'
import invariant from 'tiny-invariant'
import { z } from 'zod'
import { AppInput, AppLink, AppMutationModal, AppSelect, AppSubmitButton, AppSwitch } from '~/app/components'
import { getCompany, updateCompany } from '~/app/models/admin/company.server'

export const loader = async ({ params }: LoaderArgs) => {
  invariant(params.companyId, 'companyId shout specified')
  const company = await getCompany(params.companyId)
  if (!company) {
    throw new Response('No company', { status: 404 })
  }
  return company
}

export const validator = withZod(
  z.object({
    name: z.string().min(1, { message: 'name is required' }),
    releaseDetectionMethod: z.string().min(1, { message: 'releaseDetectionMethod is required' }),
    releaseDetectionKey: z.string().min(1, { message: 'releaseDetectionKey is required' }),
    isActive: zfd.checkbox()
  })
)

export const action = async ({ request, params }: ActionArgs) => {
  const { companyId } = params
  invariant(companyId, 'companyId should specified')
  const { error, data } = await validator.validate(await request.formData())
  if (error) {
    return validationError(error)
  }
  const company = await updateCompany(companyId, data)
  return redirect(`/admin/${company.id}`)
}

const EditCompany = () => {
  const company = useLoaderData<typeof loader>()

  return (
    <AppMutationModal
      title="Edit company"
      footer={
        <Stack direction="row" justify="center">
          <AppSubmitButton colorScheme="blue" type="submit" form="form">
            Update
          </AppSubmitButton>

          <AppLink to="..">
            <Button variant="ghost">Cancel</Button>
          </AppLink>
        </Stack>
      }
    >
      <ValidatedForm validator={validator} method="post" id="form" defaultValues={company}>
        <Stack>
          <AppInput name="name" label="Company Name" />

          <AppSelect name="releaseDetectionMethod" label="Release Detection Method">
            <option value="tags">tags</option>
            <option value="branch">branch</option>
          </AppSelect>

          <AppInput name="releaseDetectionKey" label="Release Detection Key" />

          <AppSwitch name="isActive" label="Active" value="on" />
        </Stack>
      </ValidatedForm>
    </AppMutationModal>
  )
}
export default EditCompany
