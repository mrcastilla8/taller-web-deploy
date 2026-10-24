import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { openDatabase } from '../src/database.js'
import { createApp } from '../src/app.js'

export async function startServer({ storage = ':memory:', seed, log = () => {} } = {}) {
  const db = await openDatabase({ storage, seed })
  const server = createApp(db, { log }).listen(0, '127.0.0.1')
  try { await once(server, 'listening') } catch (error) { await db.close(); throw error }
  return {
    db, baseUrl: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
      await db.close()
    },
  }
}

export async function temporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), 'eventos-fisi-'))
  return {
    storage: join(directory, 'test.sqlite'),
    async cleanup() {
      const target = resolve(directory)
      const root = resolve(tmpdir()) + sep
      if (!target.startsWith(root) || !basename(target).startsWith('eventos-fisi-')) {
        throw new Error('No se puede eliminar un directorio fuera de la carpeta temporal de esta prueba.')
      }
      await rm(target, { recursive: true, force: true })
    },
  }
}

export async function request(baseUrl, path, { sessionId, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(sessionId ? { 'X-Session-Id': sessionId } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  return { status: response.status, data: await response.json() }
}
