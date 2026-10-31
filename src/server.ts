import dotenv from "dotenv";
import admin from "firebase-admin";
import { formatPrivateKey } from './services/formatPrivateKey';
import app from './app';

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


const port = process.env.PORT || 3333

app.listen(port,()=>{
  console.log(`Aplicação online na porta ${port}`)
})
