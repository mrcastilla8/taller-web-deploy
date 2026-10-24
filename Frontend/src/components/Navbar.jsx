import { Link, NavLink } from 'react-router-dom'
import { useApp } from '../context/AppContext'

function Navbar() {
  const { student, clearStudent, inscriptions, openModal } = useApp()

  return (
    <header className="navbar">
      <div className="navbar__inner container">

        {/* Logo / Marca */}
        <Link to="/" className="navbar__brand">
          <span className="navbar__brand-icon" aria-hidden="true">🎓</span>
          <span className="navbar__brand-text">Eventos<strong>FISI</strong></span>
        </Link>

        {/* Navegación principal */}
        <nav className="navbar__nav" aria-label="Navegación principal">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'navbar__link--active' : ''}`
            }
          >
            Eventos del Mes
          </NavLink>
          <NavLink
            to="/mis-eventos"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'navbar__link--active' : ''}`
            }
          >
            Mis Eventos
            {inscriptions.length > 0 && (
              <span className="navbar__badge">{inscriptions.length}</span>
            )}
          </NavLink>
        </nav>

        {/* Sección de estudiante */}
        <div className="navbar__student">
          {student ? (
            <>
              <div className="navbar__student-info">
                <span className="navbar__student-icon" aria-hidden="true">👤</span>
                <div className="navbar__student-text">
                  <span className="navbar__student-name" title={student.email}>
                    {student.name}
                  </span>
                  <span className="navbar__student-email">{student.email}</span>
                </div>
              </div>
              <button
                onClick={() => openModal(null)}
                className="btn btn--ghost btn--sm"
                title="Editar mis datos"
              >
                Editar
              </button>
              <button
                onClick={clearStudent}
                className="btn btn--ghost btn--sm navbar__exit-btn"
                title="Borrar mis datos de este dispositivo"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => openModal(null)}
              className="btn btn--primary btn--sm"
            >
              👤 Identificarme
            </button>
          )}
        </div>

      </div>
    </header>
  )
}

export default Navbar
