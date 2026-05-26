'use client'
import { useState } from 'react'

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

const cx = {
  card: 'border border-surface-tonal-a20 rounded-xl overflow-hidden',
  cardHeader: 'flex items-center gap-2 px-4 py-[10px] bg-surface-tonal-a0 border-b border-surface-tonal-a20',
  cardDot: 'w-[7px] h-[7px] rounded-full shrink-0',
  cardTitle: 'text-xs font-medium text-font-a20 tracking-[0.04em]',
  cardBody: 'p-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 bg-surface-a0',
  field: 'flex flex-col gap-[5px]',
  label: 'text-xs text-font-a20',
  input: 'h-9 px-[10px] text-[13px] border border-surface-tonal-a20 rounded-lg bg-surface-a10 text-font-a0 outline-none transition-[border-color] duration-150 w-full hover:border-surface-tonal-a40 focus:border-info-a10 focus:shadow-[0_0_0_3px_rgba(64,119,209,0.2)]',
  btn: 'h-9 px-[18px] rounded-lg text-[13px] font-medium cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 transition-colors hover:bg-surface-tonal-a10 hover:text-font-a0',
  btnPrimary: 'h-9 px-[18px] rounded-lg text-[13px] font-medium cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 transition-colors hover:bg-info-a10 hover:border-info-a10 disabled:opacity-50 disabled:cursor-not-allowed',
}

export default function CableForm({ familiaId, onSuccess }: Props) {
  const [form, setForm] = useState<CableForm>(initialState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
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
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="flex flex-col gap-4">

      <div className={cx.card}>
        <div className={cx.cardHeader}>
          <div className={cx.cardDot} style={{ background: '#378ADD' }} />
          <span className={cx.cardTitle}>Secciones y conductores</span>
          <span className="ml-auto text-[11px] text-danger-a10">* obligatorio</span>
        </div>
        <div className={cx.cardBody}>
          <div className={cx.field}><label className={cx.label}>Sección fase (mm²) <span className="text-danger-a10">*</span></label><input className={cx.input} name="seccion_f" type="number" step="0.1" value={form.seccion_f} onChange={handleChange} required placeholder="ej. 2.5" /></div>
          <div className={cx.field}><label className={cx.label}>Sección neutro (mm²) <span className="text-danger-a10">*</span></label><input className={cx.input} name="seccion_n" type="number" step="0.1" value={form.seccion_n} onChange={handleChange} required placeholder="ej. 2.5" /></div>
          <div className={cx.field}><label className={cx.label}>Sección tierra (mm²) <span className="text-danger-a10">*</span></label><input className={cx.input} name="seccion_t" type="number" step="0.1" value={form.seccion_t} onChange={handleChange} required placeholder="ej. 2.5" /></div>
          <div className={cx.field}>
            <label className={cx.label}>N° fases <span className="text-danger-a10">*</span></label>
            <select className={cx.input} name="Nfases" value={form.Nfases} onChange={handleChange} required>
              <option value="">—</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
            </select>
          </div>
          <div className={cx.field}>
            <label className={cx.label}>N° neutros <span className="text-danger-a10">*</span></label>
            <select className={cx.input} name="Nneutro" value={form.Nneutro} onChange={handleChange} required>
              <option value="">—</option><option value="0">0</option><option value="1">1</option>
            </select>
          </div>
          <div className={cx.field}>
            <label className={cx.label}>N° tierras <span className="text-danger-a10">*</span></label>
            <select className={cx.input} name="Ntierra" value={form.Ntierra} onChange={handleChange} required>
              <option value="">—</option><option value="0">0</option><option value="1">1</option>
            </select>
          </div>
        </div>
      </div>

      <div className={cx.card}>
        <div className={cx.cardHeader}>
          <div className={cx.cardDot} style={{ background: '#888780' }} />
          <span className={cx.cardTitle}>Características físicas</span>
          <span className="ml-auto text-[11px] text-surface-tonal-a40">opcional</span>
        </div>
        <div className={cx.cardBody}>
          <div className={cx.field}><label className={cx.label}>Diámetro ext. (mm)</label><input className={cx.input} name="diametro" type="number" step="0.1" value={form.diametro} onChange={handleChange} placeholder="ej. 12.4" /></div>
          <div className={cx.field}><label className={cx.label}>Peso por metro (kg/m)</label><input className={cx.input} name="peso_metro" type="number" step="0.01" value={form.peso_metro} onChange={handleChange} placeholder="ej. 0.24" /></div>
        </div>
      </div>

      {error && (
        <p className="text-[13px] text-danger-a10 px-3 py-2 bg-[rgba(156,33,33,0.15)] rounded-lg border border-danger-a0">
          {error}
        </p>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" className={cx.btn} onClick={() => setForm(initialState)}>Cancelar</button>
        <button type="submit" className={cx.btnPrimary} disabled={loading}>
          {loading ? 'Guardando...' : 'Agregar cable'}
        </button>
      </div>

    </form>
  )
}
