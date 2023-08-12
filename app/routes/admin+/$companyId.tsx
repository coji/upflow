import { json, type LoaderArgs } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { getCompany } from '~/app/models/admin/company.server'

export const handle = {
  breadcrumb: ({ company }: { company: NonNullable<Awaited<ReturnType<typeof getCompany>>> }) => {
    return {
      label: company.name,
      to: `/admin/${company.id}`,
    }
  },
}

export const loader = async ({ params }: LoaderArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return json({ company })
}

export default function CompanyLayout() {
  return <Outlet />
}
