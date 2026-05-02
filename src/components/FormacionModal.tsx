'use client'
import { useEffect, useState } from 'react'
import { getFamiliasCables } from '@/services/familiasCables'
import { getCablesPorFamilia } from '@/services/cables'
import '../styles/FormacionModal.css'

type FamiliaCable = {
  id: number
  nombre: string
}

type Cable = {
  id: number
  nombre: string
}

type FormacionForm = {
  familia_id: string
  nombre: string
  cable_fase_id: string
  cond_por_fase: string
  Nfases: string
  cable_neutro_id: string
  Nneutro: string
  familia_tierra_id: string
  cable_tierra_id: string
}

const initialState: FormacionForm = {
  familia_id: '',
  nombre: '',
  cable_fase_id: '', cond_por_fase: '1', Nfases: '3',
  cable_neutro_id: '', Nneutro: '1',
  familia_tierra_id: '', cable_tierra_id: '',
}

type Props = {
  formacionInicial?: FormacionForm
  onGuardar: (data: FormacionForm) => Promise<void>
  onCerrar: () => void
}

export default function FormacionModal({ formacionInicial, onGuardar, onCerrar }: Props) {
  const [familias, setFamilias] = useState<FamiliaCable[]>([])
  const [cablesFase, setCablesFase] = useState<Cable[]>([])
  const [cablesNeutro, setCablesNeutro] = useState<Cable[]>([])
  const [cablesTierra, setCablesTierra] = useState<Cable[]>([])
  const [form, setForm] = useState<FormacionForm>(formacionInicial ?? initialState)
  const [loading, setLoading] = useState(false)
  const [nombreEditado, setNombreEditado] = useState(false)

  useEffect(() => {
    getFamiliasCables().then(setFamilias)
  }, [])

  // Cables de fase y neutro comparten familia
  useEffect(() => {
    if (!form.familia_id) {
      setCablesFase([])
      setCablesNeutro([])
      return
    }
    getCablesPorFamilia(Number(form.familia_id)).then((cables) => {
      setCablesFase(cables)
      setCablesNeutro(cables)
    })
  }, [form.familia_id])

  // Cables de tierra tienen su propia familia
  useEffect(() => {
    if (!form.familia_tierra_id) {
      setCablesTierra([])
      return
    }
    getCablesPorFamilia(Number(form.familia_tierra_id)).then(setCablesTierra)
  }, [form.familia_tierra_id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    if (name === 'nombre') {
      setNombreEditado(true)
      setForm({ ...form, nombre: value })
      return
    }

    if (name === 'familia_id') {
      setForm(prev => ({
        ...prev,
        familia_id: value,
        cable_fase_id: '',
        cable_neutro_id: '',
        nombre: nombreEditado ? prev.nombre : ''
      }))
      return
    }

    if (name === 'familia_tierra_id') {
      setForm(prev => ({
        ...prev,
        familia_tierra_id: value,
        cable_tierra_id: '',
      }))
      return
    }

    setForm(prev => {
      const nuevo = { ...prev, [name]: value }
      if (!nombreEditado) {
        nuevo.nombre = generarNombre(nuevo, cablesFase, cablesNeutro, cablesTierra)
      }
      return nuevo
    })
  }

  function generarNombre(
    form: FormacionForm,
    cablesFase: Cable[],
    cablesNeutro: Cable[],
    cablesTierra: Cable[]
  ): string {
    const fase = cablesFase.find(c => String(c.id) === form.cable_fase_id)
    const neutro = cablesNeutro.find(c => String(c.id) === form.cable_neutro_id)
    const tierra = cablesTierra.find(c => String(c.id) === form.cable_tierra_id)

    const partes: string[] = []

    if (fase) {
      const conductores = Number(form.cond_por_fase) > 1
        ? `${form.Nfases}x(${form.cond_por_fase}x${fase.nombre})`
        : `${form.Nfases}x${fase.nombre}`
      partes.push(conductores)
    }

    if (neutro && Number(form.Nneutro) > 0) {
      const n = Number(form.Nneutro) > 1
        ? `${form.Nneutro}x${neutro.nombre}N`
        : `${neutro.nombre}N`
      partes.push(n)
    }

    if (tierra) {
      partes.push(`${tierra.nombre}T`)
    }

    return partes.join('+')
  }

  
const handleGuardar = async () => {
  if (!form.cable_fase_id || !form.familia_id) return
  setLoading(true)
  try {
    await onGuardar(form)
  } finally {
    setLoading(false)
  }
}

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <span className="modal-title">Formación</span>
          <button className="modal-close" onClick={onCerrar}>
            <i className="material-icons">close</i>
          </button>
        </div>

        <div className="modal-body">

          {/* Fase y Neutro agrupados — comparten familia */}
          <div className="modal-section">
            <div className="modal-section-header">
              <div className="modal-dot" style={{ background: '#378ADD' }} />
              <span>Conductores</span>
            </div>

            {/* Selector de familia compartido */}
            <div style={{ padding: '12px 12px 0' }}>
              <div className="modal-field">
                <label>Familia <span className="req">*</span></label>
                <select name="familia_id" value={form.familia_id} onChange={handleChange}>
                  <option value="">— Seleccioná —</option>
                  {familias.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Divisor interno */}
            <div style={{ margin: '12px 12px 0', borderTop: '1px solid var(--clr-surface-tonal-a20)' }} />

            {/* Fase */}
            <div style={{ padding: '8px 12px 0' }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--clr-font-a20)', letterSpacing: '0.04em' }}>
                FASE
              </span>
            </div>
            <div className="modal-grid">
              <div className="modal-field">
                <label>Cable <span className="req">*</span></label>
                <select name="cable_fase_id" value={form.cable_fase_id} onChange={handleChange} disabled={!form.familia_id}>
                  <option value="">— Seleccioná —</option>
                  {cablesFase.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="modal-field">
                <label>N° fases <span className="req">*</span></label>
                <input name="Nfases" type="number" min="1" max="3" value={form.Nfases} onChange={handleChange} />
              </div>
              <div className="modal-field">
                <label>Conductores por fase <span className="req">*</span></label>
                <input name="cond_por_fase" type="number" min="1" max="4" value={form.cond_por_fase} onChange={handleChange} />
              </div>
            </div>

            {/* Divisor interno */}
            <div style={{ margin: '8px 12px 0', borderTop: '1px solid var(--clr-surface-tonal-a20)' }} />

            {/* Neutro */}
            <div style={{ padding: '8px 12px 0' }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--clr-font-a20)', letterSpacing: '0.04em' }}>
                NEUTRO
              </span>
            </div>
            <div className="modal-grid" style={{ paddingBottom: 12 }}>
              <div className="modal-field">
                <label>N° neutros</label>
                <input name="Nneutro" type="number" min="0" max="2" value={form.Nneutro} onChange={handleChange} />
              </div>
              <div className="modal-field">
                <label>Cable</label>
                <select name="cable_neutro_id" value={form.cable_neutro_id} onChange={handleChange} disabled={!form.familia_id || form.Nneutro === '0'}>
                  <option value="">— Sin neutro —</option>
                  {cablesNeutro.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* Tierra — familia propia */}
          <div className="modal-section">
            <div className="modal-section-header">
              <div className="modal-dot" style={{ background: '#888780' }} />
              <span>Tierra</span>
            </div>
            <div className="modal-grid">
              <div className="modal-field">
                <label>Familia</label>
                <select name="familia_tierra_id" value={form.familia_tierra_id} onChange={handleChange}>
                  <option value="">— Sin tierra —</option>
                  {familias.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="modal-field">
                <label>Cable</label>
                <select name="cable_tierra_id" value={form.cable_tierra_id} onChange={handleChange} disabled={!form.familia_tierra_id}>
                  <option value="">— Sin tierra —</option>
                  {cablesTierra.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {/* Nombre de la formación */}
          <div className="modal-section">
            <div className="modal-section-header">
              <div className="modal-dot" style={{ background: '#6f68b8' }} />
              <span>Nombre</span>
            </div>
            <div className="modal-grid">
              <div className="modal-field" style={{ gridColumn: '1 / -1' }}>
                <label>
                  Nombre de la formación
                  {!nombreEditado && (
                    <span style={{ color: 'var(--clr-surface-tonal-a40)', marginLeft: 8, fontSize: 11 }}>
                      generado automáticamente
                    </span>
                  )}
                  {nombreEditado && (
                    <button
                      onClick={() => {
                        setNombreEditado(false)
                        setForm(prev => ({
                          ...prev,
                          nombre: generarNombre(prev, cablesFase, cablesNeutro, cablesTierra)
                        }))
                      }}
                      style={{
                        marginLeft: 8, fontSize: 11, background: 'transparent',
                        border: 'none', cursor: 'pointer', color: 'var(--clr-info-a10)',
                        textDecoration: 'underline'
                      }}
                    >
                      restaurar automático
                    </button>
                  )}
                </label>
                <input
                  name="nombre"
                  type="text"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="ej: 3x10AWG+10AWGN+10AWGT"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn" onClick={onCerrar}>Cancelar</button>
          <button className="modal-btn modal-btn-primary" onClick={handleGuardar} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar formación'}
          </button>
        </div>

      </div>
    </div>
  )
}