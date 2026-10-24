import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout'
import StudentModal from './components/StudentModal'
import EventList from './pages/EventList'
import EventDetail from './pages/EventDetail'
import MyEvents from './pages/MyEvents'

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/"             element={<EventList />} />
            <Route path="/eventos/:id" element={<EventDetail />} />
            <Route path="/mis-eventos" element={<MyEvents />} />
          </Route>

          {/* Cualquier ruta desconocida → página principal */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Modal global de identificación de estudiante */}
        <StudentModal />
      </BrowserRouter>
    </AppProvider>
  )
}

export default App
