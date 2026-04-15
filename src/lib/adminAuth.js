const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'
const ADMIN_STATUS_ENDPOINT = `${API_BASE_URL}/api/admin/status`
const ADMIN_SETUP_ENDPOINT = `${API_BASE_URL}/api/admin/setup`
const ADMIN_LOGIN_ENDPOINT = `${API_BASE_URL}/api/admin/login`
const ADMIN_LOGOUT_ENDPOINT = `${API_BASE_URL}/api/admin/logout`

export async function fetchAdminStatus() {
  const response = await fetch(ADMIN_STATUS_ENDPOINT, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Could not check admin status.')
  }

  return response.json()
}

export async function setAdminPassword(password) {
  const response = await fetch(ADMIN_SETUP_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ password }),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(payload.error || 'Could not save the admin password.')
  }

  return payload
}

export async function verifyAdminPassword(password) {
  const response = await fetch(ADMIN_LOGIN_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ password }),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(payload.error || 'Wrong password.')
  }

  return true
}

export async function lockAdminSession() {
  await fetch(ADMIN_LOGOUT_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}
