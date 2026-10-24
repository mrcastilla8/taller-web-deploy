import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { mockEvents } from '../data/mockData'
import EventCard from '../components/EventCard'
import { isPastEvent } from '../utils/dateUtils'

function MyEvents() {
  const { student, openModal, inscriptions } = useApp()
  const [activeTab, setActiveTab] = useState('upcoming') // 'upcoming' | 'past'

  // Obtiene solo los eventos en que el alumno está inscrito
  const myEvents = mockEvents.filter((e) => inscriptions.includes(e.id))

  const upcoming = myEvents.filter((e) => !isPastEvent(e.date))
  const past     = myEvents.filter((e) => isPastEvent(e.date))
  const shown    = activeTab === 'upcoming' ? upcoming : past

  return (
    <div className="page">

      {/* Encabezado */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Mis Eventos</h2>
          <p className="page-subtitle">
            {student
              ? <><strong>{student.name}</strong> &mdash; {student.email}</>
              : 'Gestiona tus inscripciones a eventos académicos.'}
          </p>
        </div>
        <div className="page-header__stats">
          <div className="stat-pill">
            <span className="stat-pill__number">{upcoming.length}</span>
            <span className="stat-pill__label">Próximos</span>
          </div>
          <div className="stat-pill stat-pill--secondary">
            <span className="stat-pill__number">{past.length}</span>
            <span className="stat-pill__label">Asistidos</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" role="tablist" aria-label="Mis eventos">
        <button
          role="tab"
          aria-selected={activeTab === 'upcoming'}
          className={`tab ${activeTab === 'upcoming' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          📆 Próximos ({upcoming.length})
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'past'}
          className={`tab ${activeTab === 'past' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          📚 Asistidos ({past.length})
        </button>
      </div>

      {/* Lista de eventos */}
      {inscriptions.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">📭</span>
          <h3>Aún no estás inscrito en ningún evento</h3>
          {!student && (
            <p>
              Empieza por{' '}
              <button
                onClick={() => openModal(null)}
                className="link-btn"
              >
                identificarte
              </button>{' '}
              y luego explora los eventos del mes.
            </p>
          )}
          <Link to="/" className="btn btn--primary">Explorar Eventos</Link>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            {activeTab === 'upcoming' ? '📆' : '📚'}
          </span>
          <h3>
            {activeTab === 'upcoming'
              ? 'No tienes eventos próximos'
              : 'Aún no has asistido a ningún evento'}
          </h3>
          {activeTab === 'upcoming' && (
            <>
              <p>Inscríbete en los eventos que están por realizarse.</p>
              <Link to="/" className="btn btn--primary">Ver eventos próximos</Link>
            </>
          )}
        </div>
      ) : (
        <div className="events-grid">
          {shown.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              showCancelBtn={activeTab === 'upcoming'}
            />
          ))}
        </div>
      )}

    </div>
  )
}

export default MyEvents
