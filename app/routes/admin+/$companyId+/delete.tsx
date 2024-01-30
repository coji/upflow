import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Stack,
} from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import { deleteCompany, getCompany } from '~/app/models/admin/company.server'

export const handle = { breadcrumb: () => ({ label: 'Delete Company' }) }

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Error('Company not found')
  }
  return { companyId, company }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  await deleteCompany(companyId)
  return redirect('/admin')
}

const CompanyDeletePage = () => {
  const { companyId, company } = useLoaderData<typeof loader>()
  const [isEnabled, setIsEnabled] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete Company</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack>
          <div className="grid grid-cols-[auto_1fr] items-baseline gap-2 gap-y-4">
            <Label>ID</Label>
            <div> {company.id}</div>

            <Label>Name</Label>
            <div> {company.name}</div>

            <Label>Updated At</Label>
            <div> {dayjs(company.updatedAt).fromNow()}</div>

            <Label>Created At</Label>
            <div> {dayjs(company.createdAt).fromNow()}</div>
          </div>

          <Form method="POST" id="conform-form">
            <Input
              id="confirm"
              onChange={(event) => {
                setIsEnabled(event.target.value === 'delete this company')
              }}
              placeholder="type 'delete this company' here"
            />
          </Form>
        </Stack>
      </CardContent>
      <CardFooter>
        <Stack direction="row">
          <Button
            type="submit"
            disabled={!isEnabled}
            form="conform-form"
            variant="destructive"
          >
            DELETE
          </Button>

          <Button asChild variant="ghost">
            <Link to={`/admin/${companyId}`}>Cancel</Link>
          </Button>
        </Stack>
      </CardFooter>
    </Card>
  )
}
CompanyDeletePage.displayName = 'CompanyDeletePage'
export default CompanyDeletePage
