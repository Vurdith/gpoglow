import 'dotenv/config'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import cors from 'cors'
import express from 'express'
import { PrismaClient } from '@prisma/client'
import defaultSiteConfig from '../src/data/siteConfig.js'

const defaultAccessoryRecords = JSON.parse(
  await readFile(new URL('../src/data/accessories.json', import.meta.url), 'utf8'),
)

const prisma = new PrismaClient()
const app = express()
const port = Number(process.env.PORT || 8787)
const adminKey = 'primary'
const sessionCookieName = 'glow_admin_session'
const sessionDurationMs = 1000 * 60 * 60 * 24 * 14
const sessionSecret = process.env.ADMIN_SESSION_SECRET || randomBytes(32).toString('hex')
const supabaseProjectRef = getSupabaseProjectRef()
const supabaseUrl = process.env.SUPABASE_URL || (supabaseProjectRef ? `https://${supabaseProjectRef}.supabase.co` : '')
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'glow-images'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!process.env.ADMIN_SESSION_SECRET) {
  console.warn('ADMIN_SESSION_SECRET is not set. Admin sessions will reset when the API restarts.')
}

await ensureTables()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '25mb' }))

app.get('/', (_request, response) => {
  response.type('html').send(`
    <html>
      <body style="font-family: Inter, system-ui, sans-serif; background: #0b0d12; color: #f3f5f8; padding: 32px;">
        <h1 style="margin: 0 0 12px;">Glow API is running</h1>
        <p style="margin: 0 0 12px; color: #a4acbb;">This port is the backend API, not the frontend app.</p>
        <ul>
          <li>Frontend: <a href="http://localhost:5173" style="color: #75a7ff;">http://localhost:5173</a></li>
          <li>Health: <a href="/api/health" style="color: #75a7ff;">/api/health</a></li>
          <li>Content: <a href="/api/site-content" style="color: #75a7ff;">/api/site-content</a></li>
          <li>Admin status: <a href="/api/admin/status" style="color: #75a7ff;">/api/admin/status</a></li>
        </ul>
      </body>
    </html>
  `)
})

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.get('/api/admin/status', async (request, response) => {
  try {
    const credential = await prisma.adminCredential.findUnique({ where: { key: adminKey } })

    response.json({
      configured: Boolean(credential),
      authenticated: credential ? verifyAdminSession(request, credential) : false,
    })
  } catch (error) {
    console.error('Failed to check admin status.', error)
    response.status(500).json({ error: 'Failed to check admin status.' })
  }
})

app.post('/api/admin/setup', async (request, response) => {
  try {
    const existing = await prisma.adminCredential.findUnique({ where: { key: adminKey } })
    if (existing) {
      response.status(409).json({ error: 'An admin password is already configured.' })
      return
    }

    const password = String(request.body?.password || '')
    if (password.length < 8) {
      response.status(400).json({ error: 'Use at least 8 characters.' })
      return
    }

    const credential = await prisma.adminCredential.create({
      data: {
        key: adminKey,
        passwordHash: createPasswordHash(password),
      },
    })

    setAdminSession(response, credential)
    response.status(201).json({ configured: true, authenticated: true })
  } catch (error) {
    console.error('Failed to set the admin password.', error)
    response.status(500).json({ error: 'Failed to save the admin password.' })
  }
})

app.post('/api/admin/login', async (request, response) => {
  try {
    const credential = await prisma.adminCredential.findUnique({ where: { key: adminKey } })
    if (!credential) {
      response.status(409).json({ error: 'Admin password setup has not been completed yet.' })
      return
    }

    const password = String(request.body?.password || '')
    if (!verifyPassword(password, credential.passwordHash)) {
      response.status(401).json({ error: 'Wrong password.' })
      return
    }

    setAdminSession(response, credential)
    response.json({ configured: true, authenticated: true })
  } catch (error) {
    console.error('Failed to log into admin.', error)
    response.status(500).json({ error: 'Failed to log into admin.' })
  }
})

app.post('/api/admin/logout', (_request, response) => {
  clearAdminSession(response)
  response.json({ ok: true })
})

app.post('/api/admin/images', async (request, response) => {
  try {
    const credential = await prisma.adminCredential.findUnique({ where: { key: adminKey } })
    if (!credential || !verifyAdminSession(request, credential)) {
      response.status(401).json({ error: 'Admin login required to upload images.' })
      return
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      response.status(500).json({
        error: 'Supabase Storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY (and optionally SUPABASE_URL) on the server.',
      })
      return
    }

    const upload = normalizeImageUploadPayload(request.body)
    const storagePath = buildStoragePath(upload.fileName, upload.contentType)
    const publicUrl = await uploadToSupabaseStorage({
      buffer: upload.buffer,
      contentType: upload.contentType,
      storagePath,
    })

    response.status(201).json({
      bucket: supabaseStorageBucket,
      path: storagePath,
      publicUrl,
    })
  } catch (error) {
    console.error('Failed to upload admin image.', error)
    response.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upload image.' })
  }
})

app.get('/api/site-content', async (_request, response) => {
  try {
    const content = await getPrimarySiteContent()
    response.json(content)
  } catch (error) {
    console.error('Failed to load site content.', error)
    response.status(500).json({ error: 'Failed to load site content.' })
  }
})

app.put('/api/site-content', async (request, response) => {
  try {
    const credential = await prisma.adminCredential.findUnique({ where: { key: adminKey } })
    if (!credential || !verifyAdminSession(request, credential)) {
      response.status(401).json({ error: 'Admin login required to save content.' })
      return
    }

    const nextContent = normalizeIncomingContent(request.body)
    const saved = await prisma.siteContent.upsert({
      where: { key: 'primary' },
      update: {
        siteConfig: nextContent.siteConfig,
        accessoryRecords: nextContent.accessoryRecords,
      },
      create: {
        key: 'primary',
        siteConfig: nextContent.siteConfig,
        accessoryRecords: nextContent.accessoryRecords,
      },
    })

    response.json(normalizeStoredContent(saved))
  } catch (error) {
    console.error('Failed to save site content.', error)
    response.status(500).json({ error: 'Failed to save site content.' })
  }
})

app.listen(port, () => {
  console.log(`Glow API listening on http://localhost:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SiteContent" (
      "key" TEXT NOT NULL,
      "siteConfig" JSONB NOT NULL,
      "accessoryRecords" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("key")
    );
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminCredential" (
      "key" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "AdminCredential_pkey" PRIMARY KEY ("key")
    );
  `)
}

async function getPrimarySiteContent() {
  const existing = await prisma.siteContent.findUnique({ where: { key: 'primary' } })
  if (existing) {
    return normalizeStoredContent(existing)
  }

  const created = await prisma.siteContent.create({
    data: {
      key: 'primary',
      siteConfig: cloneValue(defaultSiteConfig),
      accessoryRecords: cloneValue(defaultAccessoryRecords),
    },
  })

  return normalizeStoredContent(created)
}

function setAdminSession(response, credential) {
  const token = signAdminSession({
    key: credential.key,
    exp: Date.now() + sessionDurationMs,
    version: credential.updatedAt.getTime(),
  })

  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionDurationMs,
    path: '/',
  })
}

function clearAdminSession(response) {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}

function verifyAdminSession(request, credential) {
  const token = getCookieValue(request.headers.cookie, sessionCookieName)
  if (!token) return false

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false

  const expectedSignature = signValue(payload)
  if (!safeEqual(signature, expectedSignature)) return false

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))

    return (
      parsed.key === credential.key &&
      Number.isFinite(parsed.exp) &&
      parsed.exp > Date.now() &&
      parsed.version === credential.updatedAt.getTime()
    )
  } catch {
    return false
  }
}

function signAdminSession(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${signValue(encodedPayload)}`
}

function signValue(value) {
  return createHmac('sha256', sessionSecret).update(value).digest('base64url')
}

function createPasswordHash(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || '').split(':')
  if (!salt || !hash) return false

  const attempt = scryptSync(password, salt, 64).toString('hex')
  return safeEqual(hash, attempt)
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function getCookieValue(cookieHeader = '', name) {
  const cookies = cookieHeader.split(';')

  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split('=')
    if (rawName === name) {
      return rest.join('=')
    }
  }

  return null
}

function normalizeIncomingContent(payload = {}) {
  return {
    siteConfig: normalizeSiteConfig(payload.siteConfig),
    accessoryRecords: normalizeAccessoryRecords(payload.accessoryRecords),
  }
}

function normalizeStoredContent(record) {
  return {
    siteConfig: normalizeSiteConfig(record.siteConfig),
    accessoryRecords: normalizeAccessoryRecords(record.accessoryRecords),
  }
}

function normalizeSiteConfig(value) {
  return {
    ...cloneValue(defaultSiteConfig),
    ...(isPlainObject(value) ? value : {}),
  }
}

function normalizeAccessoryRecords(value) {
  return Array.isArray(value) ? cloneValue(value) : cloneValue(defaultAccessoryRecords)
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function normalizeImageUploadPayload(payload = {}) {
  const dataUrl = String(payload.dataUrl || '')
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Upload payload must include an image data URL.')
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) {
    throw new Error('Unsupported image payload format.')
  }

  const [, contentType, base64] = match
  return {
    fileName: String(payload.fileName || 'accessory-image'),
    contentType,
    buffer: Buffer.from(base64, 'base64'),
  }
}

function buildStoragePath(fileName, contentType) {
  const extension = getImageExtension(contentType)
  const safeFileName = slugifyFileName(fileName) || 'accessory-image'
  return `accessories/${Date.now()}-${randomBytes(6).toString('hex')}-${safeFileName}.${extension}`
}

async function uploadToSupabaseStorage({ buffer, contentType, storagePath }) {
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(supabaseStorageBucket)}/${encodeStoragePath(storagePath)}`
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      apikey: supabaseServiceRoleKey,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'cache-control': '31536000',
    },
    body: buffer,
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    throw new Error(errorText || 'Supabase Storage rejected the upload.')
  }

  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(supabaseStorageBucket)}/${encodeStoragePath(storagePath)}`
}

function encodeStoragePath(storagePath) {
  return storagePath.split('/').map(encodeURIComponent).join('/')
}

function getImageExtension(contentType) {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }

  return map[contentType] || 'png'
}

function slugifyFileName(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getSupabaseProjectRef() {
  for (const value of [process.env.SUPABASE_URL, process.env.DIRECT_URL, process.env.DATABASE_URL]) {
    if (!value) continue

    try {
      const parsed = new URL(value)
      const host = parsed.hostname
      const directMatch = host.match(/^db\.([^.]+)\.supabase\.co$/i)
      if (directMatch) return directMatch[1]

      const poolerMatch = host.match(/^aws-[^.]+\.pooler\.supabase\.com$/i)
      if (poolerMatch) {
        const usernameMatch = parsed.username.match(/^postgres\.([^.]+)$/i)
        if (usernameMatch) return usernameMatch[1]
      }

      const urlMatch = host.match(/^([^.]+)\.supabase\.co$/i)
      if (urlMatch) return urlMatch[1]
    } catch {
      // ignore malformed env values
    }
  }

  return ''
}
