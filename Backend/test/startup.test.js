import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'

test('HTTP y /health arrancan con PostgreSQL inaccesible y /api/ready devuelve 503 sin exponer credenciales', async (t) => {
  const reservation = createServer().listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise((resolve) => reservation.close(resolve))
  const child = spawn(process.execPath, [fileURLToPath(new URL('../src/server.js', import.meta.url))], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: 'postgresql://test:dummy-secret@127.0.0.1:1/test', DB_SSL: 'disable' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (value) => { output += value })
  child.stderr.on('data', (value) => { output += value })
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
  })
  let health
  for (let i = 0; i < 50; i++) {
    try { health = await fetch(`http://127.0.0.1:${port}/health`); break }
    catch { await pause(50) }
  }
  assert.ok(health, output)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).ready, false)
  const ready = await fetch(`http://127.0.0.1:${port}/api/ready`)
  assert.equal(ready.status, 503)
  await ready.arrayBuffer()
  assert.doesNotMatch(output, /dummy-secret/)
})
