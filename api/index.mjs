import {
  fetchAdminStatus,
  fetchSiteContent,
  getApiInfo,
  getHealthStatus,
  loginAdminPassword,
  logoutAdminSession,
  saveSiteContent,
  setupAdminPassword,
  uploadAdminImage,
} from '../server/core.mjs'

export default async function handler(request, response) {
  const url = new URL(request.url || '/', 'http://localhost')
  const pathname = url.pathname.startsWith('/api') ? url.pathname.slice(4) || '/' : url.pathname || '/'
  const method = String(request.method || 'GET').toUpperCase()
  const cookieHeader = request.headers?.cookie || ''
  const body = await readBody(request)

  let result

  if (method === 'GET' && pathname === '/') {
    result = getApiInfo()
  } else if (method === 'GET' && pathname === '/health') {
    result = getHealthStatus()
  } else if (method === 'GET' && pathname === '/admin/status') {
    result = await fetchAdminStatus(cookieHeader)
  } else if (method === 'POST' && pathname === '/admin/setup') {
    result = await setupAdminPassword(body?.password)
  } else if (method === 'POST' && pathname === '/admin/login') {
    result = await loginAdminPassword(body?.password)
  } else if (method === 'POST' && pathname === '/admin/logout') {
    result = logoutAdminSession()
  } else if (method === 'POST' && pathname === '/admin/images') {
    result = await uploadAdminImage({ cookieHeader, payload: body })
  } else if (method === 'GET' && pathname === '/site-content') {
    result = await fetchSiteContent()
  } else if (method === 'PUT' && pathname === '/site-content') {
    result = await saveSiteContent({ cookieHeader, payload: body })
  } else {
    result = { status: 404, body: { error: 'Route not found.' } }
  }

  if (result.cookie) {
    response.setHeader('Set-Cookie', result.cookie)
  }

  response.statusCode = result.status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(result.body))
}

async function readBody(request) {
  if (request.body && typeof request.body === 'object') {
    return request.body
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    return {}
  }

  const chunks = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  if (!chunks.length) {
    return {}
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
