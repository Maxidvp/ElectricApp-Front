'use client'
import { useState } from 'react'
import '../styles/FormacionModal.css'

type TableroForm = {
  tag: string
  sistema_tension: string
  nombre: string
  ubicacion: string
  tension_fase: string
  tension_neutro: string
  frecuencia: string
}

const initialState: TableroForm = {
  tag: '',
  sistema_tension: '',
  nombre: '',
  ubicacion: '',
  tension_fase: '',
  tension_neutro: '',
  frecuencia: '',
}

type Props = {
  onGuardar: (data: TableroForm) => Promise<void>
  onCerrar: () => void
}

export default function TableroModal({ onGuardar, onCerrar }: Props) {
  const [form, setForm] = useState<TableroForm>(initialState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleGuardar = async () => {
    if (!form.tag || !form.sistema_tension) {
      setError('Tag y sistema de tensión son obligatorios')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onGuardar(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <span className="modal-title">Nuevo tablero</span>
          <button className="modal-close" onClick={onCerrar}>
            <i className="material-icons">close</i>
          </button>
        </div>

        <div className="modal-body">

          <div className="modal-section">
            <div className="modal-section-header">
              <div className="modal-dot" style={{ background: 'var(--clr-primary-a0)' }} />
              <span>Identificación</span>
            </div>
            <div className="modal-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="modal-field">
                <label>Tag <span className="req">*</span></label>
                <input name="tag" type="text" value={form.tag} onChange={handleChange} placeholder="ej. TG-01" />
              </div>
              <div className="modal-field">
                <label>Sistema de tensión <span className="req">*</span></label>
                <input name="sistema_tension" type="text" value={form.sistema_tension} onChange={handleChange} placeholder="ej. 230/400V" />
              </div>
              <div className="modal-field">
                <label>Nombre</label>
                <input name="nombre" type="text" value={form.nombre} onChange={handleChange} placeholder="ej. Tablero general" />
              </div>
              <div className="modal-field">
                <label>Ubicación</label>
                <input name="ubicacion" type="text" value={form.ubicacion} onChange={handleChange} placeholder="ej. Planta baja" />
              </div>
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-header">
              <div className="modal-dot" style={{ background: 'var(--clr-warning-a10)' }} />
              <span>Sistema eléctrico</span>
            </div>
            <div className="modal-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="modal-field">
                <label>Tensión fase (V)</label>
                <input name="tension_fase" type="number" value={form.tension_fase} onChange={handleChange} placeholder="ej. 220" />
              </div>
              <div className="modal-field">
                <label>Tensión neutro (V)</label>
                <input name="tension_neutro" type="number" value={form.tension_neutro} onChange={handleChange} placeholder="ej. 127" />
              </div>
              <div className="modal-field">
                <label>Frecuencia (Hz)</label>
                <input name="frecuencia" type="number" value={form.frecuencia} onChange={handleChange} placeholder="ej. 50" />
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              fontSize: 13, color: 'var(--clr-danger-a10)', padding: '8px 12px',
              background: 'rgba(156,33,33,0.15)', borderRadius: 8,
              border: '1px solid var(--clr-danger-a0)'
            }}>
              {error}
            </div>
          )}

        </div>

        <div className="modal-footer">
          <button className="modal-btn" onClick={onCerrar}>Cancelar</button>
          <button className="modal-btn modal-btn-primary" onClick={handleGuardar} disabled={loading}>
            {loading ? 'Guardando...' : 'Crear tablero'}
          </button>
        </div>

      </div>
    </div>
  )
}
