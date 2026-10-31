import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
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

const horario = { horarioInicio: '07:00', horarioFim: '07:50' }

const contagens = async () => ({
  calendarios: await prisma.calendario.count(),
  horarios: await prisma.horario.count(),
  aulas: await prisma.aula.count(),
})

describe('POST /calendario', () => {
  it('cria dia, horário e aula ligados à lotação', async () => {
    const { lotacao } = await createAllocationSetup()

    const res = await request(app)
      .post('/calendario')
      .send({ weekDay: 'segunda', dataHorario: horario, allocationId: lotacao.id })

    expect(res.body.lotacaoId).toBe(lotacao.id)
    const dia = await prisma.calendario.findUniqueOrThrow({ where: { diaSemana: 'segunda' } })
    expect(dia.ordemSemana).toBe(1)
    expect(res.body.calendarioId).toBe(dia.id)
    expect(await contagens()).toEqual({ calendarios: 1, horarios: 1, aulas: 1 })
  })

  it('guarda a ordem da semana de acordo com o dia', async () => {
    const { lotacao } = await createAllocationSetup()

    await request(app).post('/calendario').send({ weekDay: 'sexta', dataHorario: horario, allocationId: lotacao.id })

    const dia = await prisma.calendario.findUniqueOrThrow({ where: { diaSemana: 'sexta' } })
    expect(dia.ordemSemana).toBe(5)
  })

  it('reaproveita o dia e o horário já existentes para outra lotação', async () => {
    const { turma, lotacao } = await createAllocationSetup()
    const outra = await createAllocation((await createTeacher()).id, (await createSubject()).id, turma.id)
    const body = { weekDay: 'segunda', dataHorario: horario }

    await request(app).post('/calendario').send({ ...body, allocationId: lotacao.id })
    await request(app).post('/calendario').send({ ...body, allocationId: outra.id })

    expect(await contagens()).toEqual({ calendarios: 1, horarios: 1, aulas: 2 })
  })

  it('não repete a mesma aula', async () => {
    const { lotacao } = await createAllocationSetup()
    const body = { weekDay: 'segunda', dataHorario: horario, allocationId: lotacao.id }

    await request(app).post('/calendario').send(body)
    const res = await request(app).post('/calendario').send(body)

    expect(res.body).toMatch(/Essa Aula já existe/)
    expect((await contagens()).aulas).toBe(1)
  })

  it('reutiliza o horário que tem o mesmo início, ignorando o fim enviado', async () => {
    const { lotacao } = await createAllocationSetup()

    await request(app)
      .post('/calendario')
      .send({ weekDay: 'segunda', dataHorario: horario, allocationId: lotacao.id })
    await request(app)
      .post('/calendario')
      .send({ weekDay: 'terça', dataHorario: { horarioInicio: '07:00', horarioFim: '08:40' }, allocationId: lotacao.id })

    const horarios = await prisma.horario.findMany()
    expect(horarios).toHaveLength(1)
    expect(horarios[0].horarioFim).toBe('07:50')
  })

  it('rejeita horário fora do formato HH:MM', async () => {
    const { lotacao } = await createAllocationSetup()

    const res = await request(app)
      .post('/calendario')
      .send({ weekDay: 'segunda', dataHorario: { horarioInicio: '7:00', horarioFim: '07:50' }, allocationId: lotacao.id })

    expect(res.body).toEqual(['horarioInicio'])
    expect(await contagens()).toEqual({ calendarios: 0, horarios: 0, aulas: 0 })
  })

  it('rejeita nome de dia muito longo', async () => {
    const { lotacao } = await createAllocationSetup()

    const res = await request(app)
      .post('/calendario')
      .send({ weekDay: 'segunda-feira', dataHorario: horario, allocationId: lotacao.id })

    expect(res.body).toEqual(['weekDay'])
    expect((await contagens()).aulas).toBe(0)
  })

  it('não cria a aula para um dia que não existe na semana', async () => {
    const { lotacao } = await createAllocationSetup()

    const res = await request(app)
      .post('/calendario')
      .send({ weekDay: 'feriado', dataHorario: horario, allocationId: lotacao.id })

    expect(res.body).toBe('calendar Não existe')
    const c = await contagens()
    expect(c.calendarios).toBe(0)
    expect(c.aulas).toBe(0)
  })

  it('devolve 500 quando falta dataHorario', async () => {
    const { lotacao } = await createAllocationSetup()

    const res = await request(app).post('/calendario').send({ weekDay: 'segunda', allocationId: lotacao.id })

    expect(res.status).toBe(500)
    expect((await contagens()).aulas).toBe(0)
  })

  it('informa lotação inexistente sem criar a aula', async () => {
    const res = await request(app)
      .post('/calendario')
      .send({ weekDay: 'segunda', dataHorario: horario, allocationId: 'nao-existe' })

    expect(res.body).toBe('lotação não existe')
    expect((await contagens()).aulas).toBe(0)
  })

  // Bug: quando a lotação não existe a função retorna uma string em vez de lançar erro,
  // então a transação é confirmada e o dia/horário criados antes ficam órfãos no banco.
  it.fails('lotação inexistente não deveria deixar dia e horário órfãos', async () => {
    await request(app)
      .post('/calendario')
      .send({ weekDay: 'segunda', dataHorario: horario, allocationId: 'nao-existe' })

    expect(await contagens()).toEqual({ calendarios: 0, horarios: 0, aulas: 0 })
  })

  it.todo('professor não deveria ter duas aulas no mesmo dia e horário (regra a confirmar)')
})

describe('GET /horarios', () => {
  it('lista os horários cadastrados', async () => {
    await prisma.horario.createMany({
      data: [
        { horarioInicio: '07:00', horarioFim: '07:50' },
        { horarioInicio: '07:50', horarioFim: '08:40' },
      ],
    })

    const res = await request(app).get('/horarios')

    expect(res.status).toBe(200)
    expect(res.body.map((h: any) => h.horarioInicio).sort()).toEqual(['07:00', '07:50'])
  })
})

describe('GET /calendar/:classId', () => {
  async function aula(lotacaoId: string, dia: string, ordem: number, inicio: string, fim: string) {
    const calendario = await prisma.calendario.upsert({
      where: { diaSemana: dia },
      update: {},
      create: { diaSemana: dia, ordemSemana: ordem },
    })
    const h = await prisma.horario.upsert({
      where: { horarioInicio: inicio },
      update: {},
      create: { horarioInicio: inicio, horarioFim: fim },
    })
    return prisma.aula.create({ data: { lotacaoId, calendarioId: calendario.id, horarioId: h.id } })
  }

  it('devolve 5 dias, com as aulas reais ordenadas por horário e preenchimento padrão', async () => {
    const { lotacao, disciplina, professor } = await createAllocationSetup()
    await aula(lotacao.id, 'Segunda', 1, '08:40', '09:30')
    await aula(lotacao.id, 'Segunda', 1, '07:00', '07:50')

    const res = await request(app).get(`/calendar/${lotacao.turmaId}`)

    expect(res.body).toHaveLength(5)
    const segunda = res.body[0]
    expect(segunda.diaSemana).toBe('Segunda')
    expect(segunda.aulas.slice(0, 2).map((a: any) => a.horario.horarioInicio)).toEqual(['07:00', '08:40'])
    expect(segunda.aulas[0].lotacao).toEqual({
      professor: { id: professor.id, nome: professor.nome },
      disciplina: { id: disciplina.id, nome: disciplina.nome },
    })
    // os demais slots são preenchidos com aulas "placeholder" para o front
    expect(segunda.aulas).toHaveLength(5)
    expect(segunda.aulas[4].horario.id).toBe('id-padrao-horario')
  })

  // Bug: a rota declara :classId, mas o controller lê req.params.turmaId (undefined).
  // O filtro por turma some e a grade devolve as aulas de TODAS as turmas.
  it.fails('deveria listar só as aulas da turma pedida', async () => {
    const a = await createAllocationSetup()
    const outraTurma = await createClass(a.escola.id, a.ano.id)
    const lotacaoB = await createAllocation(a.professor.id, a.disciplina.id, outraTurma.id)
    await aula(a.lotacao.id, 'Segunda', 1, '07:00', '07:50')
    await aula(lotacaoB.id, 'Terça', 2, '07:00', '07:50')

    const res = await request(app).get(`/calendar/${a.turma.id}`)

    const reais = res.body.flatMap((d: any) => d.aulas).filter((x: any) => x.horario.id !== 'id-padrao-horario')
    expect(reais).toHaveLength(1)
  })
})
