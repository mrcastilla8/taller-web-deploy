// Barra de filtros para la vista de Eventos del Mes.
// Recibe el estado y los setters desde el hook useEventFilter.
function FilterBar({ filters, setFilter, resetFilters, activeCount, categories }) {
  return (
    <section className="filter-bar" aria-label="Filtros de eventos">

      {/* Búsqueda por texto */}
      <div className="filter-bar__search">
        <span className="filter-bar__search-icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          placeholder="Buscar por título, expositor o categoría…"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="input input--search"
          aria-label="Buscar eventos"
        />
      </div>

      {/* Filtros desplegables / toggles */}
      <div className="filter-bar__controls">

        {/* Categoría */}
        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-category">Categoría</label>
          <select
            id="filter-category"
            value={filters.category}
            onChange={(e) => setFilter('category', e.target.value)}
            className="select"
          >
            <option value="all">Todas</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Estado del evento */}
        <div className="filter-group">
          <span className="filter-label">Estado</span>
          <div className="toggle-group" role="group" aria-label="Filtrar por estado">
            {[
              { value: 'all',      label: 'Todos' },
              { value: 'upcoming', label: 'Próximos' },
              { value: 'past',     label: 'Realizados' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter('status', value)}
                className={`toggle-btn ${filters.status === value ? 'toggle-btn--active' : ''}`}
                aria-pressed={filters.status === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Costo */}
        <div className="filter-group">
          <span className="filter-label">Costo</span>
          <div className="toggle-group" role="group" aria-label="Filtrar por costo">
            {[
              { value: 'all',  label: 'Todos' },
              { value: 'free', label: 'Gratuitos' },
              { value: 'paid', label: 'De pago' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter('cost', value)}
                className={`toggle-btn ${filters.cost === value ? 'toggle-btn--active' : ''}`}
                aria-pressed={filters.cost === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Limpiar filtros */}
        {activeCount > 0 && (
          <button onClick={resetFilters} className="btn btn--ghost btn--sm filter-reset">
            ✕ Limpiar filtros ({activeCount})
          </button>
        )}

      </div>
    </section>
  )
}

export default FilterBar
