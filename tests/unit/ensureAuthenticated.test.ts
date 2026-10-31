import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sign } from 'jsonwebtoken'
import { ensureAuthenticated } from '../../src/middlewares/ensureAuthenticated'

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('ensureAuthenticated', () => {
  const original = process.env.KEY_TOKEN

  beforeEach(() => {
    process.env.KEY_TOKEN = 'test-secret'
  })

  afterEach(() => {
    process.env.KEY_TOKEN = original
  })

  it('retorna 401 quando não há header Authorization', () => {
    const res = mockRes()
    const next = vi.fn()

    ensureAuthenticated({ headers: {} } as any, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'token is missing' })
    expect(next).not.toHaveBeenCalled()
  })

  it('retorna 401 para token inválido', () => {
    const res = mockRes()
    const next = vi.fn()

    ensureAuthenticated({ headers: { authorization: 'lixo' } } as any, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'token invalido' })
    expect(next).not.toHaveBeenCalled()
  })

  it('retorna 401 para token assinado com outra chave', () => {
    const res = mockRes()
    const next = vi.fn()
    const token = sign({ userId: '1' }, 'outra-chave')

    ensureAuthenticated({ headers: { authorization: token } } as any, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('chama next() para token válido (sem prefixo Bearer)', () => {
    const res = mockRes()
    const next = vi.fn()
    const token = sign({ userId: '1' }, 'test-secret')

    ensureAuthenticated({ headers: { authorization: token } } as any, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('rejeita token com prefixo "Bearer " (comportamento atual)', () => {
    const res = mockRes()
    const next = vi.fn()
    const token = sign({ userId: '1' }, 'test-secret')

    ensureAuthenticated({ headers: { authorization: `Bearer ${token}` } } as any, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  // Bug conhecido: sem KEY_TOKEN o middleware não responde nem chama next(), a requisição fica pendurada.
  it.fails('deveria responder (erro) quando KEY_TOKEN não está definido', () => {
    delete process.env.KEY_TOKEN
    const res = mockRes()
    const next = vi.fn()

    ensureAuthenticated({ headers: { authorization: 'qualquer' } } as any, res, next)

    expect(res.status).toHaveBeenCalled()
  })
})
