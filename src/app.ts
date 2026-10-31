import express,{Request,Response,NextFunction} from 'express'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import swaggerDocs from './swagger.json'
import cors from 'cors';

import studentRoutes from './routes/studentRoutes';
import schoolRoutes from './routes/schoolRoutes';
import teacherRoutes from './routes/teacherRoutes';

const app = express()

app.use(cors());

app.options('*', cors());

app.use(express.json())
app.use(express.urlencoded({extended:true}))

if(process.env.NODE_ENV !== 'test'){
  app.use(morgan('dev'))
}

app.use('/docs',swaggerUi.serve,swaggerUi.setup(swaggerDocs))

app.use(studentRoutes)
app.use(schoolRoutes)
app.use(teacherRoutes)

app.get('/',(req,res)=>{
  res.status(200).send('<h1>Está Online</h1>')
})

app.use((error:Error,request:Request,response:Response,next:NextFunction)=>{
  response.json({
    status:"error",
    message:error.message
  });
  next()
})

export default app
