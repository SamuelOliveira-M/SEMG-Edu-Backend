import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { decode, verify } from 'jsonwebtoken'
import GenerateTokenProvider from '../../src/services/GenerateTokenProvider'

describe('GenerateTokenProvider', () => {
  const original = process.env.KEY_TOKEN

  beforeEach(() => {
    process.env.KEY_TOKEN = 'test-secret'
  })

  afterEach(() => {
    process.env.KEY_TOKEN = original
  })

  it('gera um JWT verificável com o payload esperado', async () => {
    const token = await GenerateTokenProvider.execute('abc', 'Maria', true)

    const payload = verify(token as string, 'test-secret') as any
    expect(payload.userId).toBe('abc')
    expect(payload.userName).toBe('Maria')
    expect(payload.isAdmin).toBe(true)
    expect(payload.sub).toBe('abc')
  })

  it('expira em 120 segundos', async () => {
    const token = await GenerateTokenProvider.execute('abc', 'Maria', false)

    const { iat, exp } = decode(token as string) as any
    expect(exp - iat).toBe(120)
  })

  it('retorna undefined quando KEY_TOKEN não está definido', async () => {
    delete process.env.KEY_TOKEN

    expect(await GenerateTokenProvider.execute('abc', 'Maria', false)).toBeUndefined()
  })
})
