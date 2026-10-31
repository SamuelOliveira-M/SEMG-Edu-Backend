import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import AllocationOfTeacherController from '../../src/useCase/allocation/allocationOfTeacher/create/AllocationOfTeacherController'
import {
  createAllocation,
  createAllocationSetup,
  createClass,
  createSubject,
  createTeacher,
} from '../factories'
import { prisma, resetDb } from '../setup/db'

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await prisma.$disconnect()
})

async function setupWithoutAllocation() {
  const { lotacao, ...rest } = await createAllocationSetup()
  await prisma.lotacao.delete({ where: { id: lotacao.id } })
  return rest
}

describe('POST /allocation/teacher', () => {
  it('lota o professor com a disciplina na turma', async () => {
    const { professor, disciplina, turma } = await setupWithoutAllocation()

    const res = await request(app)
      .post('/allocation/teacher')
      .send({ teacherId: professor.id, subjectId: disciplina.id, classId: turma.id })

    expect(res.body.error).toBe(false)
    expect(res.body.data).toMatchObject({ professorId: professor.id, disciplinaId: disciplina.id, turmaId: turma.id })
    expect(await prisma.lotacao.count()).toBe(1)
  })

  it('não repete a mesma lotação', async () => {
    const { professor, disciplina, turma } = await setupWithoutAllocation()
    const body = { teacherId: professor.id, subjectId: disciplina.id, classId: turma.id }

    await request(app).post('/allocation/teacher').send(body)
    const res = await request(app).post('/allocation/teacher').send(body)

    expect(res.body).toEqual({ error: true, message: 'O professor já está lotado com essa disciplina' })
    expect(await prisma.lotacao.count()).toBe(1)
  })

  it('permite o mesmo professor e disciplina em outra turma', async () => {
    const { escola, ano, professor, disciplina, turma } = await setupWithoutAllocation()
    const outraTurma = await createClass(escola.id, ano.id)

    await request(app)
      .post('/allocation/teacher')
      .send({ teacherId: professor.id, subjectId: disciplina.id, classId: turma.id })
    const res = await request(app)
      .post('/allocation/teacher')
      .send({ teacherId: professor.id, subjectId: disciplina.id, classId: outraTurma.id })

    expect(res.body.error).toBe(false)
    expect(await prisma.lotacao.count()).toBe(2)
  })

  it.each([
    ['disciplina', 'Disciplina não existe'],
    ['professor', 'Professor não Existe'],
    ['turma', 'Turma não existe'],
  ])('informa %s inexistente e não grava nada', async (qual, mensagem) => {
    const { professor, disciplina, turma } = await setupWithoutAllocation()
    const ids = { teacherId: professor.id, subjectId: disciplina.id, classId: turma.id }
    const chave = { disciplina: 'subjectId', professor: 'teacherId', turma: 'classId' }[qual] as keyof typeof ids

    const res = await request(app)
      .post('/allocation/teacher')
      .send({ ...ids, [chave]: 'nao-existe' })

    expect(res.body).toEqual({ error: true, message: mensagem })
    expect(await prisma.lotacao.count()).toBe(0)
  })

  // Bug: sem os ids no corpo o Prisma lança erro de validação; o controller só faz console.log
  // no catch, e a requisição real fica sem resposta.
  it.fails('deveria responder quando o corpo vem sem os ids', async () => {
    const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() }

    await AllocationOfTeacherController.AddSubjectToTeacher({ body: {} } as any, res)

    expect(res.json).toHaveBeenCalled()
  })
})

describe('GET /teachers-subjects/:id (professores e disciplinas da turma)', () => {
  it('agrupa por professor, com as disciplinas dele só nessa turma', async () => {
    const { escola, ano, turma, professor, disciplina } = await createAllocationSetup()
    const segunda = await createSubject('História')
    await createAllocation(professor.id, segunda.id, turma.id)

    const outraTurma = await createClass(escola.id, ano.id)
    const naoLista = await createSubject('Artes')
    await createAllocation(professor.id, naoLista.id, outraTurma.id)

    const colega = await createTeacher('Colega')
    await createAllocation(colega.id, disciplina.id, turma.id)

    const res = await request(app).get(`/teachers-subjects/${turma.id}`)

    const profs = res.body.map((r: any) => r.professor)
    expect(profs).toHaveLength(2)

    const doProfessor = profs.find((p: any) => p.id === professor.id)
    expect(doProfessor.disciplinasTurmas.map((d: any) => d.disciplina.nome).sort()).toEqual(
      [disciplina.nome, 'História'].sort()
    )
  })

  it('devolve lista vazia para turma sem lotações', async () => {
    const res = await request(app).get('/teachers-subjects/nao-existe')

    expect(res.body).toEqual([])
  })
})
