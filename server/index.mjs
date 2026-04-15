import 'dotenv/config'
import { app, port, prisma } from './app.mjs'

const server = app.listen(port, () => {
  console.log(`Glow API listening on http://localhost:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    server.close(async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
  })
}
