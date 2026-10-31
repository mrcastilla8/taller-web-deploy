import test from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from '../support/harness.js'

test('el microservicio expone /health y conserva /api/health sin servir React', async (t) => {
  const server = await startServer()
  t.after(() => server.close())
  for (const path of ['/health', '/api/health']) {
    const response = await fetch(server.baseUrl + path)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).status, 'ok')
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }
  const response = await fetch(server.baseUrl + '/eventos/1')
  assert.equal(response.status, 404)
  await response.arrayBuffer()
})

test('CORS permite el frontend configurado y su preflight, y rechaza otros orígenes', async (t) => {
  const origin = 'https://frontend.example'
  const server = await startServer({ appOptions: { allowedOrigins: [origin] } })
  t.after(() => server.close())
  const preflight = await fetch(server.baseUrl + '/api/student', {
    method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type,x-session-id' },
  })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin)
  assert.match(preflight.headers.get('access-control-allow-headers'), /X-Session-Id/)
  const allowed = await fetch(server.baseUrl + '/api/events', { headers: { Origin: origin } })
  assert.equal(allowed.status, 200)
  assert.equal(allowed.headers.get('access-control-allow-origin'), origin)
  await allowed.arrayBuffer()
  const denied = await fetch(server.baseUrl + '/api/student', { method: 'PUT', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}' })
  assert.equal(denied.status, 403)
  assert.equal(denied.headers.get('access-control-allow-origin'), null)
  await denied.arrayBuffer()
  assert.equal(await server.db.models.Student.count(), 0)
})
