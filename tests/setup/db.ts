import { Prisma } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'

const tables = Prisma.dmmf.datamodel.models.map((m) => `"${m.dbName ?? m.name}"`)

/** Última barreira antes de apagar dados: só opera em banco local cujo nome contenha "test". */
function assertSafeTestDatabase() {
  const url = new URL(process.env.DIRECT_URL ?? 'invalid://')
  const dbName = url.pathname.replace('/', '')
  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)

  if (process.env.NODE_ENV !== 'test' || !isLocal || !dbName.includes('test')) {
    throw new Error(`resetDb recusado: ${url.hostname}/${dbName} não é um banco de teste local.`)
  }
}

/** Esvazia todas as tabelas do banco de teste. */
export async function resetDb() {
  assertSafeTestDatabase()
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`)
}

export { prisma }
