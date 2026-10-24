import { createContext, useContext, useState } from 'react'

// ── Contexto global de la aplicación ─────────────────────────────────────────
// Gestiona: perfil del estudiante + inscripciones a eventos.
// Ambos persisten en localStorage.

const AppContext = createContext(null)

export function AppProvider({ children }) {
  // Datos del estudiante identificado: { name, email, phone } | null
  const [student, setStudent] = useState(() => {
    try {
      const saved = localStorage.getItem('edu_student')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  // Array de IDs de eventos en los que el alumno está inscrito
  const [inscriptions, setInscriptions] = useState(() => {
    try {
      const saved = localStorage.getItem('edu_inscriptions')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Estado del modal de identificación
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingEventId, setPendingEventId] = useState(null)

  // ── Perfil del estudiante ───────────────────────────────────────────────────
  const saveStudent = (data) => {
    setStudent(data)
    localStorage.setItem('edu_student', JSON.stringify(data))
  }

  const clearStudent = () => {
    setStudent(null)
    setInscriptions([])
    localStorage.removeItem('edu_student')
    localStorage.removeItem('edu_inscriptions')
  }

  // ── Modal ───────────────────────────────────────────────────────────────────
  const openModal = (eventId = null) => {
    setPendingEventId(eventId)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setPendingEventId(null)
  }

  // Llamado al enviar el formulario del modal: guarda perfil e inscribe si había evento pendiente
  const confirmRegistration = (data) => {
    saveStudent(data)
    if (pendingEventId !== null) {
      setInscriptions((prev) => {
        if (prev.includes(pendingEventId)) return prev
        const updated = [...prev, pendingEventId]
        localStorage.setItem('edu_inscriptions', JSON.stringify(updated))
        return updated
      })
    }
    closeModal()
  }

  // ── Inscripciones ───────────────────────────────────────────────────────────
  const inscribe = (eventId) => {
    // Si el estudiante no está identificado, abre el modal primero
    if (!student) {
      openModal(eventId)
      return
    }
    setInscriptions((prev) => {
      if (prev.includes(eventId)) return prev
      const updated = [...prev, eventId]
      localStorage.setItem('edu_inscriptions', JSON.stringify(updated))
      return updated
    })
  }

  const cancelInscription = (eventId) => {
    setInscriptions((prev) => {
      const updated = prev.filter((id) => id !== eventId)
      localStorage.setItem('edu_inscriptions', JSON.stringify(updated))
      return updated
    })
  }

  const isInscribed = (eventId) => inscriptions.includes(eventId)

  return (
    <AppContext.Provider
      value={{
        student, saveStudent, clearStudent,
        inscriptions, inscribe, cancelInscription, isInscribed,
        modalOpen, openModal, closeModal, confirmRegistration,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// Hook personalizado — evita importar useContext + AppContext en cada componente
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}
