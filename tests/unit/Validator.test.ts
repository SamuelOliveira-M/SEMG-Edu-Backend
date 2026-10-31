import { describe, it, expect } from 'vitest'
import Validator from '../../src/services/Validator'

// Os validadores retornam o caminho do primeiro campo inválido (array) ou null quando está tudo certo.

describe('Validator.schoolValidator', () => {
  const valid = { nome: 'Escola Modelo', cod_inep: '12345678', email: 'escola@exemplo.com' }

  it('aceita dados válidos', () => {
    expect(Validator.schoolValidator(valid as any)).toBeNull()
  })

  it.each([
    ['cod_inep com letras', { ...valid, cod_inep: '1234abcd' }, ['cod_inep']],
    ['cod_inep com tamanho errado', { ...valid, cod_inep: '123' }, ['cod_inep']],
    ['email inválido', { ...valid, email: 'nao-e-email' }, ['email']],
    ['nome ausente', { cod_inep: valid.cod_inep, email: valid.email }, ['nome']],
  ])('rejeita %s', (_, input, field) => {
    expect(Validator.schoolValidator(input as any)).toEqual(field)
  })
})

describe('Validator.studentValidator', () => {
  const valid = {
    nome: 'João Silva',
    data_nascimento: '2015-05-10',
    municipio_nascimento: 'Belo Horizonte',
    uf_nascimento: 'MG',
  }

  it('aceita dados válidos', () => {
    expect(Validator.studentValidator(valid as any)).toBeNull()
  })

  it('rejeita data de nascimento no futuro', () => {
    expect(Validator.studentValidator({ ...valid, data_nascimento: '2999-01-01' } as any)).toEqual(['data_nascimento'])
  })

  it('rejeita CPF com tamanho diferente de 11', () => {
    expect(Validator.studentValidator({ ...valid, cpf: '123' } as any)).toEqual(['cpf'])
  })

  it('rejeita UF com mais de 2 letras', () => {
    expect(Validator.studentValidator({ ...valid, uf_nascimento: 'MGX' } as any)).toEqual(['uf_nascimento'])
  })
})

describe('Validator.gradeValidator', () => {
  it('rejeita nota acima de 10', () => {
    expect(Validator.gradeValidator({ nota: 11 } as any)).toEqual(['nota'])
  })

  it('rejeita mês fora do período letivo (3 a 11)', () => {
    expect(Validator.gradeValidator({ mes: 1 } as any)).toEqual(['mes'])
  })

  it('rejeita tipo desconhecido', () => {
    expect(Validator.gradeValidator({ tipo: 'bonus' } as any)).toEqual(['tipo'])
  })
})

describe('Validator.schoolClassValidator', () => {
  const valid = { nome: 'A', serie: 1, turno: 'manha', status: 'aberta' }

  it('aceita dados válidos', () => {
    expect(Validator.schoolClassValidator(valid as any)).toBeNull()
  })

  it('rejeita status desconhecido', () => {
    expect(Validator.schoolClassValidator({ ...valid, status: 'pendente' } as any)).toEqual(['status'])
  })

  // Comportamento atual: o nome da turma só pode ter exatamente 1 caractere (min(1).max(1)).
  it('rejeita nome de turma com mais de 1 caractere', () => {
    expect(Validator.schoolClassValidator({ ...valid, nome: '1A' } as any)).toEqual(['nome'])
  })
})

describe('Validator.teacherValidator', () => {
  const valid = { nome: 'Ana Souza', email: 'ana@exemplo.com', senha: 'segredo123', data_nascimento: '1990-01-01' }

  it('aceita dados válidos', () => {
    expect(Validator.teacherValidator(valid as any)).toBeNull()
  })

  it('rejeita senha curta', () => {
    expect(Validator.teacherValidator({ ...valid, senha: '123' } as any)).toEqual(['senha'])
  })
})
