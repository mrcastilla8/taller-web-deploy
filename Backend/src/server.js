import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { openDatabase } from './database.js'
import { createApp } from './app.js'

const memory = process.argv.includes('--memory')
const storage = memory ? ':memory:' : process.env.DB_STORAGE
  ? resolve(process.env.DB_STORAGE) : fileURLToPath(new URL('../data/eventos.sqlite', import.meta.url))
const port = Number(process.env.PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe estar entre 1 y 65535.')
const db = await openDatabase({
  storage, databaseUrl: memory ? undefined : process.env.DATABASE_URL,
  ssl: process.env.DB_SSL !== 'disable',
  logging: process.env.SQL_LOG === '1' ? console.log : false,
})
const host = process.env.HOST ?? (process.env.WEBSITE_HOSTNAME ? '0.0.0.0' : '127.0.0.1')
const server = createApp(db).listen(port, host, () => {
  console.log(`API: http://localhost:${port}/api/health`)
  console.log(`Demostración: http://localhost:${port}/laboratorio.html`)
  console.log(`Almacenamiento: ${db.dialect === 'postgres' ? 'PostgreSQL' : storage}`)
})
server.on('error', async (error) => {
  console.error(error.message)
  await db.close()
  process.exitCode = 1
})
let closing = false
async function shutdown() {
  if (closing) return
  closing = true
  server.close(async () => { await db.close() })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
