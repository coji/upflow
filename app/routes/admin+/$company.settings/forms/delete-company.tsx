import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { Form, Link, useActionData } from '@remix-run/react'
import { $path } from 'remix-routes'
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
  Stack,
} from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import type { DB, Selectable } from '~/app/services/db.server'
import { INTENTS, deleteCompanySchema as schema } from '../types'
import type { action } from './delete-company.action.server'

interface DeleteCompanyProps {
  company: Selectable<DB.Company>
}
export const DeleteCompany = ({ company }: DeleteCompanyProps) => {
  const actionData = useActionData<typeof action>()
  const [form, { confirm }] = useForm({
    lastResult:
      (actionData?.intent === INTENTS.deleteCompany && actionData.lastResult) ||
      undefined,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
    shouldValidate: 'onInput',
  })

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
            <div>
              {' '}
              {dayjs
                .utc(company.updatedAt)
                .tz('asia/tokyo')
                .format('YYYY-MM-DD HH:mm:ss')}
            </div>

            <Label>Created At</Label>
            <div>
              {' '}
              {dayjs
                .utc(company.createdAt)
                .tz('asia/tokyo')
                .format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>

          <Form method="POST" {...getFormProps(form)}>
            <input type="hidden" name="companyId" value={company.id} />
            <Input
              {...getInputProps(confirm, { type: 'text' })}
              placeholder="type 'delete this company' here"
            />
            <div id={confirm.errorId} className="text-sm text-destructive">
              {confirm.errors}
            </div>
          </Form>
        </Stack>
      </CardContent>
      <CardFooter>
        <HStack>
          <Button
            type="submit"
            disabled={!form.valid}
            variant="destructive"
            form={form.id}
            name="intent"
            value={INTENTS.deleteCompany}
          >
            DELETE
          </Button>

          <Button asChild variant="ghost">
            <Link
              to={$path('/admin/:company/settings', {
                company: company.id,
              })}
            >
              Cancel
            </Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
