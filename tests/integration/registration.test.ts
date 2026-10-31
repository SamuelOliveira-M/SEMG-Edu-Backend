import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import request from 'supertest'
import app from '../../src/app'
import { createClass, createRegistration, createSchool, createSchoolYear, createStudent } from '../factories'
import { prisma, resetDb } from '../setup/db'

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await prisma.$disconnect()
})

async function setup() {
  const escola = await createSchool()
  const ano = await createSchoolYear()
  const turma = await createClass(escola.id, ano.id)
  const aluno = await createStudent()
  return { escola, turma, aluno }
}

describe('POST /matricular', () => {
  it('matricula o aluno na turma da escola', async () => {
    const { escola, turma, aluno } = await setup()

    const res = await request(app)
      .post('/matricular')
      .send({ status: 'ativo', escola: escola.cod_inep, idTurma: turma.id, alunoId: aluno.id })

    expect(res.body.message).toBe('Matricula criado com sucesso')
    expect(res.body.data).toMatchObject({ alunoId: aluno.id, turmaId: turma.id, escolaId: escola.id })
    // AAAAMMDD + 4 dígitos aleatórios
    expect(res.body.data.numero_matricula).toMatch(/^\d{12}$/)
    expect(await prisma.matricula.count()).toBe(1)
  })

  it('não cria segunda matrícula para o mesmo aluno', async () => {
    const { escola, turma, aluno } = await setup()
    const body = { status: 'ativo', escola: escola.cod_inep, idTurma: turma.id, alunoId: aluno.id }

    await request(app).post('/matricular').send(body)
    const res = await request(app).post('/matricular').send(body)

    expect(res.body.message).toBe('Aluno já possui uma matricula')
    expect(await prisma.matricula.count()).toBe(1)
  })

  it('rejeita escola inexistente', async () => {
    const { turma, aluno } = await setup()

    const res = await request(app)
      .post('/matricular')
      .send({ status: 'ativo', escola: '99999999', idTurma: turma.id, alunoId: aluno.id })

    expect(res.body).toEqual({ error: true, message: 'A Escola não existe no sistema' })
    expect(await prisma.matricula.count()).toBe(0)
  })

  it('rejeita turma que não pertence à escola', async () => {
    const { turma, aluno } = await setup()
    const outraEscola = await createSchool()

    const res = await request(app)
      .post('/matricular')
      .send({ status: 'ativo', escola: outraEscola.cod_inep, idTurma: turma.id, alunoId: aluno.id })

    expect(res.body).toEqual({ error: true, message: 'Não existe essa turma' })
    expect(await prisma.matricula.count()).toBe(0)
  })

  it('rejeita corpo sem idTurma', async () => {
    const { escola, aluno } = await setup()

    const res = await request(app).post('/matricular').send({ status: 'ativo', escola: escola.cod_inep, alunoId: aluno.id })

    expect(res.body.error).toBe(true)
    expect(await prisma.matricula.count()).toBe(0)
  })

  // Bug: com aluno inexistente o model retorna undefined e o controller responde 200 com corpo vazio.
  it.fails('deveria informar erro quando o aluno não existe', async () => {
    const { escola, turma } = await setup()

    const res = await request(app)
      .post('/matricular')
      .send({ status: 'ativo', escola: escola.cod_inep, idTurma: turma.id, alunoId: 'nao-existe' })

    expect(res.body.error).toBeTruthy()
  })
})

describe('GET /studantee/:classId', () => {
  it('lista só os alunos da turma, ordenados por nome ignorando acentos', async () => {
    const escola = await createSchool()
    const ano = await createSchoolYear()
    const turma = await createClass(escola.id, ano.id)
    const outraTurma = await createClass(escola.id, ano.id)

    for (const nome of ['Zélia', 'Álvaro', 'Beatriz']) {
      await createRegistration((await createStudent(nome)).id, escola.id, turma.id)
    }
    await createRegistration((await createStudent('Fora da turma')).id, escola.id, outraTurma.id)

    const res = await request(app).get(`/studantee/${turma.id}`)

    expect(res.body.map((a: any) => a.nome)).toEqual(['Álvaro', 'Beatriz', 'Zélia'])
  })

  it('devolve lista vazia para turma sem matrículas', async () => {
    const res = await request(app).get('/studantee/inexistente')

    expect(res.body).toEqual([])
  })

  // A consulta usa unaccent(), que precisa da extensão do Postgres; nenhuma migration a cria.
  it.fails('as migrations deveriam criar a extensão unaccent', () => {
    const dir = path.resolve(__dirname, '../../prisma/migrations')
    const sql = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => readFileSync(path.join(dir, d.name, 'migration.sql'), 'utf8'))
      .join('\n')

    expect(sql).toMatch(/CREATE EXTENSION[^;]*unaccent/i)
  })
})
