import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'
import { openDatabase } from './database.js'
import { createApp } from './app.js'

const memory = process.argv.includes('--memory')
const storage = memory ? ':memory:' : process.env.DB_STORAGE
  ? resolve(process.env.DB_STORAGE) : fileURLToPath(new URL('../data/eventos.sqlite', import.meta.url))
const databaseUrl = memory ? undefined : process.env.DATABASE_URL
const port = Number(process.env.PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe estar entre 1 y 65535.')
const host = process.env.HOST ?? (process.env.WEBSITE_HOSTNAME ? '0.0.0.0' : '127.0.0.1')
let db
let application
let closing = false
const server = createServer((req, res) => {
  if (application) return application(req, res)
  const health = ['/health', '/api/health'].includes(req.url.split('?')[0])
  res.writeHead(health ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(health
    ? { status: 'ok', storage: databaseUrl ? 'postgres' : memory ? 'memory' : 'sqlite', ready: false }
    : { error: 'La conexión a la base de datos se está inicializando.' }))
})
server.on('error', async (error) => {
  closing = true
  console.error({ name: error.name, code: error.code })
  await db?.close()
  process.exitCode = 1
})
server.listen(port, host, () => console.log(`HTTP listo en el puerto ${port}; salud: /health`))
function shutdown() {
  if (closing) return
  closing = true
  server.close(async () => { await db?.close() })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

while (!closing) {
  try {
    db = await openDatabase({ storage, databaseUrl, ssl: process.env.DB_SSL !== 'disable', logging: process.env.SQL_LOG === '1' ? console.log : false })
    if (closing) { await db.close(); break }
    application = createApp(db)
    console.log('API y base de datos listas: ' + db.dialect)
    break
  } catch (error) {
    console.error('No se pudo inicializar la base de datos; se reintentará.', { name: error.name, code: error.parent?.code })
    if (!closing) await pause(5000)
  }
}
