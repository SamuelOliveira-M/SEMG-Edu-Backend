// Popula o banco de dev com dados de exemplo. Idempotente: limpa as tabelas e recria.
// Uso: npm run db:seed
import { hash } from 'bcryptjs'
import { prisma } from '../src/lib/prisma'

async function main() {
  const url = process.env.DIRECT_URL ?? ''
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error('Seed só roda em banco local. DIRECT_URL atual: ' + url.replace(/:[^:@]*@/, ':***@'))
  }

  await prisma.$executeRawUnsafe(
    `TRUNCATE "Avaliacao","Aula","Calendario","Horario","Historico_Lotacao","Lotacao","refresh_token","refresh_token_professor","Gestor","Professor","Disciplina","Matricula","Turma","AnoLetivo","Escola","Aluno","Responsavel","Address" RESTART IDENTITY CASCADE`,
  )

  const senha = await hash('123456', 8)
  const ano = new Date().getFullYear()

  await prisma.gestor.create({ data: { nome: 'Gestor Admin', email: 'gestor@semg.edu', senha } })

  const profs = await Promise.all(
    ['Ana Souza', 'Carlos Lima', 'Marta Dias'].map((nome, i) =>
      prisma.professor.create({
        data: { nome, email: `prof${i + 1}@semg.edu`, senha, data_nascimento: new Date(`198${i}-03-15`) },
      }),
    ),
  )

  const disciplinas = await Promise.all(
    ['Português', 'Matemática', 'Ciências', 'História'].map((nome) =>
      prisma.disciplina.create({ data: { nome, carga_horaria: 80 } }),
    ),
  )

  const anoLetivo = await prisma.anoLetivo.create({ data: { data_inicio: new Date(`${ano}-02-01T00:00:00Z`) } })

  const escola = await prisma.escola.create({
    data: {
      nome: 'Escola Municipal Exemplo',
      cod_inep: '31000001',
      email: 'escola@semg.edu',
      address: { create: { rua: 'Rua das Flores, 100', cidade: 'Belo Horizonte', estado: 'MG', cep: '30110000' } },
    },
  })

  const turmas = await Promise.all(
    [
      { nome: '1º ano A - manhã', serie: 1, turno: 'manha' },
      { nome: '2º ano A - tarde', serie: 2, turno: 'tarde' },
    ].map((t) =>
      prisma.turma.create({ data: { ...t, status: 'aberta', escolaId: escola.id, ano_letivoId: anoLetivo.id } }),
    ),
  )

  const nomes = ['Lucas', 'Julia', 'Pedro', 'Beatriz', 'Gabriel', 'Laura', 'Mateus', 'Sofia']
  const matriculas = []
  for (const [i, nome] of nomes.entries()) {
    const aluno = await prisma.aluno.create({
      data: {
        nome: `${nome} Almeida`,
        data_nascimento: new Date(`201${i % 3}-0${(i % 9) + 1}-10`),
        municipio_nascimento: 'Contagem',
        uf_nascimento: 'MG',
        responsavel: { create: { nome_mae: `Mãe de ${nome}`, telefone: `3199999000${i}` } },
        address: { create: { rua: `Rua ${i + 1}, ${i * 10}`, cidade: 'Contagem', estado: 'MG' } },
      },
    })
    matriculas.push(
      await prisma.matricula.create({
        data: {
          numero_matricula: `${ano}${String(i + 1).padStart(4, '0')}`,
          status: 'ativo',
          alunoId: aluno.id,
          escolaId: escola.id,
          turmaId: turmas[i % 2].id,
        },
      }),
    )
  }

  const lotacoes = []
  for (const [t, turma] of turmas.entries()) {
    for (const [d, disciplina] of disciplinas.entries()) {
      lotacoes.push(
        await prisma.lotacao.create({
          data: { professorId: profs[(t + d) % profs.length].id, disciplinaId: disciplina.id, turmaId: turma.id },
        }),
      )
    }
  }

  const horarios = await Promise.all(
    [['07:00', '07:50'], ['07:50', '08:40'], ['09:00', '09:50'], ['09:50', '10:40']].map(([horarioInicio, horarioFim]) =>
      prisma.horario.create({ data: { horarioInicio, horarioFim } }),
    ),
  )
  const dias = await Promise.all(
    ['segunda', 'terça', 'quarta', 'quinta', 'sexta'].map((diaSemana, i) =>
      prisma.calendario.create({ data: { diaSemana, ordemSemana: i + 1 } }),
    ),
  )
  for (const [i, dia] of dias.entries()) {
    for (const [h, horario] of horarios.entries()) {
      await prisma.aula.create({
        data: { calendarioId: dia.id, horarioId: horario.id, lotacaoId: lotacoes[(i + h) % 4].id },
      })
    }
  }

  for (const m of matriculas) {
    for (const d of disciplinas) {
      for (const [semestre, mes] of [[1, 3], [1, 5], [2, 9]]) {
        await prisma.avaliacao.create({
          data: {
            tipo: 'prova',
            nota: Math.round((5 + Math.random() * 5) * 10) / 10,
            mes,
            semestre,
            anoLetivoId: anoLetivo.id,
            disciplinaId: d.id,
            matriculaId: m.id,
          },
        })
      }
    }
  }

  console.log('Seed concluído.')
  console.log('Logins (senha 123456): gestor@semg.edu | prof1@semg.edu | prof2@semg.edu | prof3@semg.edu')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
