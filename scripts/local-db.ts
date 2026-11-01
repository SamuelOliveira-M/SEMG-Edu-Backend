// Postgres local do projeto (embedded-postgres): sem Docker e sem instalador.
// Dados persistem em ./.pgdata. Uso: npm run db:up  (deixe o terminal aberto; Ctrl+C para parar)
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'fs'
import { join } from 'path'

const PORT = 5434
const DATA_DIR = join(process.cwd(), '.pgdata')
const DATABASES = ['semg_dev', 'semg_test']

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  })

  if (!existsSync(join(DATA_DIR, 'PG_VERSION'))) {
    console.log('Inicializando cluster em', DATA_DIR)
    await pg.initialise()
  }

  await pg.start()

  for (const db of DATABASES) {
    try {
      await pg.createDatabase(db)
      console.log(`Banco criado: ${db}`)
    } catch {
      // já existe
    }
  }

  console.log(`\nPostgres rodando em localhost:${PORT} (user/senha: postgres/postgres)`)
  console.log(`  dev : postgresql://postgres:postgres@localhost:${PORT}/semg_dev`)
  console.log(`  test: postgresql://postgres:postgres@localhost:${PORT}/semg_test`)
  console.log('Ctrl+C para parar.')

  const stop = async () => {
    await pg.stop()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
