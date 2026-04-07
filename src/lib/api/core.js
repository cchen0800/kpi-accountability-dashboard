const BASE = '/api'
const DEFAULT_TIMEOUT = 30000
const MAX_RETRIES = 2
const BASE_BACKOFF = 300

export async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

export async function get(path, { retries = MAX_RETRIES, timeout = DEFAULT_TIMEOUT } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(`${BASE}${path}`, {}, timeout)
      if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
      return res.json()
    } catch (e) {
      lastError = e
      if (attempt < retries) {
        const jitter = Math.random() * 0.5 + 0.75
        const delay = BASE_BACKOFF * Math.pow(2, attempt) * jitter
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}

export async function post(path, body, { timeout = DEFAULT_TIMEOUT } = {}) {
  const res = await fetchWithTimeout(
    `${BASE}${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    },
    timeout,
  )
  if (res.status === 409) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data.error || 'Pipeline already running')
    err.status = 409
    throw err
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `API ${res.status}: ${path}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return { ok: true }
  return res.json()
}
