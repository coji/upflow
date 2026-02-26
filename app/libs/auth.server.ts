import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins/admin'
import { organization } from 'better-auth/plugins/organization'
import { nanoid } from 'nanoid'
import { href, redirect } from 'react-router'
import { db, dialect } from '~/app/services/db.server'
import type { OrganizationId } from '~/app/services/tenant-db.server'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.SESSION_SECRET,
  database: { dialect: dialect, type: 'sqlite' },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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

export const requireUser = async (request: Request) => {
  const session = await getSession(request)
  if (!session) {
    throw redirect(href('/login'))
  }
  return session
}

export const requireSuperAdmin = async (request: Request) => {
  const session = await getSession(request)
  if (!session) {
    throw redirect(href('/login'))
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
    throw redirect(href('/login'))
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
    throw redirect('/no-org')
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
