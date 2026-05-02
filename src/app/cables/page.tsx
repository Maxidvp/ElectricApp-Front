'use client'
import { useState } from 'react'
import './CableForm.css'

type CableForm = {
  seccion_f: string; seccion_n: string; seccion_t: string
  Nfases: string; Nneutro: string; Ntierra: string
  diametro: string; peso_metro: string
}

const initialState: CableForm = {
  seccion_f: '', seccion_n: '', seccion_t: '',
  Nfases: '', Nneutro: '', Ntierra: '',
  diametro: '', peso_metro: ''
}

type Props = { familiaId: number; onSuccess?: () => void }

export default function CableForm({ familiaId, onSuccess }: Props) {
  const [form, setForm] = useState<CableForm>(initialState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('http://localhost:3000/cables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familia_id: familiaId,
          seccion_f:  Number(form.seccion_f),
          seccion_n:  Number(form.seccion_n),
          seccion_t:  Number(form.seccion_t),
          Nfases:     Number(form.Nfases),
          Nneutro:    Number(form.Nneutro),
          Ntierra:    Number(form.Ntierra),
          diametro:   form.diametro   ? Number(form.diametro)   : undefined,
          peso_metro: form.peso_metro ? Number(form.peso_metro) : undefined,
        })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setForm(initialState)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-wrap">

      <div className="form-card">
        <div className="form-card-header">
          <div className="form-card-dot" style={{ background: '#378ADD' }} />
          <span className="form-card-title">Secciones y conductores</span>
          <span className="form-card-badge required">* obligatorio</span>
        </div>
        <div className="form-card-body">
          <div className="form-field"><label>Sección fase (mm²) <span>*</span></label><input name="seccion_f" type="number" step="0.1" value={form.seccion_f} onChange={handleChange} required placeholder="ej. 2.5" /></div>
          <div className="form-field"><label>Sección neutro (mm²) <span>*</span></label><input name="seccion_n" type="number" step="0.1" value={form.seccion_n} onChange={handleChange} required placeholder="ej. 2.5" /></div>
          <div className="form-field"><label>Sección tierra (mm²) <span>*</span></label><input name="seccion_t" type="number" step="0.1" value={form.seccion_t} onChange={handleChange} required placeholder="ej. 2.5" /></div>
          <div className="form-field"><label>N° fases <span>*</span></label>
            <select name="Nfases" value={form.Nfases} onChange={handleChange} required>
              <option value="">—</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
            </select>
          </div>
          <div className="form-field"><label>N° neutros <span>*</span></label>
            <select name="Nneutro" value={form.Nneutro} onChange={handleChange} required>
              <option value="">—</option><option value="0">0</option><option value="1">1</option>
            </select>
          </div>
          <div className="form-field"><label>N° tierras <span>*</span></label>
            <select name="Ntierra" value={form.Ntierra} onChange={handleChange} required>
              <option value="">—</option><option value="0">0</option><option value="1">1</option>
            </select>
          </div>
        </div>
      </div>

      <div className="form-card">
        <div className="form-card-header">
          <div className="form-card-dot" style={{ background: '#888780' }} />
          <span className="form-card-title">Características físicas</span>
          <span className="form-card-badge optional">opcional</span>
        </div>
        <div className="form-card-body">
          <div className="form-field"><label>Diámetro ext. (mm)</label><input name="diametro" type="number" step="0.1" value={form.diametro} onChange={handleChange} placeholder="ej. 12.4" /></div>
          <div className="form-field"><label>Peso por metro (kg/m)</label><input name="peso_metro" type="number" step="0.01" value={form.peso_metro} onChange={handleChange} placeholder="ej. 0.24" /></div>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="form-btn" onClick={() => setForm(initialState)}>Cancelar</button>
        <button type="submit" className="form-btn form-btn-primary" disabled={loading}>
          {loading ? 'Guardando...' : 'Agregar cable'}
        </button>
      </div>

    </form>
  )
}