import { z } from 'zod'

export const organizationSettingsSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  releaseDetectionMethod: z.enum(['branch', 'tags']),
  releaseDetectionKey: z.string(),
  isActive: z
    .literal('on')
    .optional()
    .transform((val) => (val === 'on' ? 1 : 0)),
})

export const integrationSettingsSchema = z.object({
  id: z.string().optional(),
  provider: z.enum(['github'], { required_error: 'provider is required' }),
  method: z.enum(['token'], { required_error: 'method is required' }),
  privateToken: z.string().min(1, { message: 'private token is required' }),
})

export const exportSettingsSchema = z.object({
  id: z.string().optional(),
  sheetId: z.string(),
  clientEmail: z.string().email(),
  privateKey: z.string(),
})

export const deleteOrganizationSchema = z.object({
  organizationId: z.string(),
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

export const intentsSchema = z.nativeEnum(INTENTS)
