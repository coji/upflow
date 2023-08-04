import type { User } from '@prisma/client'

export interface SessionUser {
  id: User['id']
  email: User['email']
  displayName: User['displayName']
  pictureUrl: User['pictureUrl']
  locale: User['locale']
  role: User['role']
}
