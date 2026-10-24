import { useState, useMemo } from 'react'
import { mockEvents, CATEGORIES } from '../data/mockData'

// Hook que encapsula la lógica de filtrado de eventos.
// Devuelve los eventos filtrados y los controles de filtro.
export function useEventFilter() {
  const today = new Date().toISOString().split('T')[0]

  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    cost: 'all',     // 'all' | 'free' | 'paid'
    status: 'all',   // 'all' | 'upcoming' | 'past'
  })

  const filteredEvents = useMemo(() => {
    return mockEvents.filter((event) => {
      const isUpcoming = event.date >= today

      if (filters.status === 'upcoming' && !isUpcoming) return false
      if (filters.status === 'past'     && isUpcoming)  return false
      if (filters.category !== 'all'    && event.category !== filters.category) return false
      if (filters.cost === 'free'       && !event.isFree) return false
      if (filters.cost === 'paid'       && event.isFree)  return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const match =
          event.title.toLowerCase().includes(q) ||
          event.speaker.toLowerCase().includes(q) ||
          event.category.toLowerCase().includes(q)
        if (!match) return false
      }

      return true
    })
  }, [filters, today])

  const setFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const resetFilters = () =>
    setFilters({ search: '', category: 'all', cost: 'all', status: 'all' })

  const activeCount = Object.values(filters).filter(
    (v) => v !== 'all' && v !== ''
  ).length

  return { filters, setFilter, resetFilters, filteredEvents, activeCount, CATEGORIES, today }
}
