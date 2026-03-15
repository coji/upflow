import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins/admin'
import { organization } from 'better-auth/plugins/organization'
import { nanoid } from 'nanoid'
import { href, redirect } from 'react-router'
import { db, dialect } from '~/app/services/db.server'
import { linkGithubUserToCompanyUsers } from '~/app/services/github-linking.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

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
        const res = await fetch('https://api.github.com/user', {
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

        // First-user bootstrap: if no users exist yet, allow login unconditionally
        const userCount = await db
          .selectFrom('users')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .executeTakeFirstOrThrow()
        const isFirstUser = Number(userCount.count) === 0

        if (!isFirstUser) {
          // Check if this GitHub login is registered in any org's companyGithubUsers
          const orgs = await db
            .selectFrom('organizations')
            .select(['id'])
            .execute()
          let isAllowed = false
          let isRegisteredButInactive = false
          const loginLower = profile.login.toLowerCase()
          for (const { id } of orgs) {
            try {
              const tenantDb = getTenantDb(id as OrganizationId)
              const match = await tenantDb
                .selectFrom('companyGithubUsers')
                .select(['login', 'isActive'])
                .where((eb) => eb(eb.fn('lower', ['login']), '=', loginLower))
                .executeTakeFirst()
              if (match) {
                if (match.isActive) {
                  isAllowed = true
                  break
                }
                isRegisteredButInactive = true
              }
            } catch {
              // skip unreachable tenant DBs
            }
          }
          if (!isAllowed) {
            if (isRegisteredButInactive) {
              console.warn(
                `[GitHub OAuth] Login denied: ${profile.login} is registered but inactive`,
              )
            } else {
              console.warn(
                `[GitHub OAuth] Login denied: ${profile.login} not found in any org`,
              )
            }
            return null
          }
        }

        const emailsRes = await fetch('https://api.github.com/user/emails', {
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
    accountLinking: {
      trustedProviders: ['github'],
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
          // First-user bootstrap: promote to super admin atomically.
          // The WHERE ensures only one user can be promoted even under
          // concurrent requests (no existing admin → UPDATE matches).
          const result = await db
            .updateTable('users')
            .set({ role: 'admin' })
            .where('id', '=', user.id)
            .where(({ not, exists, selectFrom }) =>
              not(
                exists(
                  selectFrom('users').select('id').where('role', '=', 'admin'),
                ),
              ),
            )
            .executeTakeFirst()
          if (result.numUpdatedRows > 0n) {
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

import { RESERVED_SLUGS } from './reserved-slugs'

export const isReservedSlug = (slug: string): boolean => {
  return RESERVED_SLUGS.has(slug.toLowerCase())
}

export interface OrgContext {
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>['user']
  organization: { id: OrganizationId; name: string; slug: string }
  membership: { id: string; role: string }
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

export const requireOrgAdmin = async (
  request: Request,
  orgSlug: string,
): Promise<OrgContext> => {
  const context = await requireOrgMember(request, orgSlug)
  if (
    context.membership.role !== 'owner' &&
    context.membership.role !== 'admin'
  ) {
    throw redirect(`/${orgSlug}`)
  }
  return context
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
