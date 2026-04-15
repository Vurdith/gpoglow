import express from 'express'
import { apiApp, prisma } from './api.mjs'

export const app = express()
export const port = Number(process.env.PORT || 8787)
export { prisma }

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.get('/', (_request, response) => {
  response.type('html').send(`
    <html>
      <body style="font-family: Inter, system-ui, sans-serif; background: #0b0d12; color: #f3f5f8; padding: 32px;">
        <h1 style="margin: 0 0 12px;">Glow API is running</h1>
        <p style="margin: 0 0 12px; color: #a4acbb;">This port is the backend API, not the frontend app.</p>
        <ul>
          <li>Health: <a href="/api/health" style="color: #75a7ff;">/api/health</a></li>
          <li>Content: <a href="/api/site-content" style="color: #75a7ff;">/api/site-content</a></li>
          <li>Admin status: <a href="/api/admin/status" style="color: #75a7ff;">/api/admin/status</a></li>
        </ul>
      </body>
    </html>
  `)
})

app.use('/api', apiApp)
