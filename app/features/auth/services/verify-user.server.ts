import acceptLanguage from 'accept-language'
import { nanoid } from 'nanoid'
import type { StrategyVerifyCallback } from 'remix-auth'
import type { OAuth2StrategyVerifyParams } from 'remix-auth-oauth2'
import invariant from 'tiny-invariant'
import { db, sql, type DB, type Selectable } from '~/app/services/db.server'
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
        displayName: profile.displayName,
        pictureUrl: profile.photos?.[0].value,
        locale:
          profile._json.locale ??
          acceptLanguage.get(request.headers.get('accept-language')) ??
          'en',
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .onConflict((oc) =>
        oc.column('email').doUpdateSet((eb) => ({
          displayName: eb.ref('excluded.displayName'),
          pictureUrl: eb.ref('excluded.pictureUrl'),
          locale: eb.ref('excluded.locale'),
          updatedAt: eb.ref('excluded.updatedAt'),
        })),
      )
      .returningAll()
      .executeTakeFirstOrThrow()
  } catch (error) {
    if (error instanceof Error) {
      errorMessages.push(error.message)
    } else {
      errorMessages.push('不明なエラー:', String(error))
    }
    console.log('Login error:', errorMessages.join('\n'))
    throw new Error(errorMessages.join('\n'))
  }

  return user
}
