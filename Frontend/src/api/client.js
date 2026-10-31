export function createApi({
  baseUrl = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:3001',
  storage = globalThis.localStorage,
  fetcher = globalThis.fetch,
} = {}) {
  const base = baseUrl.replace(/\/$/, '')
  let sessionId = storage.getItem('edu_session_id')
  if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    sessionId = crypto.randomUUID()
    storage.setItem('edu_session_id', sessionId)
  }
  return async (path, method = 'GET', body) => {
    const response = await fetcher(`${base}/api${path}`, {
      method,
      headers: { 'X-Session-Id': sessionId, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? `Error HTTP ${response.status}`)
    return data
  }
}
