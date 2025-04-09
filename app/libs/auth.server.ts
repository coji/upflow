import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins/admin'
import { organization } from 'better-auth/plugins/organization'
import { nanoid } from 'nanoid'
import { href, redirect } from 'react-router'
import { dialect } from '~/app/services/db.server'

export const auth = betterAuth({
  baseURL: process.env.BASE_URL,
  secret: process.env.SESSION_SECRET,
  database: { dialect, type: 'sqlite' },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
  advanced: {
    generateId: () => nanoid(),
  },
  user: {
    modelName: 'users',
    fields: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      displayName: 'display_name',
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
      userId: 'user_id',
    },
  },
  verification: {
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
      schema: {
        session: {
          fields: {
            activeOrganizationId: 'active_organization_id',
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
