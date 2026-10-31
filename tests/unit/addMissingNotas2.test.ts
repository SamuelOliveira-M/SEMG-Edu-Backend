import { describe, it, expect } from 'vitest'
import { addMissingNotas2 } from '../../src/services/organizingStudentPerformanceSheet'

const grade = (mes: number, nota: number) => ({ id: `g${mes}`, mes, nota, semestre: 1, tipo: 'normal' })
const sheet = (avaliacao: any[]) => [{ id: 'd1', nome: 'Matemática', avaliacao }] as any

describe('addMissingNotas2', () => {
  it('completa os meses 3 a 13 com notas zero', () => {
    const [result] = addMissingNotas2(sheet([grade(3, 8), grade(4, 6)]), 13)

    expect(result.avaliacao.map((a) => a.mes)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(result.avaliacao.find((a) => a.mes === 5)).toMatchObject({ id: null, nota: 0 })
  })

  it('usa tipos próprios para as recuperações e a prova final ausentes', () => {
    const [result] = addMissingNotas2(sheet([grade(3, 8)]), 13)
    const tipoDe = (mes: number) => result.avaliacao.find((a) => a.mes === mes)?.tipo

    expect(tipoDe(7)).toBe('1 Recuperação')
    expect(tipoDe(12)).toBe('2 Recuperação')
    expect(tipoDe(13)).toBe('Prova final')
  })

  it('calcula a média só sobre as notas lançadas e mantém o aluno "Cursando"', () => {
    const [result] = addMissingNotas2(sheet([grade(3, 8), grade(4, 6)]), 13) as any

    expect(result.media).toBe(7)
    expect(result.status).toBe('Cursando')
  })

  it('com 11 notas lançadas decide Aprovado/Reprovado pela média', () => {
    const todas = (nota: number) => [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((m) => grade(m, nota))

    expect((addMissingNotas2(sheet(todas(8)), 13)[0] as any).status).toBe('Aprovado')
    expect((addMissingNotas2(sheet(todas(4)), 13)[0] as any).status).toBe('Reprovado')
  })

  it('média vira NaN quando não há nenhuma nota (0/0)', () => {
    const [result] = addMissingNotas2(sheet([]), 13) as any

    expect(result.media).toBeNaN()
  })
})
