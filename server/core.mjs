import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import defaultSiteConfig from '../src/data/siteConfig.js'

const defaultAccessoryRecords = JSON.parse(
  await readFile(new URL('../src/data/accessories.json', import.meta.url), 'utf8'),
)

const globalForPrisma = globalThis
export const prisma = globalForPrisma.__glowPrisma ?? new PrismaClient()
if (!globalForPrisma.__glowPrisma) {
  globalForPrisma.__glowPrisma = prisma
}

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

export function getApiInfo() {
  return { status: 200, body: { ok: true, service: 'Glow API' } }
}

export function getHealthStatus() {
  return { status: 200, body: { ok: true } }
}

export async function fetchAdminStatus(cookieHeader = '') {
  try {
    const credential = await prisma.adminCredential.findUnique({ where: { key: adminKey } })

    return {
      status: 200,
      body: {
        configured: Boolean(credential),
        authenticated: credential ? verifyAdminSession(cookieHeader, credential) : false,
      },
    }
  } catch (error) {
    console.error('Failed to check admin status.', error)
    return { status: 500, body: { error: 'Failed to check admin status.' } }
  }
}

export async function setupAdminPassword(password) {
  try {
    const existing = await prisma.adminCredential.findUnique({ where: { key: adminKey } })
    if (existing) {
      return { status: 409, body: { error: 'An admin password is already configured.' } }
    }

    if (String(password || '').length < 8) {
      return { status: 400, body: { error: 'Use at least 8 characters.' } }
    }

    const credential = await prisma.adminCredential.create({
      data: {
        key: adminKey,
        passwordHash: createPasswordHash(password),
      },
    })

    return {
      status: 201,
      body: { configured: true, authenticated: true },
      cookie: createAdminSessionCookie(credential),
    }
  } catch (error) {
    console.error('Failed to set the admin password.', error)
    return { status: 500, body: { error: 'Failed to save the admin password.' } }
  }
}

export async function loginAdminPassword(password) {
  try {
    const credential = await prisma.adminCredential.findUnique({ where: { key: adminKey } })
    if (!credential) {
      return { status: 409, body: { error: 'Admin password setup has not been completed yet.' } }
    }

    if (!verifyPassword(password, credential.passwordHash)) {
      return { status: 401, body: { error: 'Wrong password.' } }
    }

    return {
      status: 200,
      body: { configured: true, authenticated: true },
      cookie: createAdminSessionCookie(credential),
    }
  } catch (error) {
    console.error('Failed to log into admin.', error)
    return { status: 500, body: { error: 'Failed to log into admin.' } }
  }
}

export function logoutAdminSession() {
  return {
    status: 200,
    body: { ok: true },
    cookie: clearAdminSessionCookie(),
  }
}

export async function uploadAdminImage({ cookieHeader = '', payload = {} }) {
  try {
    const credential = await prisma.adminCredential.findUnique({ where: { key: adminKey } })
    if (!credential || !verifyAdminSession(cookieHeader, credential)) {
      return { status: 401, body: { error: 'Admin login required to upload images.' } }
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return {
        status: 500,
        body: {
          error: 'Supabase Storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY (and optionally SUPABASE_URL) on the server.',
        },
      }
    }

    const upload = normalizeImageUploadPayload(payload)
    const storagePath = buildStoragePath(upload.fileName, upload.contentType)
    const publicUrl = await uploadToSupabaseStorage({
      buffer: upload.buffer,
      contentType: upload.contentType,
      storagePath,
    })

    return {
      status: 201,
      body: {
        bucket: supabaseStorageBucket,
        path: storagePath,
        publicUrl,
      },
    }
  } catch (error) {
    console.error('Failed to upload admin image.', error)
    return { status: 500, body: { error: error instanceof Error ? error.message : 'Failed to upload image.' } }
  }
}

export async function fetchSiteContent() {
  try {
    const content = await getPrimarySiteContent()
    return { status: 200, body: content }
  } catch (error) {
    console.error('Failed to load site content.', error)
    return { status: 500, body: { error: 'Failed to load site content.' } }
  }
}

export async function saveSiteContent({ cookieHeader = '', payload = {} }) {
  try {
    const credential = await prisma.adminCredential.findUnique({ where: { key: adminKey } })
    if (!credential || !verifyAdminSession(cookieHeader, credential)) {
      return { status: 401, body: { error: 'Admin login required to save content.' } }
    }

    const nextContent = normalizeIncomingContent(payload)
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

    return { status: 200, body: normalizeStoredContent(saved) }
  } catch (error) {
    console.error('Failed to save site content.', error)
    return { status: 500, body: { error: 'Failed to save site content.' } }
  }
}

function createAdminSessionCookie(credential) {
  const token = signAdminSession({
    key: credential.key,
    exp: Date.now() + sessionDurationMs,
    version: credential.updatedAt.getTime(),
  })

  return serializeCookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionDurationMs,
    path: '/',
  })
}

function clearAdminSessionCookie() {
  return serializeCookie(sessionCookieName, '', {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  })
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`]

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge / 1000))}`)
  }

  if (options.path) {
    parts.push(`Path=${options.path}`)
  }

  if (options.httpOnly) {
    parts.push('HttpOnly')
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`)
  }

  if (options.secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
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

function verifyAdminSession(cookieHeader, credential) {
  const token = getCookieValue(cookieHeader, sessionCookieName)
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
