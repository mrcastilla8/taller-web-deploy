import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import { useApp } from '../context/AppContext'

// Envuelve las vistas protegidas con la barra de navegación.
function Layout() {
  const { loading, error, refreshState } = useApp()
  return (
    <>
      <Navbar />
      <main className="main-content">
        {error && <div className="page" role="alert"><p>{error}</p><button className="btn btn--outline" onClick={refreshState}>Reintentar conexión</button></div>}
        {loading ? <p className="page" role="status">Cargando eventos del servidor…</p> : <Outlet />}
      </main>
    </>
  )
}

export default Layout
