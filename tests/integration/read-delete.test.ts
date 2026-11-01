import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import { hash } from 'bcryptjs'
import { verify } from 'jsonwebtoken'
import app from '../../src/app'
import ReadManagerController from '../../src/useCase/gestor/read/ReadManagerController'
import { prisma, resetDb } from '../setup/db'
import { createEnrolledStudent, createAllocationSetup, createStudent, createTeacher } from '../factories'

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /getStatistics', () => {
  it('conta alunos, professores e turmas', async () => {
    await createEnrolledStudent()
    await createAllocationSetup()

    const res = await request(app).get('/getStatistics')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ studantAll: 1, teacherAll: 1, schollClassAll: 2, dropout: 0 })
  })

  it('devolve zeros com o banco vazio', async () => {
    const res = await request(app).get('/getStatistics')
    expect(res.body).toMatchObject({ studantAll: 0, teacherAll: 0, schollClassAll: 0 })
  })
})

describe('turmas (leitura)', () => {
  it('GET /class lista as turmas', async () => {
    const { turma } = await createEnrolledStudent()
    const res = await request(app).get('/class')

    expect(res.status).toBe(200)
    expect(res.body.map((t: any) => t.id)).toContain(turma.id)
  })

  it('GET /class/:query aceita filtro', async () => {
    await createEnrolledStudent()
    const res = await request(app).get('/class/1')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /classroom/:id devolve a turma', async () => {
    const { turma } = await createEnrolledStudent()
    const res = await request(app).get(`/classroom/${turma.id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(turma.id)
  })

  it('GET /tumasdoprofessorrr/:id lista as turmas do professor', async () => {
    const { professor, turma } = await createAllocationSetup()
    const res = await request(app).get(`/tumasdoprofessorrr/${professor.id}`)

    expect(res.status).toBe(200)
    expect(res.body[0].turma.id).toBe(turma.id)
  })
})

describe('disciplinas (leitura)', () => {
  it('GET /subjects/:classId lista as disciplinas', async () => {
    const { turma } = await createAllocationSetup()
    const res = await request(app).get(`/subjects/${turma.id}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /subjects/:turmaId/:professorId lista as disciplinas do professor na turma', async () => {
    const { turma, professor, disciplina } = await createAllocationSetup()
    const res = await request(app).get(`/subjects/${turma.id}/${professor.id}`)

    expect(res.body).toHaveLength(1)
    expect(res.body[0].disciplina.id).toBe(disciplina.id)
  })

  it('GET /redimentoss/:turmaId/:disciplinaId devolve a planilha de rendimento', async () => {
    const { turma, disciplina, aluno } = await createEnrolledStudent()
    const res = await request(app).get(`/redimentoss/${turma.id}/${disciplina.id}`)

    expect(res.body.matriculas).toHaveLength(1)
    expect(res.body.matriculas[0].aluno.id).toBe(aluno.id)
  })

  it('GET /horarios responde lista vazia sem horários', async () => {
    const res = await request(app).get('/horarios')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('professores (leitura)', () => {
  it('GET /teacherstt lista os professores', async () => {
    const prof = await createTeacher()
    const res = await request(app).get('/teacherstt')

    expect(res.status).toBe(200)
    expect(res.body.map((p: any) => p.id)).toContain(prof.id)
  })

  // Bug: a listagem devolve o hash da senha de todos os professores.
  it.fails('GET /teacherstt não deveria expor o hash da senha', async () => {
    await createTeacher()
    const res = await request(app).get('/teacherstt')
    expect(res.body[0].senha).toBeUndefined()
  })

  it('GET /teacherProfile/:id devolve o professor', async () => {
    const prof = await createTeacher()
    const res = await request(app).get(`/teacherProfile/${prof.id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(prof.id)
  })

  it('GET /teachers-subjects/:id responde 200', async () => {
    const { professor } = await createAllocationSetup()
    const res = await request(app).get(`/teachers-subjects/${professor.id}`)
    expect(res.status).toBe(200)
  })
})

describe('alunos (leitura)', () => {
  it('GET /studantss lista os alunos e filtra por nome', async () => {
    const aluno = await createStudent('Zelia Prado')
    await createStudent('Outro Aluno')

    const all = await request(app).get('/studantss')
    expect(all.body).toHaveLength(2)

    const filtered = await request(app).get('/studantss/Zelia')
    expect(filtered.status).toBe(200)
    expect(filtered.body.map((a: any) => a.id)).toContain(aluno.id)
  })

  it('GET /studant/noClasses só traz alunos sem matrícula', async () => {
    const solto = await createStudent('Sem Turma')
    await createEnrolledStudent()

    const res = await request(app).get('/studant/noClasses')

    expect(res.body.map((a: any) => a.id)).toEqual([solto.id])
  })

  it('GET /profile/:studantId devolve o aluno', async () => {
    const { aluno } = await createEnrolledStudent()
    const res = await request(app).get(`/profile/${aluno.id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(aluno.id)
  })

  it('GET /avaliacaos/:registrationId devolve o rendimento por disciplina', async () => {
    const { matricula, disciplina } = await createEnrolledStudent()
    const res = await request(app).get(`/avaliacaos/${matricula.id}`)

    expect(res.status).toBe(200)
    expect(res.body.redimento.map((d: any) => d.id)).toContain(disciplina.id)
  })
})

describe('GET /gestor', () => {
  // Bug: o controller lê email do body de um GET e não trata o erro do Prisma quando ele falta.
  // Chamamos o controller direto: via HTTP a rejeição vira "unhandled rejection" e derruba o vitest.
  it.fails('deveria responder mesmo sem email', async () => {
    const res: any = { json: vi.fn() }

    await ReadManagerController.readManagerController({ body: {} } as any, res)

    expect(res.json).toHaveBeenCalled()
  })
})

describe('exclusões', () => {
  it('DELETE /remove/teacher/:id apaga o professor e a lotação', async () => {
    const { professor } = await createAllocationSetup()
    const res = await request(app).delete(`/remove/teacher/${professor.id}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Professor foi deletado')
    expect(await prisma.professor.count()).toBe(0)
    expect(await prisma.lotacao.count()).toBe(0)
  })

  it('DELETE /remove/teacher/:id com id inexistente não apaga nada', async () => {
    await createTeacher()
    const res = await request(app).delete('/remove/teacher/id-que-nao-existe')

    expect(res.body.error).toBe(true)
    expect(await prisma.professor.count()).toBe(1)
  })

  it('DELETE /remove/studant/:id apaga o aluno e a matrícula (cascade)', async () => {
    const { aluno } = await createEnrolledStudent()
    const res = await request(app).delete(`/remove/studant/${aluno.id}`)

    expect(res.status).toBe(200)
    expect(await prisma.aluno.count()).toBe(0)
    expect(await prisma.matricula.count()).toBe(0)
  })

  it('DELETE /remove/class/:id apaga a turma no banco', async () => {
    const { turma } = await createEnrolledStudent()
    await request(app).delete(`/remove/class/${turma.id}`)

    expect(await prisma.turma.count()).toBe(0)
  })

  // Bug: DeleteClassModel devolve error:true também no sucesso, então o controller responde 400.
  it.fails('DELETE /remove/class/:id deveria responder 200 ao apagar', async () => {
    const { turma } = await createEnrolledStudent()
    const res = await request(app).delete(`/remove/class/${turma.id}`)
    expect(res.status).toBe(200)
  })

  it('DELETE /remove/class/:id com turma inexistente responde 400', async () => {
    const res = await request(app).delete('/remove/class/inexistente')
    expect(res.status).toBe(400)
  })
})

describe('POST /refreshtoken', () => {
  async function loginProfessor() {
    await prisma.professor.create({
      data: { nome: 'Ana', email: 'ana@x.com', senha: await hash('segredo123', 8), data_nascimento: new Date('1990-01-01') },
    })
    return request(app).post('/login').send({ email: 'ana@x.com', senha: 'segredo123' })
  }

  it('gera novo access token válido para professor', async () => {
    const login = await loginProfessor()
    const res = await request(app).post('/refreshtoken').send({ refreshTokenId: login.body.idRefreshToken })

    const payload = verify(res.body, process.env.KEY_TOKEN!) as any
    expect(payload.userName).toBe('Ana')
  })

  it('rejeita refresh token inexistente', async () => {
    const res = await request(app).post('/refreshtoken').send({ refreshTokenId: 'nao-existe' })
    expect(res.body).toBe('Refresh Token invalido')
  })

  it('rejeita refresh token expirado', async () => {
    const login = await loginProfessor()
    await prisma.refreshTokenProfessor.update({ where: { id: login.body.idRefreshToken }, data: { expiresIn: 1 } })

    const res = await request(app).post('/refreshtoken').send({ refreshTokenId: login.body.idRefreshToken })
    expect(res.body).toBe('Refreshtoken expirado')
  })

  // Bug: ReadRefreshToken busca o gestor na tabela professor, então o refresh do gestor sempre falha.
  it.fails('gera novo access token para gestor', async () => {
    await prisma.gestor.create({ data: { nome: 'G', email: 'g@x.com', senha: await hash('segredo123', 8) } })
    const login = await request(app).post('/login').send({ email: 'g@x.com', senha: 'segredo123' })
    const res = await request(app).post('/refreshtoken').send({ refreshTokenId: login.body.idRefreshToken })

    const payload = verify(res.body, process.env.KEY_TOKEN!) as any
    expect(payload.isAdmin).toBe(true)
  })

  // Bug: sem refreshTokenId o controller retorna uma string e nunca responde a requisição.
  it.fails('deveria responder quando refreshTokenId não é enviado', async () => {
    const res = await request(app).post('/refreshtoken').send({}).timeout(1500)
    expect(res.status).toBeLessThan(500)
  })
})
