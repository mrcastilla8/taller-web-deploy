import assert from 'node:assert/strict'

if (!process.argv[2] || !process.argv[3]) throw new Error('Uso: node scripts/smoke-web.js <url-frontend> <url-backend>')
const frontend = new URL(process.argv[2]).origin
const backend = new URL(process.argv[3]).origin
assert.notEqual(frontend, backend, 'Frontend y backend deben tener orígenes distintos.')
for (const url of [frontend, backend]) {
  const target = new URL(url)
  if (target.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Las comprobaciones remotas requieren HTTPS.')
}
const read = (origin, path, options = {}) => fetch(new URL(path, origin), { ...options, signal: AbortSignal.timeout(20000) })
const home = await read(frontend, '/')
assert.equal(home.status, 200)
const html = await home.text()
assert.match(html, /<div id="root"><\/div>/)
for (const path of ['/eventos/1', '/mis-eventos']) {
  const response = await read(frontend, path)
  assert.equal(response.status, 200)
  assert.equal(await response.text(), html)
}
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)]
assert.ok(assets.length >= 2)
let apiConfigured = false
for (const match of assets) {
  const response = await read(frontend, match[1])
  assert.equal(response.status, 200)
  assert.doesNotMatch(response.headers.get('content-type') ?? '', /text\/html/)
  const content = await response.text()
  if (match[1].endsWith('.js') && content.includes(backend)) apiConfigured = true
}
assert.ok(apiConfigured, 'El JavaScript publicado debe apuntar al backend real.')
for (const [origin, path] of [[frontend, '/assets/absent.js'], [frontend, '/api/events'], [backend, '/eventos/1']]) {
  const response = await read(origin, path)
  assert.equal(response.status, 404)
  await response.arrayBuffer()
}
const health = await read(backend, '/health')
assert.equal(health.status, 200)
assert.equal((await health.json()).status, 'ok')
const preflight = await read(backend, '/api/student', {
  method: 'OPTIONS', headers: { Origin: frontend, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type,x-session-id' },
})
assert.equal(preflight.status, 204)
assert.equal(preflight.headers.get('access-control-allow-origin'), frontend)
const events = await read(backend, '/api/events', { headers: { Origin: frontend } })
assert.equal(events.status, 200)
assert.equal(events.headers.get('access-control-allow-origin'), frontend)
assert.ok((await events.json()).length > 0)
const denied = await read(backend, '/api/events', { headers: { Origin: 'https://untrusted.example' } })
assert.equal(denied.status, 403)
assert.equal(denied.headers.get('access-control-allow-origin'), null)
await denied.arrayBuffer()
console.log('Frontend y backend independientes, /health, rutas React, API real y CORS: verificados.')
