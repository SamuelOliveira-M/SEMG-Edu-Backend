// Garante a extensão unaccent (usada por GET /studantee/:classId e não criada por nenhuma migration).
import { Client } from 'pg'

async function main() {
  const c = new Client({ connectionString: process.env.DIRECT_URL })
  await c.connect()
  await c.query('CREATE EXTENSION IF NOT EXISTS unaccent')
  await c.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
