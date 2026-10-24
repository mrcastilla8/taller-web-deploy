import { runConcurrency } from './concurrency.js'

const $ = (id) => document.getElementById(id)
const savedSession = localStorage.getItem('edu_session_id')
const sessionId = savedSession && /^[0-9a-f-]{36}$/i.test(savedSession) ? savedSession : crypto.randomUUID()
localStorage.setItem('edu_session_id', sessionId)

async function api(path, method = 'GET', body) {
  const response = await fetch(`/api${path}`, {
    method, signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`)
  return data
}
function status(id, text, failed = false) {
  $(id).textContent = text
  $(id).className = failed ? 'error' : 'success'
}
async function action(id, operation) {
  try { await operation() } catch (error) { status(id, error.message, true) }
}
function renderList(id, texts) {
  $(id).replaceChildren(...texts.map((text) => {
    const item = document.createElement('li')
    item.textContent = text
    return item
  }))
}

for (const kind of ['delay', 'orm']) {
  $(`run-${kind}`).addEventListener('click', async () => {
    $('run-delay').disabled = $('run-orm').disabled = true
    await action('concurrency-status', async () => {
      const report = await runConcurrency({ kind, onProgress: (text) => status('concurrency-status', text) })
      $('concurrency-json').textContent = JSON.stringify(report, null, 2)
      const rows = [...report.quick, report.slow].sort((a, b) => a.completedMs - b.completedMs)
      $('timings').replaceChildren(...rows.map((row) => {
        const tr = document.createElement('tr')
        const values = [row.path, `${row.sentMs} ms`, `${row.completedMs} ms`, `${row.elapsedMs} ms`,
          row === report.slow ? 'Petición lenta completada' : row.completedWhileWaiting ? 'Respondió durante la espera' : 'Respondió después']
        for (const value of values) { const td = document.createElement('td'); td.textContent = value; tr.append(td) }
        return tr
      }))
      const ticks = kind === 'orm' ? ` El temporizador de JavaScript avanzó ${report.slow.data.timerTicks} veces durante la consulta SQL.` : ''
      status('concurrency-status', report.passed
        ? `VERIFICADO: las peticiones rápidas terminaron mientras la otra seguía en curso.${ticks}`
        : 'La ejecución no demostró concurrencia; revisa los tiempos y repite.', !report.passed)
    })
    $('run-delay').disabled = $('run-orm').disabled = false
  })
}

$('profile-form').addEventListener('submit', (event) => {
  event.preventDefault()
  action('profile-status', async () => {
    const data = Object.fromEntries(new FormData(event.currentTarget))
    await api('/student', 'PUT', data)
    status('profile-status', 'Perfil guardado en el servidor.')
  })
})
function showFavorites(events) {
  renderList('favorite-list', events.length ? events.map((event) => event.title) : ['Todavía no hay favoritos.'])
}
$('save-favorite').addEventListener('click', () => action('favorite-status', async () => {
  showFavorites(await api(`/favorites/${$('favorite-event').value}`, 'PUT'))
  status('favorite-status', 'Favorito guardado y consultado en el servidor.')
}))
$('read-favorites').addEventListener('click', () => action('favorite-status', async () => {
  showFavorites(await api('/favorites'))
  status('favorite-status', 'Lista consultada en el servidor.')
}))
$('remove-favorite').addEventListener('click', () => action('favorite-status', async () => {
  showFavorites(await api(`/favorites/${$('favorite-event').value}`, 'DELETE'))
  status('favorite-status', 'Favorito eliminado. Lista actualizada.')
}))
function showReviews(data) {
  status('review-status', `${data.count} valoración(es). Promedio: ${data.average === null ? 'sin valoraciones' : data.average.toFixed(1) + ' / 5'}.`)
  renderList('review-list', data.reviews.map((review) => `${review.author} · ${review.rating}/5 · ${review.comment}`))
}
$('review-form').addEventListener('submit', (event) => {
  event.preventDefault()
  const data = Object.fromEntries(new FormData(event.currentTarget))
  action('review-status', async () => {
    showReviews(await api(`/events/${$('review-event').value}/reviews`, 'PUT', { ...data, rating: Number(data.rating) }))
  })
})
$('read-reviews').addEventListener('click', () => action('review-status', async () => {
  showReviews(await api(`/events/${$('review-event').value}/reviews`))
}))

await action('profile-status', async () => {
  const [health, state] = await Promise.all([api('/health'), api('/state')])
  $('connection').textContent = health.storage === 'memory' ? 'Conectado · modo en memoria'
    : health.storage === 'postgres' ? 'Conectado · PostgreSQL en Azure' : 'Conectado · SQLite persistente'
  for (const select of document.querySelectorAll('.event-select')) {
    select.replaceChildren(...state.events.map((event) => {
      const option = document.createElement('option')
      option.value = event.id
      option.textContent = event.title
      return option
    }))
  }
  if (state.student) {
    for (const [key, value] of Object.entries(state.student)) $('profile-form').elements[key].value = value
    status('profile-status', 'Perfil recuperado del servidor.')
    showFavorites(await api('/favorites'))
  }
})
