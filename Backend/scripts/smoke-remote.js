import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { request } from '../support/harness.js'

const target = new URL(process.argv[2])
if (target.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(target.hostname)) {
  throw new Error('La comprobación remota requiere HTTPS.')
}
const baseUrl = target.origin
const sessionId = randomUUID()
const call = (path, method = 'GET', body) => request(baseUrl, path, { sessionId, method, body })
let created = false
try {
  // La aplicación puede tardar en arrancar después de una publicación.
  let ready = false
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const result = await call('/ready')
      if (result.status === 200) { assert.equal(result.data.database, 'postgres'); ready = true; break }
    } catch { /* Se vuelve a intentar mientras arranca App Service. */ }
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
  assert.ok(ready, 'No se confirmó la conexión PostgreSQL del backend desplegado.')
  const events = await call('/events')
  assert.equal(events.status, 200)
  assert.ok(events.data.length > 0)
  const eventId = events.data[0].id
  const student = await call('/student', 'PUT', { name: 'Prueba de despliegue', email: 'deploy-test@universidad.edu.pe', phone: '987654321' })
  assert.equal(student.status, 200)
  created = true
  assert.equal((await call(`/favorites/${eventId}`, 'PUT')).status, 200)
  assert.ok((await call('/favorites')).data.some((event) => event.id === eventId))
  assert.equal((await call(`/events/${eventId}/reviews`, 'PUT', { rating: 5, comment: 'Prueba temporal del despliegue en Azure.' })).status, 200)
  assert.ok((await call(`/events/${eventId}/reviews`)).data.reviews.some((review) => review.author === 'Prueba de despliegue'))
  console.log('API, conexión PostgreSQL, favoritos y valoraciones: verificados por HTTPS.')
} finally {
  if (created) assert.equal((await call('/student', 'DELETE')).status, 200)
}
