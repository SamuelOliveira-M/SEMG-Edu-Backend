import { prisma } from "../../../lib/prisma"


class ReadTeacherModel{
	async readTeacherModel(email:string){
		
		const teacherAlreadyExists= await prisma.professor.findUnique({
			where: {
				email: email,
			},
		});
		
		if(!teacherAlreadyExists){
			console.log('Professor não existe')
			return;
		}

		const associacoes = await prisma.lotacao.findMany({
			where: {
				professorId: teacherAlreadyExists.id,
			},
			include: {
				turma:{
					select:{
						id:true,
						nome:true,
						serie:true,
						turno:true,
						status: true,						
					},
				}
			},
		});

		return associacoes
	}

	async readAllTeachersModel(){
		
		const teacherAlreadyExists= await prisma.professor.findMany();

		return teacherAlreadyExists
	}

	async readTeacher( id: string ) {
		
		const teachersClasses = await prisma.professor.findUnique({
			where:{
				id
			}
		})
	return teachersClasses
	}

	async loginTeacherModel(email:string){
		
		const teacher = await prisma.professor.findUnique({
			where: {
				email: email,
			}
		});

		return teacher
	}
}

export default new ReadTeacherModel()