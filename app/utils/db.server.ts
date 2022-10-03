import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

declare global {
  var __db__: PrismaClient
}

// this is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
// in production we'll have a single connection to the DB.
if (process.env.NODE_ENV === 'development') {
  if (!global.__db__) {
    const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })
    prisma.$on('query', async (e) => {
      console.log(`${e.query} ${e.params}`)
    })
    global.__db__ = prisma
  }
  prisma = global.__db__
  prisma.$connect()
} else {
  prisma = new PrismaClient()
}

export { prisma }