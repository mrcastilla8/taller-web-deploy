const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// El navegador y el generador de evidencia ejecutan exactamente las mismas llamadas.
export async function runConcurrency({ baseUrl = '', kind = 'delay', onProgress = () => {} } = {}) {
  const start = performance.now()
  let slowDone = false
  const measure = async (path) => {
    const sentMs = Math.round(performance.now() - start)
    const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(15000) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`)
    const completedMs = Math.round(performance.now() - start)
    return {
      path, status: response.status, requestId: response.headers.get('X-Request-Id'),
      sentMs, completedMs, elapsedMs: completedMs - sentMs, data,
    }
  }
  const slowPath = kind === 'orm' ? '/api/demo/orm?iterations=3000000' : '/api/events?delayMs=3000'
  onProgress(`Iniciando ${slowPath}`)
  const slowPromise = measure(slowPath).finally(() => { slowDone = true })
  // El manejador evita rechazos sin atender mientras se consulta /health.
  slowPromise.catch(() => {})
  const counter = kind === 'orm' ? 'pendingQueries' : 'pendingDelays'
  let observed
  try {
    // La evidencia no presupone que el servidor ya recibió la petición lenta.
    while (performance.now() - start < 5000) {
      const health = await measure('/api/health')
      if (health.data[counter] > 0) { observed = health; break }
      if (slowDone) break
      await pause(20)
    }
    if (!observed) throw new Error('No se observó la petición en curso; vuelve a ejecutar la prueba.')
    onProgress(`El servidor confirma ${counter}=${observed.data[counter]}. Enviando peticiones rápidas…`)
    const paths = kind === 'orm' ? ['/api/health', '/api/categories']
      : ['/api/health', '/api/categories', '/api/events']
    const quick = await Promise.all(paths.map(async (path) => {
      const result = await measure(path)
      return { ...result, completedWhileWaiting: !slowDone }
    }))
    onProgress(`Respondieron ${quick.length} peticiones rápidas. Esperando el resultado lento…`)
    const slow = await slowPromise
    const summarize = (result) => ({
      ...result,
      data: Array.isArray(result.data) ? { items: result.data.length } : result.data,
    })
    const passed = quick.every((result) => result.completedWhileWaiting && result.completedMs < slow.completedMs)
      && (kind !== 'orm' || slow.data.timerTicks > 0)
    return {
      kind, passed, observed: summarize(observed),
      quick: quick.map(summarize), slow: summarize(slow),
    }
  } finally {
    await slowPromise.catch(() => {})
  }
}
