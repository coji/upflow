import { z } from 'zod'

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'))

export const organizationSettingsSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }).max(100),
  releaseDetectionMethod: z.enum(['branch', 'tags']),
  releaseDetectionKey: z.string().max(255),
  isActive: z
    .literal('on')
    .optional()
    .transform((val) => (val === 'on' ? 1 : 0)),
  excludedUsers: z.string().max(2000).default(''),
  timezone: z.string().refine((v) => VALID_TIMEZONES.has(v), {
    message: 'Invalid timezone',
  }),
})

export const integrationSettingsSchema = z.object({
  provider: z.enum(['github']),
  method: z.enum(['token']),
  privateToken: z.string().max(500).optional().default(''),
})

export const exportSettingsSchema = z.object({
  sheetId: z.string().max(255),
  clientEmail: z.email().max(255),
  privateKey: z.string().max(10000),
})

export const deleteOrganizationSchema = z.object({
  organizationId: z.string().max(100),
  confirm: z.string().regex(/delete this organization/, {
    message: 'type "delete this organization" to confirm',
  }),
})

export enum INTENTS {
  organizationSettings = 'organization-settings',
  integrationSettings = 'integration-settings',
  exportSettings = 'export-settings',
  deleteOrganization = 'delete-organization',
}

export const intentsSchema = z.enum(INTENTS)
