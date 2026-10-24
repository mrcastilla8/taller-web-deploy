// Formatea "2026-05-17" → "17 de mayo de 2026"
export function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Formatea "14:00" → "2:00 PM"
export function formatTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`
}

// Devuelve el nombre del día de la semana para una fecha "YYYY-MM-DD"
export function getDayName(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-PE', {
    weekday: 'long',
  })
}

// true si la fecha ya pasó (estrictamente antes de hoy)
export function isPastEvent(dateStr) {
  const today = new Date().toISOString().split('T')[0]
  return dateStr < today
}
