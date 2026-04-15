import serverless from 'serverless-http'
import { apiApp } from '../server/api.mjs'

const handler = serverless(apiApp)

export default function vercelApiHandler(request, response) {
  const originalUrl = request.url || '/'
  request.url = originalUrl.startsWith('/api') ? originalUrl.slice(4) || '/' : originalUrl
  return handler(request, response)
}
