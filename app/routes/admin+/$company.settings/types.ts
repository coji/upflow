import { z } from 'zod'

export const companySettingsSchema = z.object({
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

export const deleteCompanySchema = z.object({
  companyId: z.string(),
  confirm: z.string().regex(/delete this company/, {
    message: 'type "delete this company" to confirm',
  }),
})

export enum INTENTS {
  companySettings = 'company-settings',
  integrationSettings = 'integration-settings',
  exportSettings = 'export-settings',
  deleteCompany = 'delete-company',
}

export const intentsSchema = z.nativeEnum(INTENTS)
