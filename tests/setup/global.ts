import { execSync } from 'child_process'
import { Client } from 'pg'

// Aplica as migrations no banco de teste (a validação de segurança já ocorreu em vitest.config.ts).
export default async function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env },
  })

  // GET /studantee/:classId usa unaccent(), mas nenhuma migration cria a extensão
  // (ver teste "as migrations deveriam criar a extensão unaccent"). O banco real a tem,
  // então o banco de teste também precisa dela para a rota ser testável.
  const client = new Client({ connectionString: process.env.DIRECT_URL })
  await client.connect()
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS unaccent')
  } finally {
    await client.end()
  }
}
