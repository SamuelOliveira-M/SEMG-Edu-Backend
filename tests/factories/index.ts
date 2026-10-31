import { prisma } from '../setup/db'

let seq = 0
const next = () => ++seq

export async function createSchool(overrides: Partial<{ nome: string; cod_inep: string; email: string }> = {}) {
  const n = next()
  const address = await prisma.address.create({
    data: { rua: `rua ${n}`, cidade: 'belo horizonte', estado: 'mg', cep: `3000${String(n).padStart(4, '0')}` },
  })

  return prisma.escola.create({
    data: {
      nome: overrides.nome ?? `Escola ${n}`,
      cod_inep: overrides.cod_inep ?? String(10000000 + n),
      email: overrides.email ?? `escola${n}@exemplo.com`,
      addressId: address.id,
    },
  })
}

export const currentYear = new Date().getFullYear()

export async function createSchoolYear(year = currentYear) {
  return prisma.anoLetivo.create({ data: { data_inicio: new Date(`${year}-06-01T00:00:00Z`) } })
}

export async function createClass(escolaId: string, anoLetivoId: string, nome = '1º ano A - manha') {
  return prisma.turma.create({
    data: { nome: `${nome} #${next()}`, serie: 1, turno: 'manha', status: 'aberta', escolaId, ano_letivoId: anoLetivoId },
  })
}

export async function createSubject(nome = `Disciplina ${next()}`) {
  return prisma.disciplina.create({ data: { nome, carga_horaria: 80 } })
}

export async function createStudent(nome = `Aluno ${next()}`) {
  const n = next()
  const responsavel = await prisma.responsavel.create({ data: { nome_mae: `Mãe ${n}` } })
  const address = await prisma.address.create({ data: { rua: `rua aluno ${n}`, cidade: 'contagem', estado: 'mg' } })

  return prisma.aluno.create({
    data: {
      nome,
      data_nascimento: new Date('2015-05-10'),
      municipio_nascimento: 'Contagem',
      uf_nascimento: 'MG',
      responsavelId: responsavel.id,
      addressId: address.id,
    },
  })
}

export async function createRegistration(alunoId: string, escolaId: string, turmaId: string) {
  return prisma.matricula.create({
    data: { numero_matricula: `2026${next()}`, status: 'ativo', alunoId, escolaId, turmaId },
  })
}

/** Escola + ano letivo + turma + aluno matriculado + disciplina, pronto para testes de notas. */
export async function createEnrolledStudent() {
  const escola = await createSchool()
  const ano = await createSchoolYear()
  const turma = await createClass(escola.id, ano.id)
  const aluno = await createStudent()
  const matricula = await createRegistration(aluno.id, escola.id, turma.id)
  const disciplina = await createSubject()

  return { escola, ano, turma, aluno, matricula, disciplina }
}

export async function createTeacher(nome = `Professor ${next()}`) {
  const n = next()
  return prisma.professor.create({
    data: { nome, email: `prof${n}@exemplo.com`, senha: 'hash-qualquer', data_nascimento: new Date('1990-01-01') },
  })
}

export async function createAllocation(professorId: string, disciplinaId: string, turmaId: string) {
  return prisma.lotacao.create({ data: { professorId, disciplinaId, turmaId } })
}

/** Escola + turma + professor + disciplina + lotação (professor lecionando a disciplina na turma). */
export async function createAllocationSetup() {
  const escola = await createSchool()
  const ano = await createSchoolYear()
  const turma = await createClass(escola.id, ano.id)
  const professor = await createTeacher()
  const disciplina = await createSubject()
  const lotacao = await createAllocation(professor.id, disciplina.id, turma.id)

  return { escola, ano, turma, professor, disciplina, lotacao }
}
