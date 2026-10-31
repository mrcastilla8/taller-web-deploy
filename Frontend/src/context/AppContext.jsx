import { createContext, useContext, useEffect, useState } from 'react'
import { createApi } from '../api/client'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [api] = useState(() => createApi())
  const [data, setData] = useState({ student: null, inscriptions: [], events: [] })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingEventId, setPendingEventId] = useState(null)
  const refreshState = async () => {
    setLoading(true)
    setError('')
    try {
      const [state, values] = await Promise.all([api('/state'), api('/categories')])
      setData(state)
      setCategories(values)
    } catch (failure) {
      setError(failure.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor. Vuelve a intentarlo.' : failure.message)
    } finally { setLoading(false) }
  }
  useEffect(() => { void refreshState() }, [api])
  const openModal = (eventId = null) => {
    setPendingEventId(eventId)
    setError('')
    setModalOpen(true)
  }
  const closeModal = () => {
    if (busy) return
    setModalOpen(false)
    setPendingEventId(null)
  }
  const mutate = async (operation) => {
    if (busy) return false
    setBusy(true)
    setError('')
    try { await operation(); return true }
    catch (failure) { setError(failure.message); return false }
    finally { setBusy(false) }
  }
  const saveStudent = (student) => mutate(async () => setData(await api('/student', 'PUT', student)))
  const clearStudent = () => mutate(async () => setData(await api('/student', 'DELETE')))
  const confirmRegistration = (student) => mutate(async () => {
    setData(await api('/student', 'PUT', student))
    if (pendingEventId !== null) setData(await api('/inscriptions', 'POST', { eventId: pendingEventId }))
    setModalOpen(false)
    setPendingEventId(null)
  })
  const inscribe = (eventId) => {
    if (!data.student) { openModal(eventId); return }
    return mutate(async () => setData(await api('/inscriptions', 'POST', { eventId })))
  }
  const cancelInscription = (eventId) => mutate(async () => setData(await api(`/inscriptions/${eventId}`, 'DELETE')))
  return (
    <AppContext.Provider value={{
      ...data, categories, loading, busy, error, refreshState,
      saveStudent, clearStudent, inscribe, cancelInscription,
      isInscribed: (eventId) => data.inscriptions.includes(eventId),
      modalOpen, openModal, closeModal, confirmRegistration,
    }}>
      {children}
    </AppContext.Provider>
  )
}
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}
