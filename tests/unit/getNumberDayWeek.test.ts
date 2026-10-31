import { describe, it, expect } from 'vitest'
import { getNumberDayWeek } from '../../src/services/obterNumeroDiaSemana'

describe('getNumberDayWeek', () => {
  it.each([
    ['segunda', 1],
    ['terça', 2],
    ['quarta', 3],
    ['quinta', 4],
    ['sexta', 5],
    ['sabado', 6],
    ['domingo', 7],
  ])('%s -> %i', (dia, numero) => {
    expect(getNumberDayWeek(dia)).toBe(numero)
  })

  it('ignora maiúsculas/minúsculas', () => {
    expect(getNumberDayWeek('SEGUNDA')).toBe(1)
    expect(getNumberDayWeek('Sexta')).toBe(5)
  })

  it('retorna undefined para dia desconhecido', () => {
    expect(getNumberDayWeek('feriado')).toBeUndefined()
  })

  // Comportamento atual: só a grafia exata do enum é aceita ("terça" com cedilha, "sabado" sem acento).
  it('não aceita grafias alternativas (terca / sábado)', () => {
    expect(getNumberDayWeek('terca')).toBeUndefined()
    expect(getNumberDayWeek('sábado')).toBeUndefined()
  })
})
