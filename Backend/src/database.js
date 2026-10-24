import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DataTypes, Sequelize, Transaction } from 'sequelize'
import pg from 'pg'
import { mockEvents } from './data/events.js'
import { HttpError } from './errors.js'

export async function openDatabase({ storage, databaseUrl, ssl = true, seed = mockEvents, logging = false }) {
  const postgres = Boolean(databaseUrl)
  if (!postgres && storage !== ':memory:') await mkdir(dirname(storage), { recursive: true })
  const common = { logging, define: { timestamps: false } }
  const sequelize = postgres
    ? new Sequelize(databaseUrl, {
      ...common, dialect: 'postgres', dialectModule: pg,
      dialectOptions: { ssl: ssl ? { require: true, rejectUnauthorized: true } : false },
      pool: { min: 0, max: 5, acquire: 30000, idle: 10000 },
    })
    : new Sequelize({
      ...common, dialect: 'sqlite', storage,
      retry: { match: [/SQLITE_BUSY/], max: 5 },
    })
  const Event = sequelize.define('Event', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    date: { type: DataTypes.DATEONLY, allowNull: false },
    time: DataTypes.STRING,
    speaker: DataTypes.STRING,
    speakerBio: DataTypes.TEXT,
    category: DataTypes.STRING,
    isFree: DataTypes.BOOLEAN,
    cost: DataTypes.FLOAT,
    capacity: { type: DataTypes.INTEGER, allowNull: false },
    // Inscripciones previas de los datos originales; las nuevas viven en Inscription.
    enrolled: { type: DataTypes.INTEGER, allowNull: false },
    location: DataTypes.STRING,
    agenda: DataTypes.JSON,
  })
  const Student = sequelize.define('Student', {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
  })
  const keys = () => ({
    sessionId: { type: DataTypes.UUID, primaryKey: true },
    eventId: { type: DataTypes.INTEGER, primaryKey: true },
  })
  const Inscription = sequelize.define('Inscription', keys())
  const Favorite = sequelize.define('Favorite', keys())
  const Review = sequelize.define('Review', {
    ...keys(),
    rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    comment: { type: DataTypes.TEXT, allowNull: false },
  }, { timestamps: true })

  for (const Model of [Inscription, Favorite, Review]) {
    Model.belongsTo(Student, { foreignKey: 'sessionId', onDelete: 'CASCADE' })
    Model.belongsTo(Event, { foreignKey: 'eventId', onDelete: 'CASCADE' })
  }

  try {
    await sequelize.authenticate()
    if (!postgres) {
      await sequelize.query('PRAGMA foreign_keys = ON')
      if (storage !== ':memory:') await sequelize.query('PRAGMA journal_mode = WAL')
    }
    // Crea tablas que no existen. Nunca fuerza, borra ni sobrescribe los datos.
    await sequelize.sync()
    await Event.bulkCreate(seed, { ignoreDuplicates: true })
  } catch (error) {
    await sequelize.close()
    throw error
  }

  // SQLite tiene un escritor a la vez. La cola espera Promises, sin bloquear JS.
  // La transacción mantiene juntas la comprobación de cupos y la inscripción.
  let writes = Promise.resolve()
  const write = (operation) => {
    // En PostgreSQL el bloqueo de fila protege los cupos entre varias instancias.
    if (postgres) return sequelize.transaction(operation)
    const result = writes.then(() => sequelize.transaction(
      { type: Transaction.TYPES.IMMEDIATE }, operation,
    ))
    writes = result.catch(() => {})
    return result
  }

  const requireStudent = async (sessionId, transaction) => {
    const student = await Student.findByPk(sessionId, { transaction })
    if (!student) throw new HttpError(401, 'Primero debes identificarte.')
    return student
  }
  const requireEvent = async (eventId, transaction) => {
    const event = await Event.findByPk(eventId, {
      transaction, ...(postgres && transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    })
    if (!event) throw new HttpError(404, 'Evento no encontrado.')
    return event
  }
  const listEvents = async () => {
    const [events, counts] = await Promise.all([
      Event.findAll({ order: [['id', 'ASC']], raw: true }),
      Inscription.count({ group: ['eventId'] }),
    ])
    const enrolled = new Map(counts.map((row) => [row.eventId, Number(row.count)]))
    return events.map((event) => ({
      ...event,
      isFree: Boolean(event.isFree),
      // raw:true no convierte columnas JSON en SQLite.
      agenda: typeof event.agenda === 'string' ? JSON.parse(event.agenda) : event.agenda,
      enrolled: event.enrolled + (enrolled.get(event.id) ?? 0),
    }))
  }
  const profile = async (sessionId) => {
    const student = sessionId ? await Student.findByPk(sessionId) : null
    if (!student) return { student: null, inscriptions: [] }
    const rows = await Inscription.findAll({ where: { sessionId }, order: [['eventId', 'ASC']] })
    return {
      student: { name: student.name, email: student.email, phone: student.phone },
      inscriptions: rows.map((row) => row.eventId),
    }
  }

  return {
    sequelize, storage, dialect: postgres ? 'postgres' : 'sqlite',
    models: { Event, Student, Inscription, Favorite, Review },
    listEvents, profile,
    async state(sessionId) {
      const [data, events] = await Promise.all([profile(sessionId), listEvents()])
      return { ...data, events }
    },
    saveStudent: (sessionId, data) => write(async (transaction) => {
      await Student.upsert({ id: sessionId, ...data }, { transaction })
    }),
    clearStudent: (sessionId) => write(async (transaction) => {
      await Student.destroy({ where: { id: sessionId }, transaction })
    }),
    inscribe: (sessionId, eventId) => write(async (transaction) => {
      await requireStudent(sessionId, transaction)
      const event = await requireEvent(eventId, transaction)
      const where = { sessionId, eventId }
      if (await Inscription.findOne({ where, transaction })) return false
      // Conserva la regla del frontend: es pasado si la fecha es anterior a hoy.
      if (event.date < new Date().toISOString().slice(0, 10)) {
        throw new HttpError(409, 'Este evento ya fue realizado.')
      }
      const count = await Inscription.count({ where: { eventId }, transaction })
      if (event.enrolled + count >= event.capacity) {
        throw new HttpError(409, 'No hay cupos disponibles.')
      }
      await Inscription.create(where, { transaction })
      return true
    }),
    cancel: (sessionId, eventId) => write(async (transaction) => {
      await requireStudent(sessionId, transaction)
      const event = await requireEvent(eventId, transaction)
      if (event.date < new Date().toISOString().slice(0, 10)) {
        throw new HttpError(409, 'No se puede cancelar un evento realizado.')
      }
      await Inscription.destroy({ where: { sessionId, eventId }, transaction })
    }),
    async favorites(sessionId) {
      await requireStudent(sessionId)
      const rows = await Favorite.findAll({ where: { sessionId } })
      const ids = new Set(rows.map((row) => row.eventId))
      return (await listEvents()).filter((event) => ids.has(event.id))
    },
    setFavorite: (sessionId, eventId, selected) => write(async (transaction) => {
      await requireStudent(sessionId, transaction)
      await requireEvent(eventId, transaction)
      const where = { sessionId, eventId }
      if (selected) await Favorite.findOrCreate({ where, transaction })
      else await Favorite.destroy({ where, transaction })
    }),
    saveReview: (sessionId, eventId, data) => write(async (transaction) => {
      await requireStudent(sessionId, transaction)
      await requireEvent(eventId, transaction)
      await Review.upsert({ sessionId, eventId, ...data }, { transaction })
    }),
    async reviews(eventId) {
      await requireEvent(eventId)
      const rows = await Review.findAll({
        where: { eventId },
        include: [{ model: Student, attributes: ['name'] }],
        order: [['createdAt', 'ASC'], ['sessionId', 'ASC']],
      })
      return {
        eventId,
        count: rows.length,
        average: rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : null,
        reviews: rows.map((row) => ({
          author: row.Student.name, rating: row.rating, comment: row.comment,
          createdAt: row.createdAt, updatedAt: row.updatedAt,
        })),
      }
    },
    // Consulta real a través de Sequelize. El trabajo SQL lo realiza sqlite3.
    async benchmark(iterations) {
      const [rows] = await sequelize.query(
        'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < $iterations) SELECT SUM(x) AS total FROM n',
        { bind: { iterations } },
      )
      return { total: Number(rows[0].total) }
    },
    async close() { await writes; await sequelize.close() },
  }
}
