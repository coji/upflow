import { Prisma } from '@prisma/client'
import acceptLanguage from 'accept-language'
import { nanoid } from 'nanoid'
import type { StrategyVerifyCallback } from 'remix-auth'
import type { OAuth2StrategyVerifyParams } from 'remix-auth-oauth2'
import invariant from 'tiny-invariant'
import { db, type DB, type Selectable } from '~/app/services/db.server'
import type { SessionUser } from '../types/types'
import {
  isSupportedSocialProvider,
  type SupportedSocialProviderExtraParams,
  type SupportedSocialProviderProfile,
} from './supported-social-provider.server'

acceptLanguage.languages(['ja', 'en'])

export const verifyUser: StrategyVerifyCallback<
  SessionUser,
  OAuth2StrategyVerifyParams<
    SupportedSocialProviderProfile,
    SupportedSocialProviderExtraParams
  >
> = async ({ request, profile }) => {
  invariant(
    isSupportedSocialProvider(profile.provider),
    'provider not supported',
  )
  invariant(profile.emails?.[0].value, 'profile.email is required')
  const email = profile.emails[0].value

  const errorMessages = []
  let user: Selectable<DB.User> | null = null

  try {
    // ユーザを登録 / upsert
    user = await db
      .insertInto('users')
      .values({
        id: nanoid(),
        email,
        display_name: profile.displayName,
        picture_url: profile.photos?.[0].value,
        locale:
          profile._json.locale ??
          acceptLanguage.get(request.headers.get('accept-language')) ??
          'en',
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .onConflict((oc) =>
        oc.column('email').doUpdateSet({
          display_name: profile.displayName,
          picture_url: profile.photos?.[0].value,
          locale: profile._json.locale,
          updated_at: new Date().toISOString(),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow()
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

  return {
    displayName: user.display_name,
    email: user.email,
    id: user.id,
    locale: user.locale,
    pictureUrl: user.picture_url,
    role: user.role,
  } satisfies SessionUser
}
