import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { startServer, temporaryDatabase, request } from '../support/harness.js'
import { runConcurrency } from '../public/concurrency.js'

const temp = await temporaryDatabase()
let server
try {
  server = await startServer({ storage: temp.storage })
  const delay = await runConcurrency({ baseUrl: server.baseUrl })
  const orm = await runConcurrency({ baseUrl: server.baseUrl, kind: 'orm' })
  assert.equal(delay.passed, true)
  assert.equal(orm.passed, true)
  const sessionId = randomUUID()
  const student = { name: 'Estudiante de Demostración', email: 'demo@unmsm.edu.pe', phone: '987654321' }
  const saveProfile = await request(server.baseUrl, '/student', { sessionId, method: 'PUT', body: student })
  assert.equal(saveProfile.status, 200)
  const favorite = await request(server.baseUrl, '/favorites/7', { sessionId, method: 'PUT' })
  const review = await request(server.baseUrl, '/events/7/reviews', {
    sessionId, method: 'PUT', body: { rating: 5, comment: 'Valoración guardada con Sequelize y recuperada al reabrir SQLite.' },
  })
  assert.equal(favorite.status, 200)
  assert.equal(review.status, 200)
  await server.close()
  server = null
  server = await startServer({ storage: temp.storage })
  const favorites = await request(server.baseUrl, '/favorites', { sessionId })
  const reviews = await request(server.baseUrl, '/events/7/reviews')
  assert.deepEqual(favorites.data.map((event) => event.id), [7])
  assert.equal(reviews.data.reviews[0].rating, 5)
  const report = {
    generatedAt: new Date().toISOString(), node: process.version,
    storage: 'SQLite en archivo temporal; conexión y servidor cerrados y reabiertos antes de consultar',
    simulatedDelay: delay, realOrmQuery: orm,
    persistence: {
      passed: true, reopenedDatabase: true,
      favorites: { saveStatus: favorite.status, readStatus: favorites.status, eventIds: favorites.data.map((event) => event.id) },
      reviews: { saveStatus: review.status, readStatus: reviews.status, ...reviews.data },
    },
  }
  const directory = fileURLToPath(new URL('../evidence', import.meta.url))
  await mkdir(directory, { recursive: true })
  await writeFile(`${directory}/resultado.json`, JSON.stringify(report, null, 2) + '\n')
  console.table([
    ...delay.quick.map((row) => ({ test: 'Espera simulada', request: row.path, ms: row.elapsedMs, duringWait: row.completedWhileWaiting })),
    { test: 'Espera simulada', request: delay.slow.path, ms: delay.slow.elapsedMs },
    ...orm.quick.map((row) => ({ test: 'Consulta ORM', request: row.path, ms: row.elapsedMs, duringWait: row.completedWhileWaiting })),
    { test: 'Consulta ORM', request: orm.slow.path, ms: orm.slow.elapsedMs },
  ])
  console.log(`Temporizador JS durante SQL: ${orm.slow.data.timerTicks} ticks.`)
  console.log('Favoritos y valoraciones: persistencia verificada después de reabrir SQLite.')
  console.log(`Evidencia: ${directory}/resultado.json`)
} finally { if (server) await server.close(); await temp.cleanup() }
