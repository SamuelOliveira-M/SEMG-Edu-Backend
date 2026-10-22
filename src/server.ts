import 'express-async-errors';
import { errorHandler } from './middlewares/errorHandler';
import express,{Request,Response,NextFunction} from 'express'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import swaggerDocs from './swagger.json'
import dotenv from "dotenv";
import admin from "firebase-admin";
import path from 'path';
import * as fs from 'fs';
import cors from 'cors';


import studentRoutes from './routes/studentRoutes';
import schoolRoutes from './routes/schoolRoutes';
import teacherRoutes from './routes/teacherRoutes';
import { formatPrivateKey } from './services/formatPrivateKey';

dotenv.config();

const serviceAccount = {
  "type": process.env.type,
  "project_id":process.env.project_id,
  "private_key_id": process.env.private_key_id,
  "private_key":formatPrivateKey(process.env.private_key),
  "client_email":process.env.client_email ,
  "client_id": process.env.client_id,
  "auth_uri": process.env.auth_uri,
  "token_uri": process.env.token_uri,
  "auth_provider_x509_cert_url":process.env.auth_provider_x509_cert_url,
  "client_x509_cert_url":process.env.client_x509_cert_url, 
  "universe_domain": process.env.universe_domain
} as admin.ServiceAccount ;

const BUCKET = process.env.FIREBASE_STORAGE_BUCKET;

// Initialize Firebase
admin.initializeApp({
  credential:admin.credential.cert(serviceAccount),
  storageBucket: BUCKET
});


const app = express()
const port = process.env.PORT || 3333

app.use(cors());

app.options('*', cors());


app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(morgan('dev'))

app.use('/docs',swaggerUi.serve,swaggerUi.setup(swaggerDocs))

app.use(studentRoutes)
app.use(schoolRoutes)
app.use(teacherRoutes)

app.get('/',(req,res)=>{
  res.status(200).send('<h1>EstÃƒÂ¡ Online</h1>')
})

app.use(errorHandler)

app.listen(port,()=>{
  console.log(`AplicaÃƒÂ§ÃƒÂ£o online na porta ${port}`)
})
