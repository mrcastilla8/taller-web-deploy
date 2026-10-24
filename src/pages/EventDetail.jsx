import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { mockEvents } from '../data/mockData'
import { formatDate, formatTime, getDayName, isPastEvent } from '../utils/dateUtils'

function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isInscribed, inscribe, cancelInscription } = useApp()

  const event = mockEvents.find((e) => e.id === Number(id))

  // Evento no encontrado
  if (!event) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">❌</span>
          <h3>Evento no encontrado</h3>
          <p>El evento que buscas no existe o fue eliminado.</p>
          <Link to="/" className="btn btn--primary">Volver a Eventos</Link>
        </div>
      </div>
    )
  }

  const past        = isPastEvent(event.date)
  const inscribed   = isInscribed(event.id)
  const totalEnrolled = event.enrolled + (inscribed ? 1 : 0)
  const isFull      = totalEnrolled >= event.capacity
  const spotsLeft   = event.capacity - totalEnrolled
  const fillPercent = Math.min((totalEnrolled / event.capacity) * 100, 100)

  const handleInscribe = () => inscribe(event.id)
  const handleCancel   = () => {
    cancelInscription(event.id)
  }

  return (
    <div className="page">

      {/* Botón volver */}
      <button onClick={() => navigate(-1)} className="back-btn">
        ← Volver
      </button>

      <div className="detail-layout">

        {/* Columna principal */}
        <article className="detail-main">

          {/* Encabezado */}
          <div className="detail-header">
            <div className="detail-header__badges">
              <span className={`badge badge--category badge--${event.category.toLowerCase().replace(/\s/g, '-').replace(/[^a-z-]/g, '')}`}>
                {event.category}
              </span>
              {past
                ? <span className="badge badge--past">Evento realizado</span>
                : isFull && !inscribed
                  ? <span className="badge badge--danger">Cupo lleno</span>
                  : inscribed
                    ? <span className="badge badge--success">✓ Inscrito</span>
                    : <span className="badge badge--upcoming">Próximo</span>
              }
            </div>
            <h2 className="detail-title">{event.title}</h2>
            <p className="detail-description">{event.description}</p>
          </div>

          {/* Agenda de temas (si existe) */}
          {event.agenda && (
            <section className="detail-agenda">
              <h3 className="detail-section-title">📋 Agenda</h3>
              <ol className="agenda-list">
                {event.agenda.map((item, idx) => (
                  <li key={idx} className="agenda-item">
                    <div className="agenda-item__meta">
                      {item.day && (
                        <span className="agenda-item__day">{item.day}</span>
                      )}
                      <span className="agenda-item__time">
                        {formatTime(item.time.includes(':') ? item.time : item.time + ':00')}
                      </span>
                      {item.session && (
                        <span className="agenda-item__session">{item.session}</span>
                      )}
                    </div>
                    <p className="agenda-item__topic">{item.topic}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

        </article>

        {/* Panel lateral de información */}
        <aside className="detail-sidebar">

          <div className="info-card">
            <h3 className="info-card__title">Información del Evento</h3>

            <ul className="info-list">
              <li className="info-item">
                <span className="info-item__icon" aria-hidden="true">📅</span>
                <div>
                  <span className="info-item__label">Fecha</span>
                  <span className="info-item__value">
                    {getDayName(event.date)}, {formatDate(event.date)}
                  </span>
                </div>
              </li>
              <li className="info-item">
                <span className="info-item__icon" aria-hidden="true">🕐</span>
                <div>
                  <span className="info-item__label">Hora de inicio</span>
                  <span className="info-item__value">{formatTime(event.time)}</span>
                </div>
              </li>
              <li className="info-item">
                <span className="info-item__icon" aria-hidden="true">📍</span>
                <div>
                  <span className="info-item__label">Lugar</span>
                  <span className="info-item__value">{event.location}</span>
                </div>
              </li>
              <li className="info-item">
                <span className="info-item__icon" aria-hidden="true">🎤</span>
                <div>
                  <span className="info-item__label">Expositor</span>
                  <span className="info-item__value">{event.speaker}</span>
                  {event.speakerBio && (
                    <span className="info-item__bio">{event.speakerBio}</span>
                  )}
                </div>
              </li>
              <li className="info-item">
                <span className="info-item__icon" aria-hidden="true">💰</span>
                <div>
                  <span className="info-item__label">Costo de inscripción</span>
                  <span className={`info-item__value ${event.isFree ? 'text-success' : 'text-primary'}`}>
                    {event.isFree ? 'Gratuito' : `S/ ${event.cost.toFixed(2)}`}
                  </span>
                </div>
              </li>
            </ul>

            {/* Capacidad */}
            <div className="info-card__capacity">
              <div className="capacity-header">
                <span>Inscripciones</span>
                <span className="capacity-numbers">
                  <strong>{totalEnrolled}</strong> / {event.capacity}
                </span>
              </div>
              <div
                className="capacity-bar"
                role="progressbar"
                aria-valuenow={totalEnrolled}
                aria-valuemin={0}
                aria-valuemax={event.capacity}
              >
                <div
                  className="capacity-bar__fill"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
              {!past && (
                <p className="capacity-label">
                  {isFull
                    ? 'No hay cupos disponibles'
                    : `Quedan ${spotsLeft} cupo${spotsLeft !== 1 ? 's' : ''}`}
                </p>
              )}
            </div>

            {/* Botón de acción principal */}
            {!past && (
              <div className="info-card__action">
                {inscribed ? (
                  <>
                    <div className="inscription-confirm">
                      <span className="inscription-confirm__icon">✅</span>
                      <p>¡Estás inscrito en este evento!</p>
                    </div>
                    <button onClick={handleCancel} className="btn btn--danger btn--block">
                      Cancelar inscripción
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleInscribe}
                    disabled={isFull}
                    className="btn btn--primary btn--block"
                  >
                    {isFull ? 'Sin cupos disponibles' : 'Inscribirme en este evento'}
                  </button>
                )}
              </div>
            )}

            {past && (
              <div className="info-card__action">
                <p className="text-muted text-center">
                  Este evento ya fue realizado.
                </p>
              </div>
            )}
          </div>

        </aside>
      </div>
    </div>
  )
}

export default EventDetail
