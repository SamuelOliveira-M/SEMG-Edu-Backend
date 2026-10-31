import { config } from 'dotenv'
import path from 'path'

/**
 * Carrega o .env.test e recusa rodar se o banco não for claramente um banco de teste local.
 * Usado pelo vitest.config.ts (antes de qualquer worker subir), então nenhum teste
 * consegue importar src/lib/prisma apontando para dev/produção.
 */
export function loadTestEnv() {
  process.env.NODE_ENV = 'test'

  config({ path: path.resolve(__dirname, '../../.env.test'), override: true })

  const url = process.env.DIRECT_URL
  if (!url) {
    throw new Error('DIRECT_URL ausente. Copie .env.test.example para .env.test.')
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('DIRECT_URL do .env.test não é uma URL válida.')
  }

  const dbName = parsed.pathname.replace('/', '')
  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname)

  if (!isLocal || !dbName.includes('test')) {
    throw new Error(
      `Recusando rodar testes: DIRECT_URL deve apontar para um banco LOCAL cujo nome contenha "test" ` +
      `(host=${parsed.hostname}, db=${dbName}).`
    )
  }

  // O app/prisma só usam DIRECT_URL, mas mantemos as duas iguais por segurança.
  process.env.DATABASE_URL = url
}
