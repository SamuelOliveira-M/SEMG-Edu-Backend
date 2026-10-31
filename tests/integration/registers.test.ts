import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { compare } from 'bcryptjs'
import app from '../../src/app'
import { prisma, resetDb } from '../setup/db'

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /disciplina', () => {
  const body = { nome: 'Matemática', carga_horaria: 80 }

  it('cria a disciplina', async () => {
    const res = await request(app).post('/disciplina').send(body)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Disciplina criado com sucesso')
    expect(await prisma.disciplina.count()).toBe(1)
  })

  it('não grava duplicata (barrada pelo unique do banco)', async () => {
    await request(app).post('/disciplina').send(body)
    const second = await request(app).post('/disciplina').send(body)

    expect(second.body.error).toBe(true)
    expect(await prisma.disciplina.count()).toBe(1)
  })

  // Bug: CreateSubjectModel chama readSubject(nome), mas readSubject filtra por id,
  // então a checagem nunca acha a existente e o erro vem do unique do banco.
  it.fails('deveria devolver a disciplina existente em vez de "Erro desconhecido"', async () => {
    const first = await request(app).post('/disciplina').send(body)
    const second = await request(app).post('/disciplina').send(body)

    expect(second.body.message).toBe('Disciplina já existe no sistema')
    expect(second.body.data.id).toBe(first.body.data.id)
  })

  it('rejeita nome ausente e não grava nada', async () => {
    const res = await request(app).post('/disciplina').send({ carga_horaria: 80 })

    expect(res.body.error).toBe(true)
    expect(await prisma.disciplina.count()).toBe(0)
  })

  it('rejeita carga horária acima do limite', async () => {
    const res = await request(app).post('/disciplina').send({ nome: 'Física', carga_horaria: 10000 })

    expect(res.body.error).toBe(true)
    expect(await prisma.disciplina.count()).toBe(0)
  })
})

describe('POST /gestor', () => {
  // O validador de gestor é o mesmo do professor e por isso exige data_nascimento.
  const body = { nome: 'Gestora Maria', email: 'maria@exemplo.com', senha: 'segredo123', data_nascimento: '1985-03-02' }

  it('cria o gestor com a senha criptografada', async () => {
    const res = await request(app).post('/gestor').send(body)

    expect(res.body.message).toBe('Gestor criado com sucesso')
    const saved = await prisma.gestor.findUniqueOrThrow({ where: { email: body.email } })
    expect(saved.senha).not.toBe(body.senha)
    expect(await compare(body.senha, saved.senha)).toBe(true)
  })

  it('não duplica por email', async () => {
    await request(app).post('/gestor').send(body)
    const res = await request(app).post('/gestor').send({ ...body, nome: 'Outra Pessoa' })

    expect(res.body.message).toBe('Gestor já existe no sistema')
    expect(await prisma.gestor.count()).toBe(1)
  })

  it('rejeita senha curta', async () => {
    const res = await request(app).post('/gestor').send({ ...body, senha: '123' })

    expect(res.body.error).toBe(true)
    expect(await prisma.gestor.count()).toBe(0)
  })

  it.fails('não deveria exigir data_nascimento para cadastrar gestor', async () => {
    const { data_nascimento, ...semData } = body
    const res = await request(app).post('/gestor').send(semData)

    expect(res.body.message).toBe('Gestor criado com sucesso')
  })

  it.fails('não deveria devolver o hash da senha', async () => {
    const res = await request(app).post('/gestor').send(body)

    expect(res.body.data.senha).toBeUndefined()
  })
})

describe('POST /create/professor', () => {
  // O corpo do professor vem embrulhado em { data: {...} }.
  const teacher = { nome: 'Ana Souza', email: 'ana@exemplo.com', senha: 'segredo123', data_nascimento: '1990-01-01' }

  it('cria o professor com a senha criptografada', async () => {
    const res = await request(app).post('/create/professor').send({ data: teacher })

    expect(res.body.data.email).toBe(teacher.email)
    const saved = await prisma.professor.findUniqueOrThrow({ where: { email: teacher.email } })
    expect(await compare(teacher.senha, saved.senha)).toBe(true)
    expect(saved.data_nascimento.toISOString()).toContain('1990-01-01')
  })

  it('não duplica por email', async () => {
    await request(app).post('/create/professor').send({ data: teacher })
    const res = await request(app).post('/create/professor').send({ data: teacher })

    expect(res.body.message).toBe('Professor já existe no sistema')
    expect(await prisma.professor.count()).toBe(1)
  })

  it('rejeita email inválido', async () => {
    const res = await request(app).post('/create/professor').send({ data: { ...teacher, email: 'x' } })

    expect(res.body.error).toBe(true)
    expect(await prisma.professor.count()).toBe(0)
  })

  it('responde com erro (sem travar) quando falta o envelope "data"', async () => {
    const res = await request(app).post('/create/professor').send(teacher)

    expect(res.body.error).toBe(true)
    expect(await prisma.professor.count()).toBe(0)
  })

  it.fails('a mensagem de sucesso deveria falar de professor, não de disciplina', async () => {
    const res = await request(app).post('/create/professor').send({ data: teacher })

    expect(res.body.message).toMatch(/professor/i)
  })
})
