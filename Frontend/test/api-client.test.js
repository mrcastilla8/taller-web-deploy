import test from 'node:test'
import assert from 'node:assert/strict'
import { createApi } from '../src/api/client.js'
import { startServer } from '../../Backend/support/harness.js'
import { mockEvents } from '../../Backend/src/data/events.js'

test('el cliente React usa la API real para catálogo, perfil, inscripción y recuperación por sesión', async (t) => {
  const event = { ...mockEvents[0], id: 100, date: '2099-12-01', capacity: 1, enrolled: 0 }
  const server = await startServer({ seed: [event] })
  t.after(() => server.close())
  const values = new Map()
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }
  const options = { baseUrl: server.baseUrl, storage }
  const api = createApi(options)
  const state = await api('/state')
  assert.equal(state.student, null)
  assert.equal(state.events[0].id, 100)
  await assert.rejects(() => api('/student', 'PUT', { name: 'No válido', email: 'x@gmail.com', phone: '987654321' }), /institucional/)
  await api('/student', 'PUT', { name: 'Prueba integración React', email: 'react-test@universidad.edu.pe', phone: '987654321' })
  const enrolled = await api('/inscriptions', 'POST', { eventId: 100 })
  assert.deepEqual(enrolled.inscriptions, [100])
  assert.equal(enrolled.events[0].enrolled, 1)
  const reloaded = createApi(options)
  const recovered = await reloaded('/state')
  assert.equal(recovered.student.name, 'Prueba integración React')
  assert.deepEqual(recovered.inscriptions, [100])
  assert.equal(values.size, 1, 'Solo se guarda el identificador de sesión en el navegador.')
  assert.equal(values.has('edu_student'), false)
  assert.deepEqual((await reloaded('/inscriptions/100', 'DELETE')).inscriptions, [])
  await reloaded('/student', 'DELETE')
  assert.equal((await reloaded('/state')).student, null)
})
