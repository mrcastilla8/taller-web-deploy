import assert from 'node:assert/strict'
import { startServer } from '../support/harness.js'

const local = process.argv[2] ? null : await startServer()
const target = new URL(process.argv[2] ?? local.baseUrl)
const base = target.origin
try {
  if (target.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(target.hostname)) {
    throw new Error('La comprobación remota requiere HTTPS.')
  }
  const read = (path = '/') => fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) })
  const home = await read()
  assert.equal(home.status, 200)
  const html = await home.text()
  assert.match(html, /<div id="root"><\/div>/)
  for (const path of ['/eventos/1', '/mis-eventos']) {
    const response = await read(path)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), html)
  }
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)]
  assert.ok(assets.length >= 2, 'La web debe incluir sus archivos JS y CSS compilados.')
  for (const match of assets) {
    const response = await read(match[1])
    assert.equal(response.status, 200)
    assert.doesNotMatch(response.headers.get('content-type') ?? '', /text\/html/)
    await response.arrayBuffer()
  }
  for (const path of ['/assets/absent.js', '/api/absent']) {
    const response = await read(path)
    assert.equal(response.status, 404)
    await response.arrayBuffer()
  }
  const laboratory = await read('/laboratorio.html')
  assert.equal(laboratory.status, 200)
  assert.match(await laboratory.text(), /laboratorio/i)
  console.log('Web, rutas React, recursos, laboratorio y errores 404 verificados: ' + base)
} finally {
  await local?.close()
}
