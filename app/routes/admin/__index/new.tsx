import type { ActionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { withZod } from '@remix-validated-form/with-zod'
import { ValidatedForm, validationError } from 'remix-validated-form'
import { z } from 'zod'
import { AppInput } from '~/app/components/AppInput'
import { AppMutationModal } from '~/app/components/AppMutationModal'
import { AppSubmitButton } from '~/app/components/AppSubmitButton'
import { createCompany } from '~/app/models/admin/company.server'

export const validator = withZod(
  z.object({
    name: z.string().min(1, { message: 'Company name is required' })
  })
)

export const action = async ({ request }: ActionArgs) => {
  const result = await validator.validate(await request.formData())
  if (result.error) {
    return validationError(result.error)
  }
  const company = await createCompany(result.data.name)
  if (!company) {
    return null
  }
  return redirect(`/admin/${company.id}`)
}

const CompanyNewPage = () => {
  return (
    <AppMutationModal title="Create a company" footer={<AppSubmitButton formId="company-new-form" />}>
      <ValidatedForm method="post" validator={validator} noValidate autoComplete="false" id="company-new-form">
        <AppInput name="name" label="Name" autoFocus />
      </ValidatedForm>
    </AppMutationModal>
  )
}
export default CompanyNewPage
