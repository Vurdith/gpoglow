import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const result = await prisma.$queryRawUnsafe('SELECT 1 as ok')
  console.log(JSON.stringify(result))
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
