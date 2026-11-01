interface IUser{	
	id:string
	nome: string,
	isAdmin:boolean
	accessToken : string
	idRefreshToken: string,
}
export default IUser