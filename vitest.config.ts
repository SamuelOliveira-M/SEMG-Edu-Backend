import { existsSync } from 'fs'
import path from 'path'
import { defineConfig } from 'vitest/config'
import { loadTestEnv } from './tests/setup/env'

// Argumentos posicionais da linha de comando (filtros de arquivo), sem flags.
const filters = process.argv.slice(2).filter((a) => !a.startsWith('-') && a !== 'run' && a !== 'watch')
const unitOnly = filters.length > 0 && filters.every((f) => f.replace(/\\/g, '/').startsWith('tests/unit'))

const hasTestEnv = existsSync(path.resolve(__dirname, '.env.test'))

if (hasTestEnv) {
  // Sempre valida e carrega o .env.test (host local + nome contendo "test").
  loadTestEnv()
} else if (unitOnly) {
  // Sem .env.test: testes unitários não tocam o banco, mas o src/lib/prisma lê o .env por
  // padrão. Fixamos uma URL inerte para que NENHUM teste consiga alcançar o banco real.
  process.env.NODE_ENV = 'test'
  process.env.DIRECT_URL = 'postgresql://postgres:postgres@127.0.0.1:1/semg_test_inert'
  process.env.DATABASE_URL = process.env.DIRECT_URL
  process.env.KEY_TOKEN ??= 'test-secret'
} else {
  // Falha explicitamente (mensagem orienta a criar o .env.test).
  loadTestEnv()
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: unitOnly ? [] : ['./tests/setup/global.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/interface/**', 'src/server.ts'],
    },
  },
})
