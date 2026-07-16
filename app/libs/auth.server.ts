import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins/admin'
import { organization } from 'better-auth/plugins/organization'
import { nanoid } from 'nanoid'
import { href, redirect } from 'react-router'
import { githubApiUrl } from '~/app/libs/github-api.server'
import { getGithubHandoffState } from '~/app/libs/github-handoff-auth.server'
import { canAdmitGithubLogin } from '~/app/libs/github-login-admission'
import { db, dialect } from '~/app/services/db.server'
import { claimInitialSuperAdmin } from '~/app/services/bootstrap-admin.server'
import { linkGithubUserToCompanyUsers } from '~/app/services/github-linking.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { isOrgOwner, type MemberRole } from './member-role'
import { RESERVED_SLUGS } from './reserved-slugs'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: { dialect: dialect, type: 'sqlite' },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      getUserInfo: async (token) => {
        if (!token.accessToken) {
          console.error('[GitHub OAuth] No access token')
          return null
        }
        const res = await fetch(githubApiUrl('/user'), {
          headers: {
            'User-Agent': 'upflow',
            Authorization: `Bearer ${token.accessToken}`,
          },
          signal: AbortSignal.timeout(5_000),
        })
        if (!res.ok) {
          console.error(
            '[GitHub OAuth] /user failed:',
            res.status,
            await res.text(),
          )
          return null
        }
        const profile = (await res.json()) as {
          id: number
          login: string
          name: string | null
          email: string | null
          avatar_url: string
        }

        // Existing Upflow members must still have an active company GitHub-user
        // entry. A new account is admitted only while an owner has a live
        // delegated installation intent; organization routes remain
        // membership-protected after authentication.
        const orgs = await db.selectFrom('organizations').select('id').execute()
        const loginLower = profile.login.toLowerCase()
        let isAllowedMember = false
        for (const { id } of orgs) {
          try {
            const match = await getTenantDb(id as OrganizationId)
              .selectFrom('companyGithubUsers')
              .select('isActive')
              .where((eb) => eb(eb.fn('lower', ['login']), '=', loginLower))
              .executeTakeFirst()
            if (match?.isActive) {
              isAllowedMember = true
              break
            }
          } catch (error) {
            console.error(
              `[GitHub OAuth] Failed to inspect company GitHub users for organization ${id}`,
              error,
            )
            // Fail closed below for an existing member when a tenant DB cannot
            // be inspected. Unregistered delegates do not depend on tenant DBs.
          }
        }

        const emailsRes = await fetch(githubApiUrl('/user/emails'), {
          headers: {
            'User-Agent': 'upflow',
            Authorization: `Bearer ${token.accessToken}`,
          },
          signal: AbortSignal.timeout(5_000),
        })
        let emailVerified = false
        if (emailsRes.ok) {
          const emails = (await emailsRes.json()) as {
            email: string
            primary: boolean
            verified: boolean
          }[]
          if (!profile.email && emails.length > 0) {
            profile.email =
              (emails.find((e) => e.primary) ?? emails[0])?.email ?? null
          }
          emailVerified =
            emails.find((e) => e.email === profile.email)?.verified ?? false
        } else {
          console.warn(
            '[GitHub OAuth] /user/emails failed:',
            emailsRes.status,
            await emailsRes.text(),
          )
        }

        if (!isAllowedMember) {
          // During a user's first GitHub sign-in Better Auth has not inserted
          // the provider account yet. Check both an existing provider account
          // and the email that Better Auth may use for account linking.
          let existingUser = await db
            .selectFrom('accounts')
            .innerJoin('users', 'users.id', 'accounts.userId')
            .select(['users.id', 'users.role'])
            .where('accounts.providerId', '=', 'github')
            .where('accounts.accountId', '=', String(profile.id))
            .executeTakeFirst()
          if (!existingUser && profile.email && emailVerified) {
            const emailMatches = await db
              .selectFrom('users')
              .select(['users.id', 'users.role'])
              .where((eb) =>
                eb(
                  eb.fn('lower', ['users.email']),
                  '=',
                  profile.email!.toLowerCase(),
                ),
              )
              .limit(2)
              .execute()
            // SQLite's email uniqueness is case-sensitive, while GitHub email
            // identity is matched case-insensitively here. Refuse an ambiguous
            // legacy database instead of admitting whichever row scans first.
            if (emailMatches.length > 1) {
              console.warn(
                `[GitHub OAuth] Login denied: multiple users match verified email ${profile.email}`,
              )
              return null
            }
            existingUser = emailMatches[0]
          }
          const existingMembership = existingUser
            ? await db
                .selectFrom('members')
                .select('id')
                .where('userId', '=', existingUser.id)
                .executeTakeFirst()
            : undefined
          const [bootstrapMarker, anyUser] = await Promise.all([
            db
              .selectFrom('bootstrapMarkers')
              .select('key')
              .where('key', '=', 'initial_super_admin')
              .executeTakeFirst(),
            db.selectFrom('users').select('id').limit(1).executeTakeFirst(),
          ])
          const isFirstUser = !bootstrapMarker && !anyUser
          const restrictedExistingUser = Boolean(
            existingMembership || existingUser?.role === 'admin',
          )
          const handoffNonce = getGithubHandoffState()
          const pendingHandoff =
            handoffNonce && !restrictedExistingUser && !isFirstUser
              ? await db
                  .selectFrom('githubAppInstallStates')
                  .select('id')
                  .where('nonce', '=', handoffNonce)
                  .where('intentKind', '=', 'handoff')
                  .where((eb) =>
                    eb.or([
                      eb('claimedAt', 'is', null),
                      ...(existingUser
                        ? [eb('claimedByUserId', '=', existingUser.id)]
                        : []),
                    ]),
                  )
                  .where('consumedAt', 'is', null)
                  .where('expiresAt', '>', new Date().toISOString())
                  .executeTakeFirst()
              : undefined
          if (
            !canAdmitGithubLogin({
              activeCompanyUser: isAllowedMember,
              firstUser: isFirstUser,
              existingMembership: Boolean(existingMembership),
              existingSuperAdmin: existingUser?.role === 'admin',
              pendingHandoff: Boolean(pendingHandoff),
            })
          ) {
            console.warn(
              `[GitHub OAuth] Login denied: ${profile.login} could not be admitted by active GitHub-user or delegated-install authorization`,
            )
            return null
          }
        }

        return {
          user: {
            id: String(profile.id),
            name: profile.name || profile.login,
            email: profile.email,
            image: profile.avatar_url,
            emailVerified,
          },
          data: profile,
        }
      },
    },
  },
  advanced: {
    database: {
      generateId: () => nanoid(),
    },
  },
  user: {
    modelName: 'users',
    fields: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      emailVerified: 'email_verified',
    },
  },
  session: {
    modelName: 'sessions',
    fields: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      userId: 'user_id',
    },
    // Do not add GitHub to accountLinking.trustedProviders. Better Auth would
    // then implicitly link an unverified GitHub email to an existing Upflow
    // account, allowing an admitted delegate to take over that account.
  },
  account: {
    modelName: 'accounts',
    fields: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      accessToken: 'access_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      accountId: 'account_id',
      idToken: 'id_token',
      providerId: 'provider_id',
      refreshToken: 'refresh_token',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      userId: 'user_id',
    },
  },
  verification: {
    disableCleanup: true,
    modelName: 'verifications',
    fields: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      expiresAt: 'expires_at',
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Claim a permanent singleton marker atomically. This elects exactly
          // one first user under concurrent OAuth callbacks and never promotes
          // another user after the original admin is deleted or demoted.
          const promoted = await claimInitialSuperAdmin(db, user.id)
          if (promoted) {
            console.info(
              `[Bootstrap] First user ${user.id} promoted to super admin`,
            )
          }
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await linkGithubUserToCompanyUsers(session.userId).catch((error) => {
            console.warn('[GitHub linking] post-session linking failed', {
              userId: session.userId,
              error,
            })
          })
        },
      },
    },
  },
  plugins: [
    admin({
      schema: {
        session: {
          modelName: 'sessions',
          fields: {
            banExpires: 'ban_expires',
            banReason: 'ban_reason',
            impersonatedBy: 'impersonated_by',
          },
        },
        user: {
          modelName: 'users',
          fields: {
            banExpires: 'ban_expires',
            banReason: 'ban_reason',
            impersonatedBy: 'impersonated_by',
          },
        },
      },
    }),
    organization({
      teams: { enabled: true },
      allowUserToCreateOrganization: async (user) => {
        // Check if the user is a super admin
        const { role } = await db
          .selectFrom('users')
          .select(['role'])
          .where('id', '=', user.id)
          .executeTakeFirstOrThrow()
        return role === 'admin'
      },
      schema: {
        session: {
          fields: {
            activeOrganizationId: 'active_organization_id',
            activeTeamId: 'active_team_id',
          },
        },
        team: {
          modelName: 'teams',
          fields: {
            organizationId: 'organization_id',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
          },
        },
        teamMember: {
          modelName: 'team_members',
          fields: {
            teamId: 'team_id',
            userId: 'user_id',
            createdAt: 'created_at',
          },
        },
        organization: {
          modelName: 'organizations',
          fields: {
            organizationId: 'organization_id',
            userId: 'user_id',
            createdAt: 'created_at',
          },
        },
        member: {
          modelName: 'members',
          fields: {
            organizationId: 'organization_id',
            userId: 'user_id',
            createdAt: 'created_at',
          },
        },
        invitation: {
          modelName: 'invitations',
          fields: {
            organizationId: 'organization_id',
            expiresAt: 'expires_at',
            createdAt: 'created_at',
            inviterId: 'inviter_id',
            teamId: 'team_id',
          },
        },
      },
    }),
  ],
})

export const getSession = async (request: Request) => {
  return await auth.api.getSession(request)
}

export const safeRedirectTo = (
  redirectTo: string | null | undefined,
  fallback = '/',
): string => {
  if (
    redirectTo?.startsWith('/') &&
    !redirectTo.startsWith('//') &&
    !redirectTo.startsWith('/\\')
  ) {
    return redirectTo
  }
  return fallback
}

const loginRedirect = (request: Request): never => {
  const url = new URL(request.url)
  const redirectTo = url.pathname + url.search
  throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`)
}

export const requireUser = async (request: Request) => {
  const session = await getSession(request)
  if (!session) {
    throw loginRedirect(request)
  }
  return session
}

export const requireSuperAdmin = async (request: Request) => {
  const session = await getSession(request)
  if (!session) {
    throw loginRedirect(request)
  }
  if (session.user.role !== 'admin') {
    throw redirect(href('/'))
  }
  return session
}

// ── Organization membership helpers ──────────────────────────────

export const isReservedSlug = (slug: string): boolean => {
  return RESERVED_SLUGS.has(slug.toLowerCase())
}

export { isOrgAdmin, isOrgOwner } from './member-role'
export type { MemberRole } from './member-role'

export interface OrgContext {
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>['user']
  organization: { id: OrganizationId; name: string; slug: string }
  membership: { id: string; role: MemberRole }
}

export const requireOrgMember = async (
  request: Request,
  orgSlug: string,
): Promise<OrgContext> => {
  const session = await getSession(request)
  if (!session) {
    throw loginRedirect(request)
  }

  const result = await db
    .selectFrom('members')
    .innerJoin('organizations', 'organizations.id', 'members.organizationId')
    .select([
      'organizations.id as orgId',
      'organizations.name as orgName',
      'organizations.slug as orgSlug',
      'members.id as memberId',
      'members.role',
    ])
    .where('organizations.slug', '=', orgSlug)
    .where('members.userId', '=', session.user.id)
    .executeTakeFirst()

  if (!result) {
    const firstOrg = await getFirstOrganization(session.user.id)
    throw redirect(firstOrg ? `/${firstOrg.slug}` : '/no-org')
  }

  return {
    user: session.user,
    organization: {
      id: result.orgId as OrganizationId,
      name: result.orgName,
      slug: result.orgSlug,
    },
    membership: {
      id: result.memberId,
      role: result.role,
    },
  }
}

export const requireOrgOwner = (
  membership: { role: MemberRole },
  orgSlug: string,
): void => {
  if (!isOrgOwner(membership.role)) {
    throw redirect(href('/:orgSlug/settings/repositories', { orgSlug }))
  }
}

export const getUserOrganizations = async (userId: string) => {
  return await db
    .selectFrom('members')
    .innerJoin('organizations', 'organizations.id', 'members.organizationId')
    .select([
      'organizations.id',
      'organizations.name',
      'organizations.slug',
      'members.role',
    ])
    .where('members.userId', '=', userId)
    .orderBy('members.createdAt', 'asc')
    .execute()
}

export const getFirstOrganization = async (
  userId: string,
): Promise<{ id: string; slug: string } | null> => {
  const result = await db
    .selectFrom('members')
    .innerJoin('organizations', 'organizations.id', 'members.organizationId')
    .select(['organizations.id', 'organizations.slug'])
    .where('members.userId', '=', userId)
    .orderBy('members.createdAt', 'asc')
    .executeTakeFirst()
  return result ?? null
}
