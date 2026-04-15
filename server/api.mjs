import cors from 'cors'
import express from 'express'
import {
  fetchAdminStatus,
  fetchSiteContent,
  getApiInfo,
  getHealthStatus,
  loginAdminPassword,
  logoutAdminSession,
  prisma,
  saveSiteContent,
  setupAdminPassword,
  uploadAdminImage,
} from './core.mjs'

export const apiApp = express()
export { prisma }

apiApp.disable('x-powered-by')
apiApp.set('trust proxy', 1)
apiApp.use(cors({ origin: true, credentials: true }))
apiApp.use(express.json({ limit: '25mb' }))

apiApp.get('/', (_request, response) => {
  sendResult(response, getApiInfo())
})

apiApp.get('/health', (_request, response) => {
  sendResult(response, getHealthStatus())
})

apiApp.get('/admin/status', async (request, response) => {
  sendResult(response, await fetchAdminStatus(request.headers.cookie || ''))
})

apiApp.post('/admin/setup', async (request, response) => {
  sendResult(response, await setupAdminPassword(request.body?.password))
})

apiApp.post('/admin/login', async (request, response) => {
  sendResult(response, await loginAdminPassword(request.body?.password))
})

apiApp.post('/admin/logout', (_request, response) => {
  sendResult(response, logoutAdminSession())
})

apiApp.post('/admin/images', async (request, response) => {
  sendResult(response, await uploadAdminImage({ cookieHeader: request.headers.cookie || '', payload: request.body }))
})

apiApp.get('/site-content', async (_request, response) => {
  sendResult(response, await fetchSiteContent())
})

apiApp.put('/site-content', async (request, response) => {
  sendResult(response, await saveSiteContent({ cookieHeader: request.headers.cookie || '', payload: request.body }))
})

function sendResult(response, result) {
  if (result.cookie) {
    response.setHeader('Set-Cookie', result.cookie)
  }

  response.status(result.status).json(result.body)
}
