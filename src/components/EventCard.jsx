import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { formatDate, formatTime, getDayName, isPastEvent } from '../utils/dateUtils'

// Tarjeta de evento para la grilla principal y lista de Mis Eventos
function EventCard({ event, showCancelBtn = false }) {
  const { isInscribed, inscribe, cancelInscription } = useApp()

  const past        = isPastEvent(event.date)
  const inscribed   = isInscribed(event.id)
  const totalEnrolled = event.enrolled + (inscribed ? 1 : 0)
  const isFull      = totalEnrolled >= event.capacity
  const spotsLeft   = event.capacity - totalEnrolled

  const handleInscribe = (e) => {
    e.preventDefault() // no navegar al hacer clic en el botón dentro del link
    inscribe(event.id)
  }

  const handleCancel = (e) => {
    e.preventDefault()
    cancelInscription(event.id)
  }

  return (
    <article className={`event-card ${past ? 'event-card--past' : ''}`}>
      {/* Encabezado con categoría y estado */}
      <div className="event-card__header">
        <span className={`badge badge--category badge--${event.category.toLowerCase().replace(/\s/g, '-').replace(/[^a-z-]/g, '')}`}>
          {event.category}
        </span>
        <span className={`badge ${event.isFree ? 'badge--free' : 'badge--paid'}`}>
          {event.isFree ? 'Gratuito' : `S/ ${event.cost.toFixed(2)}`}
        </span>
      </div>

      {/* Contenido principal */}
      <div className="event-card__body">
        <h3 className="event-card__title">{event.title}</h3>
        <p className="event-card__description">{event.description}</p>

        <ul className="event-card__meta">
          <li>
            <span className="meta-icon" aria-hidden="true">📅</span>
            <span>{getDayName(event.date)}, {formatDate(event.date)}</span>
          </li>
          <li>
            <span className="meta-icon" aria-hidden="true">🕐</span>
            <span>{formatTime(event.time)}</span>
          </li>
          <li>
            <span className="meta-icon" aria-hidden="true">🎤</span>
            <span>{event.speaker}</span>
          </li>
          <li>
            <span className="meta-icon" aria-hidden="true">📍</span>
            <span>{event.location}</span>
          </li>
        </ul>
      </div>

      {/* Footer: capacidad + acciones */}
      <div className="event-card__footer">
        <div className="event-card__capacity">
          <div
            className="capacity-bar"
            role="progressbar"
            aria-valuenow={totalEnrolled}
            aria-valuemin={0}
            aria-valuemax={event.capacity}
            title={`${totalEnrolled} de ${event.capacity} inscritos`}
          >
            <div
              className="capacity-bar__fill"
              style={{ width: `${Math.min((totalEnrolled / event.capacity) * 100, 100)}%` }}
            />
          </div>
          <span className="capacity-label">
            {past
              ? `${totalEnrolled} asistentes`
              : isFull
                ? 'Sin cupos disponibles'
                : `${spotsLeft} cupo${spotsLeft !== 1 ? 's' : ''} disponible${spotsLeft !== 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="event-card__actions">
          <Link to={`/eventos/${event.id}`} className="btn btn--outline btn--sm">
            Ver detalle
          </Link>

          {/* Botón cancelar (vista Mis Eventos) */}
          {showCancelBtn && !past && inscribed && (
            <button onClick={handleCancel} className="btn btn--danger btn--sm">
              Cancelar
            </button>
          )}

          {/* Botón inscribirse (vista principal) */}
          {!showCancelBtn && !past && !inscribed && (
            <button
              onClick={handleInscribe}
              disabled={isFull}
              className="btn btn--primary btn--sm"
            >
              {isFull ? 'Cupo lleno' : 'Inscribirme'}
            </button>
          )}

          {/* Ya inscrito */}
          {!showCancelBtn && !past && inscribed && (
            <span className="badge badge--success">✓ Inscrito</span>
          )}
        </div>
      </div>
    </article>
  )
}

export default EventCard
