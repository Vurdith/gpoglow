const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const SITE_CONTENT_ENDPOINT = `${API_BASE_URL}/api/site-content`
const ADMIN_IMAGE_ENDPOINT = `${API_BASE_URL}/api/admin/images`

export async function fetchRemoteSiteContent() {
  const response = await fetch(SITE_CONTENT_ENDPOINT, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(payload.error || 'Could not load saved content from the database.')
  }

  return payload
}

export async function saveRemoteSiteContent(content) {
  const response = await fetch(SITE_CONTENT_ENDPOINT, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(content),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(payload.error || 'Could not save content to the database.')
  }

  return payload
}

export async function uploadAdminImage({ dataUrl, fileName }) {
  const response = await fetch(ADMIN_IMAGE_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ dataUrl, fileName }),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(payload.error || 'Could not upload image to Supabase Storage.')
  }

  return payload
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}
