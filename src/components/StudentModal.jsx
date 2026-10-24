import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'

function StudentModal() {
  const { student, modalOpen, pendingEventId, closeModal, confirmRegistration } = useApp()

  const isEditing = !!student && pendingEventId === null

  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [errors, setErrors] = useState({})

  // Pre-rellena el formulario al abrir si ya hay datos del estudiante
  useEffect(() => {
    if (modalOpen) {
      setForm(
        student
          ? { name: student.name, email: student.email, phone: student.phone }
          : { name: '', email: '', phone: '' }
      )
      setErrors({})
    }
  }, [modalOpen, student])

  if (!modalOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const newErrors = {}
    if (!form.name.trim() || form.name.trim().length < 3) {
      newErrors.name = 'Ingresa tu nombre completo (mín. 3 caracteres).'
    }
    if (!form.email.trim()) {
      newErrors.email = 'El correo es obligatorio.'
    } else if (!form.email.endsWith('@unmsm.edu.pe') &&
               !form.email.endsWith('@universidad.edu.pe')) {
      newErrors.email = 'Usa tu correo institucional (ej: u202100001@unmsm.edu.pe).'
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'El teléfono es obligatorio.'
    } else if (!/^\d{7,15}$/.test(form.phone.replace(/[\s\-+()]/g, ''))) {
      newErrors.phone = 'Ingresa un número de teléfono válido.'
    }
    return newErrors
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    confirmRegistration({
      name:  form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
    })
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) closeModal()
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={handleOverlayClick}
    >
      <div className="modal">

        {/* Encabezado */}
        <div className="modal__header">
          <div>
            <h2 id="modal-title" className="modal__title">
              {isEditing ? '✏️ Editar mis datos' : '🎓 Identificarme'}
            </h2>
            <p className="modal__subtitle">
              {isEditing
                ? 'Actualiza tu información de contacto.'
                : pendingEventId
                  ? 'Para inscribirte necesitamos tus datos. Solo se piden una vez.'
                  : 'Ingresa tus datos para identificarte en la plataforma.'}
            </p>
          </div>
          <button
            onClick={closeModal}
            className="modal__close"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="modal__body" noValidate>

          <div className="form-group">
            <label htmlFor="student-name" className="form-label">
              Nombre completo <span className="required">*</span>
            </label>
            <input
              id="student-name"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ej: Juan Pérez García"
              className={`input ${errors.name ? 'input--error' : ''}`}
              autoComplete="name"
              autoFocus
            />
            {errors.name && (
              <span className="field-error" role="alert">{errors.name}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="student-email" className="form-label">
              Correo institucional <span className="required">*</span>
            </label>
            <input
              id="student-email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="u202100001@unmsm.edu.pe"
              className={`input ${errors.email ? 'input--error' : ''}`}
              autoComplete="email"
            />
            {errors.email && (
              <span className="field-error" role="alert">{errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="student-phone" className="form-label">
              Teléfono / Celular <span className="required">*</span>
            </label>
            <input
              id="student-phone"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Ej: 987 654 321"
              className={`input ${errors.phone ? 'input--error' : ''}`}
              autoComplete="tel"
            />
            {errors.phone && (
              <span className="field-error" role="alert">{errors.phone}</span>
            )}
          </div>

          {/* Aviso de privacidad */}
          <p className="modal__privacy">
            🔒 Tus datos se guardan solo en este dispositivo y se usan únicamente
            para gestionar tus inscripciones.
          </p>

          {/* Acciones */}
          <div className="modal__footer">
            <button
              type="button"
              onClick={closeModal}
              className="btn btn--ghost"
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary">
              {isEditing
                ? 'Guardar cambios'
                : pendingEventId
                  ? 'Guardar e inscribirme'
                  : 'Guardar datos'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

export default StudentModal
