import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

// Envuelve las vistas protegidas con la barra de navegación.
function Layout() {
  return (
    <>
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
    </>
  )
}

export default Layout
