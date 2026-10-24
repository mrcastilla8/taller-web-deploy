import express from 'express'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { HttpError } from './errors.js'
import { CATEGORIES } from './data/events.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function integer(value, min, max, label) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new HttpError(400, `${label} debe ser un entero.`)
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new HttpError(400, `${label} debe estar entre ${min} y ${max}.`)
  }
  return number
}

export function createApp(db, { log = console.log } = {}) {
  const app = express()
  let pendingDelays = 0
  let pendingQueries = 0
  app.disable('x-powered-by')
  app.use('/api', (req, res, next) => {
    const requestId = randomUUID()
    const start = performance.now()
    const path = req.originalUrl.split('?')[0]
    res.set('X-Request-Id', requestId)
    res.set('Cache-Control', 'no-store')
    log(JSON.stringify({ phase: 'start', requestId, method: req.method, path }))
    res.on('finish', () => log(JSON.stringify({
      phase: 'finish', requestId, method: req.method, path,
      status: res.statusCode, elapsedMs: Math.round(performance.now() - start),
    })))
    next()
  })
  app.use(express.json({ limit: '16kb', strict: true }))

  const session = (req) => {
    const id = req.get('X-Session-Id')
    if (!id || !uuid.test(id)) throw new HttpError(400, 'Se requiere X-Session-Id con un UUID válido.')
    return id
  }
  const eventId = (req) => integer(req.params.id, 1, 2147483647, 'El ID del evento')
  const state = async (req, res) => res.json(await db.state(session(req)))

  app.get('/api/health', (req, res) => res.json({
    status: 'ok', storage: db.dialect === 'postgres' ? 'postgres' : db.storage === ':memory:' ? 'memory' : 'sqlite',
    pendingDelays, pendingQueries,
  }))
  app.get('/api/ready', async (req, res) => {
    await db.sequelize.authenticate()
    res.json({ status: 'ready', database: db.dialect })
  })
  app.get('/api/categories', (req, res) => res.json(CATEGORIES))
  app.get('/api/events', async (req, res) => {
    const ms = req.query.delayMs === undefined ? 0 : integer(req.query.delayMs, 0, 10000, 'delayMs')
    if (ms) {
      pendingDelays++
      try {
        // Esta espera devuelve el control al event loop; no ocupa el hilo de JS.
        await delay(ms)
      } finally { pendingDelays-- }
    }
    res.json(await db.listEvents())
  })
  app.get('/api/events/:id', async (req, res) => {
    const id = eventId(req)
    const event = (await db.listEvents()).find((item) => item.id === id)
    if (!event) throw new HttpError(404, 'Evento no encontrado.')
    res.json(event)
  })
  app.get('/api/state', state)
  app.get('/api/student', async (req, res) => res.json((await db.profile(session(req))).student))
  app.put('/api/student', async (req, res) => {
    const id = session(req)
    const { name, email, phone } = req.body ?? {}
    if (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 150) {
      throw new HttpError(400, 'El nombre debe tener entre 3 y 150 caracteres.')
    }
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@(unmsm|universidad)\.edu\.pe$/i.test(email.trim())) {
      throw new HttpError(400, 'Usa un correo institucional @unmsm.edu.pe o @universidad.edu.pe.')
    }
    if (typeof phone !== 'string' || phone.length > 40 || !/^\d{7,15}$/.test(phone.replace(/[\s\-+()]/g, ''))) {
      throw new HttpError(400, 'Ingresa un teléfono de 7 a 15 dígitos.')
    }
    await db.saveStudent(id, { name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() })
    await state(req, res)
  })
  app.delete('/api/student', async (req, res) => {
    await db.clearStudent(session(req))
    await state(req, res)
  })
  app.get('/api/inscriptions', async (req, res) => res.json((await db.profile(session(req))).inscriptions))
  app.post('/api/inscriptions', async (req, res) => {
    const id = req.body?.eventId
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new HttpError(400, 'eventId debe ser un entero positivo.')
    const created = await db.inscribe(session(req), id)
    res.status(created ? 201 : 200)
    await state(req, res)
  })
  app.delete('/api/inscriptions/:id', async (req, res) => {
    await db.cancel(session(req), eventId(req))
    await state(req, res)
  })

  // Función nueva 1: escritura y consulta de favoritos persistentes.
  app.get('/api/favorites', async (req, res) => res.json(await db.favorites(session(req))))
  app.put('/api/favorites/:id', async (req, res) => {
    const id = session(req)
    await db.setFavorite(id, eventId(req), true)
    res.json(await db.favorites(id))
  })
  app.delete('/api/favorites/:id', async (req, res) => {
    const id = session(req)
    await db.setFavorite(id, eventId(req), false)
    res.json(await db.favorites(id))
  })

  // Función nueva 2: escritura y consulta de valoraciones, con promedio.
  app.get('/api/events/:id/reviews', async (req, res) => res.json(await db.reviews(eventId(req))))
  app.put('/api/events/:id/reviews', async (req, res) => {
    const { rating, comment } = req.body ?? {}
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'La valoración debe ser un entero de 1 a 5.')
    if (typeof comment !== 'string' || comment.trim().length < 3 || comment.trim().length > 1000) {
      throw new HttpError(400, 'El comentario debe tener entre 3 y 1000 caracteres.')
    }
    const id = eventId(req)
    await db.saveReview(session(req), id, { rating, comment: comment.trim() })
    res.json(await db.reviews(id))
  })

  app.get('/api/demo/orm', async (req, res) => {
    const iterations = integer(req.query.iterations ?? '3000000', 10000, 5000000, 'iterations')
    let timerTicks = 0
    const timer = setInterval(() => { timerTicks++ }, 10)
    const start = performance.now()
    pendingQueries++
    try {
      const result = await db.benchmark(iterations)
      res.json({ ...result, iterations, timerTicks, elapsedMs: Math.round(performance.now() - start) })
    } finally {
      pendingQueries--
      clearInterval(timer)
    }
  })
  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta de API no encontrada.' }))
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))))
  app.get('/', (req, res) => res.redirect('/laboratorio.html'))
  app.use((req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }))
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const status = error.status ?? (error.name === 'SequelizeValidationError' ? 400 : 500)
    if (status >= 500) console.error({ name: error.name, message: error.message, code: error.parent?.code })
    res.status(status).json({
      error: status >= 500 ? 'No se pudo completar la operación.'
        : error.type === 'entity.parse.failed' ? 'El cuerpo debe ser JSON válido.'
        : error.type === 'entity.too.large' ? 'El cuerpo supera el límite de 16 KB.'
        : error.message,
    })
  })
  return app
}
