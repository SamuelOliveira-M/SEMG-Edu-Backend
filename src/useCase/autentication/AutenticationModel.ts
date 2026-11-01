import { compare } from "bcryptjs"
import { prisma } from "../../lib/prisma"
import CreateRefreshToken from "../refreshtoken/create/CreateRefreshToken"
import GenerateTokenProvider from "../../services/GenerateTokenProvider"
import IUser from "../../interface/IUser"

class AutenticationModel{
	async createAtentication(email:string ,senha:string){

		const teacherAlreadyExists = await prisma.professor.findFirst({
			where:{
				email
			}
		})

		if(teacherAlreadyExists){
		
			const passwordMatch = await compare(senha,teacherAlreadyExists.senha)

			if(!passwordMatch){
				throw new Error("User or password incorrect!")
			}

			const token = await GenerateTokenProvider.execute(
				teacherAlreadyExists.id,
				teacherAlreadyExists.nome,
				false
			)
			
			if(!token){
				throw new Error('Erro ao criar o token, Por favor tente novamente')
			}

			await prisma.refreshTokenProfessor.deleteMany({
				where:{
					professorId:teacherAlreadyExists.id
				}
			})

			const refreshToken = await CreateRefreshToken.execute(teacherAlreadyExists.id,false)

			if(!refreshToken){
				throw new Error('Erro ao criar o Refresh token, Por favor tente novamente')
			}
			
			const user:IUser = {
				id:teacherAlreadyExists.id,
				nome: teacherAlreadyExists.nome,
				isAdmin:false,
				accessToken: token,
				idRefreshToken: refreshToken.id,
			}

			return user
		}

		const headmistressAlreadyExists = await prisma.gestor.findFirst({
			where:{
				email
			}
		})

		if(!headmistressAlreadyExists){
			throw new Error("Email or password incorrect!")
		}

		const passwordMatch = await compare(senha,headmistressAlreadyExists.senha)

		if(!passwordMatch){
			throw new Error(" User or password incorrect!")
		}

		const token = await GenerateTokenProvider.execute(
			headmistressAlreadyExists.id,
			headmistressAlreadyExists.nome,
			true
		)
		
		if(!token){
			throw new Error ('Erro ao criar o token, Por favor tente novamente')
		}
		
		await prisma.refreshTokenGestor.deleteMany({
			where:{
				gestorId:headmistressAlreadyExists.id
			}	
		})

		const refreshToken = await CreateRefreshToken.execute(headmistressAlreadyExists.id,true)
		
		if(!refreshToken){
			throw new Error('Erro ao criar o Refresh token, Por favor tente novamente')
		}

		const user:IUser = {
			id:headmistressAlreadyExists.id,
			nome: headmistressAlreadyExists.nome,
			isAdmin:true,
			accessToken: token,
			idRefreshToken: refreshToken.id,
		}

		return user
	
	}
}

export default new AutenticationModel()