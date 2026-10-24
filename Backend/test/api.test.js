import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mockEvents, CATEGORIES } from '../src/data/events.js'
import { startServer, request, temporaryDatabase } from '../support/harness.js'
import { runConcurrency } from '../public/concurrency.js'

const student = { name: 'Estudiante de Prueba', email: 'prueba@unmsm.edu.pe', phone: '987654321' }
const seed = [
  ...mockEvents,
  { ...mockEvents[7], id: 100, date: '2099-12-01', enrolled: 0, capacity: 1 },
  { ...mockEvents[7], id: 101, date: '2099-12-01', enrolled: 1, capacity: 1 },
  { ...mockEvents[7], id: 102, date: '2000-01-01', enrolled: 0 },
]
async function fixture(t) {
  const server = await startServer({ seed })
  t.after(() => server.close())
  const sessionId = randomUUID()
  const call = (path, method = 'GET', body) => request(server.baseUrl, path, { sessionId, method, body })
  return { ...server, call, sessionId, identify: () => call('/student', 'PUT', student) }
}

test('catálogo, categorías, agenda y detalle conservan el contrato del frontend', async (t) => {
  const { call } = await fixture(t)
  const readiness = await call('/ready')
  assert.equal(readiness.status, 200)
  assert.equal(readiness.data.database, 'sqlite')
  const { data: events } = await call('/events')
  assert.equal(events.length, seed.length)
  assert.deepEqual(events.find((event) => event.id === 1), mockEvents[0])
  assert.deepEqual((await call('/categories')).data, CATEGORIES)
  assert.equal((await call('/events/1')).data.title, mockEvents[0].title)
  assert.equal((await call('/events/999')).status, 404)
  assert.equal((await call('/events/abc')).status, 400)
  assert.equal((await call('/events?delayMs=-1')).status, 400)
  assert.equal((await call('/events?delayMs=10001')).status, 400)
})

test('perfil validado por el servidor, edición y recuperación por sesión', async (t) => {
  const { call, identify } = await fixture(t)
  assert.equal((await call('/student')).data, null)
  for (const body of [
    { ...student, name: 'ab' }, { ...student, email: 'x@gmail.com' },
    { ...student, email: '@unmsm.edu.pe' }, { ...student, phone: 'abc' }, null,
  ]) assert.equal((await call('/student', 'PUT', body)).status, 400)
  assert.equal((await identify()).status, 200)
  const updated = { ...student, name: 'Nombre Actualizado', email: 'NUEVO@UNMSM.EDU.PE' }
  assert.equal((await call('/student', 'PUT', updated)).data.student.name, updated.name)
  assert.equal((await call('/student')).data.email, 'nuevo@unmsm.edu.pe')
})

test('la API exige sesión válida y no permite inscribir ni guardar favoritos sin perfil', async (t) => {
  const { baseUrl, call } = await fixture(t)
  assert.equal((await request(baseUrl, '/state')).status, 400)
  assert.equal((await request(baseUrl, '/state', { sessionId: 'invalido' })).status, 400)
  assert.equal((await call('/inscriptions', 'POST', { eventId: 100 })).status, 401)
  assert.equal((await call('/favorites/100', 'PUT')).status, 401)
  assert.equal((await call('/events/100/reviews', 'PUT', { rating: 5, comment: 'Excelente' })).status, 401)
})

test('inscripción idempotente, cupos globales, cancelación y mis eventos', async (t) => {
  const { call, identify } = await fixture(t)
  await identify()
  assert.equal((await call('/inscriptions', 'POST', { eventId: 100 })).status, 201)
  assert.equal((await call('/inscriptions', 'POST', { eventId: 100 })).status, 200)
  assert.deepEqual((await call('/inscriptions')).data, [100])
  assert.equal((await call('/events/100')).data.enrolled, 1)
  assert.equal((await call('/inscriptions/100', 'DELETE')).status, 200)
  assert.deepEqual((await call('/inscriptions')).data, [])
  assert.equal((await call('/events/100')).data.enrolled, 0)
})

test('se rechazan eventos pasados, llenos, inexistentes e IDs inválidos', async (t) => {
  const { call, identify } = await fixture(t)
  await identify()
  for (const [eventId, status] of [[101, 409], [102, 409], [999, 404], ['100', 400], [null, 400]]) {
    assert.equal((await call('/inscriptions', 'POST', { eventId })).status, status)
  }
  assert.equal((await call('/inscriptions/102', 'DELETE')).status, 409)
})

test('peticiones simultáneas al último cupo no sobreinscriben el evento', async (t) => {
  const { baseUrl, call } = await fixture(t)
  const ids = Array.from({ length: 6 }, () => randomUUID())
  await Promise.all(ids.map((sessionId) => request(baseUrl, '/student', { sessionId, method: 'PUT', body: student })))
  const results = await Promise.all(ids.map((sessionId) => request(baseUrl, '/inscriptions', {
    sessionId, method: 'POST', body: { eventId: 100 },
  })))
  assert.equal(results.filter((row) => row.status === 201).length, 1)
  assert.equal(results.filter((row) => row.status === 409).length, 5)
  assert.equal((await call('/events/100')).data.enrolled, 1)
})

test('favoritos se graban, consultan, aíslan por sesión y eliminan sin duplicados', async (t) => {
  const { call, identify, baseUrl } = await fixture(t)
  await identify()
  await call('/favorites/100', 'PUT')
  await call('/favorites/100', 'PUT')
  assert.deepEqual((await call('/favorites')).data.map((event) => event.id), [100])
  const other = randomUUID()
  await request(baseUrl, '/student', { sessionId: other, method: 'PUT', body: student })
  assert.deepEqual((await request(baseUrl, '/favorites', { sessionId: other })).data, [])
  assert.deepEqual((await call('/favorites/100', 'DELETE')).data, [])
  assert.equal((await call('/favorites/999', 'PUT')).status, 404)
})

test('valoraciones se graban, actualizan y consultan con promedio sin exponer contactos', async (t) => {
  const { call, identify, baseUrl } = await fixture(t)
  await identify()
  await call('/events/100/reviews', 'PUT', { rating: 5, comment: 'Muy interesante' })
  await call('/events/100/reviews', 'PUT', { rating: 3, comment: 'Valoración actualizada' })
  const other = randomUUID()
  await request(baseUrl, '/student', { sessionId: other, method: 'PUT', body: { ...student, name: 'Otra Persona' } })
  await request(baseUrl, '/events/100/reviews', { sessionId: other, method: 'PUT', body: { rating: 5, comment: 'Excelente' } })
  const { data } = await request(baseUrl, '/events/100/reviews')
  assert.equal(data.count, 2)
  assert.equal(data.average, 4)
  assert.equal(data.reviews[0].comment, 'Valoración actualizada')
  assert.equal(data.reviews[0].email, undefined)
  assert.equal(data.reviews[0].sessionId, undefined)
  for (const body of [{ rating: 0, comment: 'Prueba' }, { rating: '5', comment: 'Prueba' }, { rating: 3, comment: '' }]) {
    assert.equal((await call('/events/100/reviews', 'PUT', body)).status, 400)
  }
})

test('borrar el perfil elimina sus inscripciones, favoritos y valoraciones', async (t) => {
  const { call, identify, db } = await fixture(t)
  await identify()
  await call('/inscriptions', 'POST', { eventId: 100 })
  await call('/favorites/100', 'PUT')
  await call('/events/100/reviews', 'PUT', { rating: 5, comment: 'Prueba de borrado' })
  const { data } = await call('/student', 'DELETE')
  assert.equal(data.student, null)
  assert.deepEqual(data.inscriptions, [])
  assert.equal((await call('/events/100')).data.enrolled, 0)
  for (const Model of [db.models.Inscription, db.models.Favorite, db.models.Review]) assert.equal(await Model.count(), 0)
})

test('los datos y las dos funciones nuevas sobreviven al cerrar y reabrir SQLite', async () => {
  const temp = await temporaryDatabase()
  let server
  try {
    server = await startServer({ storage: temp.storage, seed })
    const sessionId = randomUUID()
    await request(server.baseUrl, '/student', { sessionId, method: 'PUT', body: student })
    await request(server.baseUrl, '/inscriptions', { sessionId, method: 'POST', body: { eventId: 100 } })
    await request(server.baseUrl, '/favorites/100', { sessionId, method: 'PUT' })
    await request(server.baseUrl, '/events/100/reviews', { sessionId, method: 'PUT', body: { rating: 4, comment: 'Persistencia real' } })
    await server.close()
    server = null
    server = await startServer({ storage: temp.storage, seed })
    assert.deepEqual((await request(server.baseUrl, '/inscriptions', { sessionId })).data, [100])
    assert.equal((await request(server.baseUrl, '/student', { sessionId })).data.name, student.name)
    assert.deepEqual((await request(server.baseUrl, '/favorites', { sessionId })).data.map((event) => event.id), [100])
    assert.equal((await request(server.baseUrl, '/events/100/reviews')).data.reviews[0].comment, 'Persistencia real')
    assert.equal((await request(server.baseUrl, '/events/100')).data.enrolled, 1)
    assert.equal(await server.db.models.Event.count(), seed.length)
  } finally { if (server) await server.close(); await temp.cleanup() }
})

test('el modo en memoria no conserva perfiles entre instancias', async () => {
  let server = await startServer()
  const sessionId = randomUUID()
  await request(server.baseUrl, '/student', { sessionId, method: 'PUT', body: student })
  await server.close()
  server = await startServer()
  try { assert.equal((await request(server.baseUrl, '/student', { sessionId })).data, null) }
  finally { await server.close() }
})

test('errores JSON, límite de cuerpo y rutas desconocidas responden de forma controlada', async (t) => {
  const { baseUrl, call, sessionId } = await fixture(t)
  const response = await fetch(`${baseUrl}/api/student`, { method: 'PUT', headers: {
    'Content-Type': 'application/json', 'X-Session-Id': sessionId,
  }, body: '{invalido' })
  assert.equal(response.status, 400)
  assert.match((await response.json()).error, /JSON/)
  assert.equal((await call('/student', 'PUT', { ...student, name: 'a'.repeat(20000) })).status, 413)
  assert.equal((await call('/desconocido')).status, 404)
  assert.equal((await call('/demo/orm?iterations=999999999')).status, 400)
})

test('el frontend de demostración y sus recursos se sirven desde el backend', async (t) => {
  const { baseUrl } = await fixture(t)
  const response = await fetch(`${baseUrl}/laboratorio.html`)
  assert.equal(response.status, 200)
  assert.match(await response.text(), /Favoritos/)
  const script = await fetch(`${baseUrl}/concurrency.js`)
  assert.match(await script.text(), /runConcurrency/)
})

test('durante una espera de 3 s el servidor atiende otras peticiones, incluidas lecturas ORM', async (t) => {
  const { baseUrl } = await fixture(t)
  const report = await runConcurrency({ baseUrl })
  assert.equal(report.passed, true)
  assert.equal(report.observed.data.pendingDelays, 1)
  assert.ok(report.quick.every((row) => row.completedWhileWaiting))
  assert.ok(report.slow.elapsedMs >= 2900)
})

test('una consulta SQL real del ORM permite que avancen HTTP y el temporizador JS', async (t) => {
  const { baseUrl } = await fixture(t)
  const report = await runConcurrency({ baseUrl, kind: 'orm' })
  assert.equal(report.passed, true)
  assert.equal(report.observed.data.pendingQueries, 1)
  assert.ok(report.slow.data.timerTicks > 0)
  assert.equal(report.slow.data.total, 3000000 * 3000001 / 2)
})
