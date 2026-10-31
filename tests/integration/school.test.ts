import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import axios from 'axios'
import app from '../../src/app'
import TransetionSchoolModel from '../../src/useCase/escola/transetion/TransetionSchoolModel'
import { createSchool } from '../factories'
import { prisma, resetDb } from '../setup/db'

// A validação de endereço consulta o ViaCEP; nos testes nunca saímos para a internet.
vi.mock('axios', () => ({ default: { get: vi.fn() } }))
const viaCep = vi.mocked(axios.get)

const address = { rua: 'Rua das Flores', cidade: 'Belo Horizonte', estado: 'MG', cep: '30110000' }
const school = { nome: 'Escola Modelo', cod_inep: '12345678', email: 'modelo@exemplo.com' }

beforeEach(async () => {
  await resetDb()
  viaCep.mockReset()
  // O ViaCEP devolve bairro/localidade/uf; o validador compara com rua/cidade/estado.
  viaCep.mockResolvedValue({ data: { bairro: 'Rua das Flores', localidade: 'Belo Horizonte', uf: 'MG' } })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /escola', () => {
  it('cria endereço e escola na mesma transação', async () => {
    const res = await request(app).post('/escola').send({ dataSchool: { ...school }, dataAddress: address })

    expect(res.body.school.message).toBe('Escola cadastrada com socesso')
    const saved = await prisma.escola.findUniqueOrThrow({ where: { cod_inep: school.cod_inep } })
    expect(saved.addressId).toBe(res.body.address.data.id)
    expect(await prisma.address.count()).toBe(1)
  })

  it('não duplica escola com o mesmo cod_inep', async () => {
    await request(app).post('/escola').send({ dataSchool: { ...school }, dataAddress: address })
    const res = await request(app).post('/escola').send({ dataSchool: { ...school }, dataAddress: address })

    expect(res.body.school.message).toBe('Escola já cadastrada')
    expect(await prisma.escola.count()).toBe(1)
    expect(await prisma.address.count()).toBe(1)
  })

  it('rejeita endereço que não confere com o ViaCEP', async () => {
    viaCep.mockResolvedValue({ data: { bairro: 'Outro Bairro', localidade: 'Belo Horizonte', uf: 'MG' } })

    const res = await request(app).post('/escola').send({ dataSchool: { ...school }, dataAddress: address })

    expect(res.body).toBe('Endereço invalido')
    expect(await prisma.escola.count()).toBe(0)
    expect(await prisma.address.count()).toBe(0)
  })

  it('rejeita cod_inep inválido', async () => {
    const res = await request(app)
      .post('/escola')
      .send({ dataSchool: { ...school, cod_inep: '123' }, dataAddress: address })

    expect(res.body).toContain('cod_inep')
    expect(await prisma.escola.count()).toBe(0)
  })

  it('faz rollback do endereço quando a criação da escola falha', async () => {
    await createSchool({ email: school.email }) // email já usado por outra escola (unique)
    const addressesBefore = await prisma.address.count()

    await expect(
      TransetionSchoolModel.transetionSchoolModel({ ...school } as any, {
        rua: 'Rua Nova',
        cidade: 'Contagem',
        estado: 'MG',
        cep: '32000000',
      } as any)
    ).rejects.toThrow()

    expect(await prisma.address.count()).toBe(addressesBefore)
    expect(await prisma.escola.count()).toBe(1)
  })
})

describe('POST /create/turma/:cod_inep', () => {
  const schoolClass = { nome: 'A', serie: 1, turno: 'manha', status: 'aberta' }

  it('cria o ano letivo e a turma com o nome composto', async () => {
    const escola = await createSchool()

    const res = await request(app).post(`/create/turma/${escola.cod_inep}`).send({ ...schoolClass })

    const year = new Date().getFullYear()
    expect(res.body.schoolClass.data.nome).toBe(`1º ano A - manha - ${year}`)
    expect(res.body.schoolClass.data.escolaId).toBe(escola.id)
    expect(await prisma.turma.count()).toBe(1)
    expect(await prisma.anoLetivo.count()).toBe(1)
  })

  it('devolve "Escola não existe" para cod_inep desconhecido e não cria nada', async () => {
    const res = await request(app).post('/create/turma/99999999').send({ ...schoolClass })

    expect(res.body).toBe('Escola não existe')
    expect(await prisma.turma.count()).toBe(0)
  })

  it('rejeita status inválido', async () => {
    const escola = await createSchool()

    const res = await request(app)
      .post(`/create/turma/${escola.cod_inep}`)
      .send({ ...schoolClass, status: 'pendente' })

    expect(res.body).toContain('status')
    expect(await prisma.turma.count()).toBe(0)
  })
})
