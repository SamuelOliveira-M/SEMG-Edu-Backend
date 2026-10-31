import { prisma } from "../../../lib/prisma";
import ITeacher from "../../../interface/ITeacher";
import { hash } from "bcryptjs";
import ReadTeacherModel from "../read/ReadTeacherModel";


class CreateTeacherModel{
	async createTeacherModel(dataTeacher:ITeacher) {
		const {     
			nome,
			email,
			senha,
			data_nascimento,  
			url_image 
		
		} = dataTeacher

		const dataNascimento = new Date(data_nascimento)
		
		const teacherAlreadyExists= await ReadTeacherModel.readTeacherModel(email)

		if (teacherAlreadyExists) {
			return {
				"message":"Professor já existe no sistema", 
				"data":teacherAlreadyExists
			}
		}

		const passwordHash = await hash(senha,8)

		const teacher = await prisma.professor.create({
			data:{
				nome, 
				email,
				senha:passwordHash,
				data_nascimento:dataNascimento,  
				url_image
			}
		})
		
		return {
			"message":"Disciplina criado com sucesso",	
			"data":teacher
		}
	}
}

export default new CreateTeacherModel()