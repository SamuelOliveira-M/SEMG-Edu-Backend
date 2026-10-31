import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import CreateGradeController from '../../src/useCase/notas/create/CreateGradeController'
import { createEnrolledStudent, createSubject, currentYear } from '../factories'
import { prisma, resetDb } from '../setup/db'

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await prisma.$disconnect()
})

const gradeBody = (disciplinaId: string, overrides: Record<string, unknown> = {}) => ({
  tipo: 'normal',
  nota: 7,
  mes: 3,
  semestre: 1,
  anoLetivo: currentYear,
  disciplina: disciplinaId,
  ...overrides,
})

describe('POST /nota/:registrationId', () => {
  it('lança a nota vinculada à matrícula, disciplina e ano letivo', async () => {
    const { matricula, disciplina, ano } = await createEnrolledStudent()

    const res = await request(app).post(`/nota/${matricula.id}`).send(gradeBody(disciplina.id))

    expect(res.body.data).toMatchObject({
      nota: 7,
      mes: 3,
      tipo: 'normal',
      semestre: 1,
      matriculaId: matricula.id,
      disciplinaId: disciplina.id,
      anoLetivoId: ano.id,
    })
    expect(await prisma.avaliacao.count()).toBe(1)
  })

  it('grava a prova final no mês 13, independentemente do mês enviado', async () => {
    const { matricula, disciplina } = await createEnrolledStudent()

    const res = await request(app)
      .post(`/nota/${matricula.id}`)
      .send(gradeBody(disciplina.id, { tipo: 'final', mes: 11, semestre: 2 }))

    expect(res.body.data.mes).toBe(13)
  })

  it('reenviar a mesma nota não cria duplicata', async () => {
    const { matricula, disciplina } = await createEnrolledStudent()
    const body = gradeBody(disciplina.id)

    await request(app).post(`/nota/${matricula.id}`).send(body)
    await request(app).post(`/nota/${matricula.id}`).send(body)

    expect(await prisma.avaliacao.count()).toBe(1)
  })

  it.each([
    ['nota acima de 10', { nota: 11 }, 'nota'],
    ['nota negativa', { nota: -1 }, 'nota'],
    ['mês fora do período', { mes: 2 }, 'mes'],
    ['semestre inválido', { semestre: 3 }, 'semestre'],
    ['tipo desconhecido', { tipo: 'bonus' }, 'tipo'],
  ])('rejeita %s sem gravar nada', async (_, override, campo) => {
    const { matricula, disciplina } = await createEnrolledStudent()

    const res = await request(app).post(`/nota/${matricula.id}`).send(gradeBody(disciplina.id, override))

    expect(res.body.error).toBe(true)
    expect(res.body.message).toContain(campo)
    expect(await prisma.avaliacao.count()).toBe(0)
  })

  it('informa disciplina inexistente', async () => {
    const { matricula } = await createEnrolledStudent()

    const res = await request(app).post(`/nota/${matricula.id}`).send(gradeBody('nao-existe'))

    expect(res.body.erro).toBe(true)
    expect(res.body.message).toContain('Disciplina invalida')
    expect(await prisma.avaliacao.count()).toBe(0)
  })

  it('informa ano letivo inexistente', async () => {
    const { matricula, disciplina } = await createEnrolledStudent()

    const res = await request(app)
      .post(`/nota/${matricula.id}`)
      .send(gradeBody(disciplina.id, { anoLetivo: currentYear - 10 }))

    expect(res.body.message).toBe('Ano letivo não existe')
    expect(await prisma.avaliacao.count()).toBe(0)
  })

  it('responde erro (sem gravar) para matrícula inexistente', async () => {
    const { disciplina } = await createEnrolledStudent()

    const res = await request(app).post('/nota/nao-existe').send(gradeBody(disciplina.id))

    expect(res.body.error).toBe(true)
    expect(await prisma.avaliacao.count()).toBe(0)
  })

  // Bug: a checagem de "nota já existe" inclui o valor da nota no filtro. Corrigir uma nota
  // (7 -> 9) não encontra a anterior e cria uma segunda avaliação para o mesmo mês/disciplina.
  it.fails('corrigir a nota de um mês deveria atualizar a existente, não duplicar', async () => {
    const { matricula, disciplina } = await createEnrolledStudent()

    await request(app).post(`/nota/${matricula.id}`).send(gradeBody(disciplina.id, { nota: 7 }))
    await request(app).post(`/nota/${matricula.id}`).send(gradeBody(disciplina.id, { nota: 9 }))

    expect(await prisma.avaliacao.count()).toBe(1)
  })

  // Bug: o validador só aceita 'recuperação' (com acento), mas o resto do sistema
  // (enum de /add/notas, regra de mês 7 no model) usa '1 recuperacao' / '2 recuperacao'.
  it.fails("deveria aceitar o tipo '1 recuperacao' usado pelo restante do sistema", async () => {
    const { matricula, disciplina } = await createEnrolledStudent()

    const res = await request(app)
      .post(`/nota/${matricula.id}`)
      .send(gradeBody(disciplina.id, { tipo: '1 recuperacao' }))

    expect(res.body.error).toBeUndefined()
  })

  it.fails('a mensagem de sucesso deveria falar de nota, não de matrícula', async () => {
    const { matricula, disciplina } = await createEnrolledStudent()

    const res = await request(app).post(`/nota/${matricula.id}`).send(gradeBody(disciplina.id))

    expect(res.body.message).toMatch(/nota|avalia/i)
  })
})

describe('POST /add/notas (ModifyGradeController)', () => {
  const fakeRes = () => {
    const res: any = {}
    res.json = vi.fn().mockReturnValue(res)
    return res
  }

  it('lança uma nota por coluna do boletim, traduzindo o cabeçalho para mês/tipo/semestre', async () => {
    const { matricula, disciplina } = await createEnrolledStudent()
    const req: any = {
      body: {
        disciplinaId: disciplina.id,
        anoLetivo: currentYear,
        avaliacao: {
          a: { matricula: matricula.id, header: 'MAR', nota: 7 },
          b: { matricula: matricula.id, header: '1ºRS', nota: 5 },
        },
      },
    }

    await CreateGradeController.ModifyGradeController(req, fakeRes())

    const saved = await prisma.avaliacao.findMany({ orderBy: { mes: 'asc' } })
    expect(saved.map((a) => [a.mes, a.tipo, a.semestre, a.nota])).toEqual([
      [3, 'normal', 1, 7],
      [7, '1 recuperacao', 1, 5],
    ])
  })

  // Bug: o handler devolve o array com `return` em vez de res.json(...). Em uma requisição
  // real o Express nunca envia resposta e o cliente fica esperando até o timeout.
  it.fails('deveria responder à requisição com o resultado', async () => {
    const { matricula, disciplina } = await createEnrolledStudent()
    const res = fakeRes()
    const req: any = {
      body: {
        disciplinaId: disciplina.id,
        anoLetivo: currentYear,
        avaliacao: { a: { matricula: matricula.id, header: 'MAR', nota: 7 } },
      },
    }

    await CreateGradeController.ModifyGradeController(req, res)

    expect(res.json).toHaveBeenCalled()
  })
})

describe('GET /avaliacaos/:registrationId', () => {
  it('monta o boletim por disciplina completando os meses 3 a 13', async () => {
    const { matricula, disciplina } = await createEnrolledStudent()
    await request(app).post(`/nota/${matricula.id}`).send(gradeBody(disciplina.id, { nota: 8, mes: 3 }))
    await request(app).post(`/nota/${matricula.id}`).send(gradeBody(disciplina.id, { nota: 6, mes: 4 }))

    const res = await request(app).get(`/avaliacaos/${matricula.id}`)

    const boletim = res.body.redimento.find((d: any) => d.id === disciplina.id)
    expect(boletim.avaliacao).toHaveLength(11)
    expect(boletim.avaliacao.filter((a: any) => a.id !== null).map((a: any) => [a.mes, a.nota])).toEqual([
      [3, 8],
      [4, 6],
    ])
    expect(boletim.media).toBe(7)
    expect(boletim.status).toBe('Cursando')
  })

  it('só traz as notas da matrícula pedida', async () => {
    const um = await createEnrolledStudent()
    const outra = await createEnrolledStudent()
    await request(app).post(`/nota/${outra.matricula.id}`).send(gradeBody(outra.disciplina.id, { nota: 10 }))

    const res = await request(app).get(`/avaliacaos/${um.matricula.id}`)

    const notasLancadas = res.body.redimento.flatMap((d: any) => d.avaliacao).filter((a: any) => a.id !== null)
    expect(notasLancadas).toHaveLength(0)
  })

  it('lista disciplinas sem nota com todos os meses zerados', async () => {
    const { matricula } = await createEnrolledStudent()
    const extra = await createSubject('História')

    const res = await request(app).get(`/avaliacaos/${matricula.id}`)

    const boletim = res.body.redimento.find((d: any) => d.id === extra.id)
    expect(boletim.avaliacao.every((a: any) => a.id === null && a.nota === 0)).toBe(true)
  })
})
