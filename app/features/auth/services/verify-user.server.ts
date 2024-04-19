import { Prisma } from '@prisma/client'
import type { StrategyVerifyCallback } from 'remix-auth'
import type { OAuth2StrategyVerifyParams } from 'remix-auth-oauth2'
import invariant from 'tiny-invariant'
import {
  getUserByEmail,
  upsertUserByEmail,
  type User,
} from '~/app/models/user.server'
import type { SessionUser } from '../types/types'
import {
  isSupportedSocialProvider,
  type SupportedSocialProviderExtraParams,
  type SupportedSocialProviderProfile,
} from './supported-social-provider.server'

export const verifyUser: StrategyVerifyCallback<
  SessionUser,
  OAuth2StrategyVerifyParams<
    SupportedSocialProviderProfile,
    SupportedSocialProviderExtraParams
  >
> = async ({ profile }) => {
  invariant(
    isSupportedSocialProvider(profile.provider),
    'provider not supported',
  )
  invariant(profile.emails?.[0].value, 'profile.email is required')
  const email = profile.emails[0].value

  const errorMessages = []
  let user: Omit<User, 'createdAt' | 'updatedAt'> | null = null

  try {
    user = await getUserByEmail({ email })

    // ユーザを登録 / upsert
    user = await upsertUserByEmail({
      email,
      displayName: profile.displayName,
      pictureUrl: profile.photos?.[0].value,
      locale: profile._json.locale ?? 'ja',
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        errorMessages.push(`すでに登録されているメールアドレスです: ${email}`)
      } else {
        errorMessages.push(`${error.code}`)
      }
    } else if (error instanceof Error) {
      errorMessages.push(error.message)
    } else {
      errorMessages.push('不明なエラー:', String(error))
    }
    console.log('Login error:', errorMessages.join('\n'))
    throw new Error(errorMessages.join('\n'))
  }

  return user
}
