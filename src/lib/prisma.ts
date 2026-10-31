import 'dotenv/config';

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

if (!process.env.DIRECT_URL) {
  throw new Error('DIRECT_URL não definida: configure o .env (ou .env.test nos testes)')
}

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL,
})

export const prisma = new PrismaClient({adapter});
