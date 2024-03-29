import type { User } from '@prisma/client'
import { prisma } from '~/app/services/db.server'
export type { User } from '@prisma/client'

export async function getUserById(id: User['id']) {
  return await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      displayName: true,
      pictureUrl: true,
      locale: true,
      role: true,
    },
  })
}

export async function getUserByEmail({ email }: { email: User['email'] }) {
  return await prisma.user.findUniqueOrThrow({ where: { email } })
}

export async function upsertUserByEmail({
  email,
  displayName,
  pictureUrl,
  locale,
}: {
  email: User['email']
  displayName: User['displayName']
  pictureUrl: User['pictureUrl']
  locale: User['locale']
}) {
  return await prisma.user.upsert({
    where: { email },
    select: {
      id: true,
      email: true,
      displayName: true,
      pictureUrl: true,
      locale: true,
      role: true,
    },
    create: { email, displayName, pictureUrl, locale },
    update: { displayName, pictureUrl, locale },
  })
}

export async function deleteUserByEmail(email: User['email']) {
  return await prisma.user.delete({ where: { email } })
}
