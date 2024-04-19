import { z } from 'zod'

export const companySettingsSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  release_detection_method: z.enum(['branch', 'tags']),
  release_detection_key: z.string(),
  is_active: z
    .literal('on')
    .optional()
    .transform((val) => (val === 'on' ? 1 : 0)),
})

export const integrationSettingsSchema = z.object({
  id: z.string().optional(),
  provider: z.enum(['github'], { required_error: 'provider is required' }),
  method: z.enum(['token'], { required_error: 'method is required' }),
  private_token: z.string().min(1, { message: 'private token is required' }),
})

export const exportSettingsSchema = z.object({
  id: z.string().optional(),
  sheet_id: z.string(),
  client_email: z.string().email(),
  private_key: z.string(),
})

export enum INTENTS {
  companySettings = 'company-settings',
  integrationSettings = 'integration-settings',
  exportSettings = 'export-settings',
}

export const intentsSchema = z.nativeEnum(INTENTS)
