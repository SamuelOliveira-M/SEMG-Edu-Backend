import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { hash } from 'bcryptjs'
import { verify } from 'jsonwebtoken'
import app from '../../src/app'
import { prisma, resetDb } from '../setup/db'

describe('GET /', () => {
  it('responde 200', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })
})

describe('POST /login', () => {
  beforeEach(async () => {
    await resetDb()
    await prisma.professor.create({
      data: {
        nome: 'Ana Souza',
        email: 'ana@exemplo.com',
        senha: await hash('segredo123', 8),
        data_nascimento: new Date('1990-01-01'),
      },
    })
    await prisma.gestor.create({
      data: { nome: 'Gestora', email: 'gestora@exemplo.com', senha: await hash('segredo123', 8) },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('autentica professor e devolve um JWT válido', async () => {
    const res = await request(app).post('/login').send({ email: 'ana@exemplo.com', senha: 'segredo123' })

    expect(res.status).toBe(201)
    const payload = verify(res.body.accessToken, process.env.KEY_TOKEN!) as any
    expect(payload.userName).toBe('Ana Souza')
    expect(payload.isAdmin).toBe(false)
    expect(res.body.idRefreshToken).toBeTruthy()
  })

  it('autentica gestor e emite o token como admin', async () => {
    const res = await request(app).post('/login').send({ email: 'gestora@exemplo.com', senha: 'segredo123' })

    expect(res.status).toBe(201)
    const payload = verify(res.body.accessToken, process.env.KEY_TOKEN!) as any
    expect(payload.isAdmin).toBe(true)
  })

  it('retorna 401 para senha errada', async () => {
    const res = await request(app).post('/login').send({ email: 'ana@exemplo.com', senha: 'errada' })
    expect(res.status).toBe(401)
  })

  it('retorna 401 para email inexistente', async () => {
    const res = await request(app).post('/login').send({ email: 'ninguem@exemplo.com', senha: 'x' })
    expect(res.status).toBe(401)
  })

  it('não deveria expor o hash da senha na resposta', async () => {
    const res = await request(app).post('/login').send({ email: 'ana@exemplo.com', senha: 'segredo123' })
    expect(res.body.senha).toBeUndefined()
  })

  it('deveria devolver isAdmin:true no corpo para o gestor', async () => {
    const res = await request(app).post('/login').send({ email: 'gestora@exemplo.com', senha: 'segredo123' })
    expect(res.body.isAdmin).toBe(true)
  })
})
