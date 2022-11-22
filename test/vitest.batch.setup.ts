import { vi } from 'vitest'

vi.mock('~/app/utils/db.servert', () => ({
  prisma: vPrisma.client,
}))
