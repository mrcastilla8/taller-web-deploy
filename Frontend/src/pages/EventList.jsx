import { useEventFilter } from '../hooks/useEventFilter'
import EventCard from '../components/EventCard'
import FilterBar from '../components/FilterBar'

function EventList() {
  const {
    filters, setFilter, resetFilters,
    filteredEvents, activeCount, CATEGORIES,
  } = useEventFilter()

  const today = new Date().toISOString().split('T')[0]
  const month = new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })

  return (
    <div className="page">

      {/* Encabezado de la página */}
      <div className="page-header">
        <div>
          <h2 className="page-title">
            Eventos de {month.charAt(0).toUpperCase() + month.slice(1)}
          </h2>
          <p className="page-subtitle">
            Explora y regístrate en los eventos académicos del mes.
          </p>
        </div>
        <div className="page-header__stats">
          <div className="stat-pill">
            <span className="stat-pill__number">
              {filteredEvents.filter((e) => e.date >= today).length}
            </span>
            <span className="stat-pill__label">Próximos</span>
          </div>
          <div className="stat-pill stat-pill--secondary">
            <span className="stat-pill__number">
              {filteredEvents.filter((e) => e.date < today).length}
            </span>
            <span className="stat-pill__label">Realizados</span>
          </div>
        </div>
      </div>

      {/* Barra de filtros */}
      <FilterBar
        filters={filters}
        setFilter={setFilter}
        resetFilters={resetFilters}
        activeCount={activeCount}
        categories={CATEGORIES}
      />

      {/* Grilla de eventos */}
      {filteredEvents.length > 0 ? (
        <div className="events-grid">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">🔎</span>
          <h3>No se encontraron eventos</h3>
          <p>Prueba cambiando los filtros o el término de búsqueda.</p>
          <button onClick={resetFilters} className="btn btn--primary">
            Ver todos los eventos
          </button>
        </div>
      )}

    </div>
  )
}

export default EventList
