import type { GoogleExtraParams, GoogleProfile } from 'remix-auth-google'

const SocialProvider = {
  GOOGLE: 'google',
} as const

export type SupportedSocialProvider = 'google'
const supportedSocialProviders = [SocialProvider.GOOGLE] as const
export const isSupportedSocialProvider = (
  provider: unknown,
): provider is SupportedSocialProvider =>
  typeof provider === 'string' &&
  supportedSocialProviders.includes(provider as SupportedSocialProvider)
export type SupportedSocialProviderProfile = GoogleProfile
export type SupportedSocialProviderExtraParams = GoogleExtraParams
