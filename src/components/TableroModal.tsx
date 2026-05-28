'use client'
import { useState } from 'react'

type TableroForm = {
  tag: string
  nombre: string
  ubicacion: string
  tension_mono: string
  tension_bi: string
  tension_tri: string
  frecuencia: string
}

const initialState: TableroForm = {
  tag: '',
  nombre: '',
  ubicacion: '',
  tension_mono: '',
  tension_bi: '',
  tension_tri: '',
  frecuencia: '',
}

type Props = {
  onGuardar: (data: TableroForm) => Promise<void>
  onCerrar: () => void
}

const cx = {
  input: 'h-[34px] border border-surface-tonal-a30 rounded-[7px] px-[10px] text-[13px] bg-surface-a10 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10 focus:shadow-[0_0_0_3px_rgba(64,119,209,0.2)]',
  label: 'text-xs text-font-a20',
  field: 'flex flex-col gap-[5px]',
  section: 'border border-surface-tonal-a20 rounded-[10px] overflow-hidden',
  sectionHdr: 'flex items-center gap-2 px-[14px] py-2 bg-surface-tonal-a0 border-b border-surface-tonal-a20 text-xs font-medium text-font-a20',
  grid: 'p-3 grid gap-[10px] bg-surface-a10',
  btn: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 transition-colors hover:bg-surface-tonal-a10 hover:text-font-a0',
  btnPrimary: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 transition-colors hover:bg-info-a10 hover:border-info-a10 disabled:opacity-50 disabled:cursor-not-allowed',
}

export default function TableroModal({ onGuardar, onCerrar }: Props) {
  const [form, setForm] = useState<TableroForm>(initialState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleGuardar = async () => {
    if (!form.tag) {
      setError('El tag es obligatorio')
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-100" onClick={onCerrar}>
      <div className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl w-140 max-w-[95vw] max-h-[90vh] overflow-y-auto flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-tonal-a20 bg-surface-tonal-a0 rounded-t-xl">
          <span className="text-[14px] font-medium text-font-a0">Nuevo tablero</span>
          <button className="bg-transparent border-none cursor-pointer text-font-a20 flex items-center p-1 rounded-md hover:bg-surface-tonal-a10 hover:text-font-a0" onClick={onCerrar}>
            <i className="material-icons">close</i>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 bg-surface-a0">

          <div className={cx.section}>
            <div className={cx.sectionHdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-primary-a0" />
              <span>Identificación</span>
            </div>
            <div className={`${cx.grid} grid-cols-2`}>
              <div className={cx.field}>
                <label className={cx.label}>Tag <span className="text-danger-a10 ml-0.5">*</span></label>
                <input className={cx.input} name="tag" type="text" value={form.tag} onChange={handleChange} placeholder="ej. TG-01" />
              </div>
              <div className={cx.field}>
                <label className={cx.label}>Nombre</label>
                <input className={cx.input} name="nombre" type="text" value={form.nombre} onChange={handleChange} placeholder="ej. Tablero general" />
              </div>
              <div className={`${cx.field} col-span-2`}>
                <label className={cx.label}>Ubicación</label>
                <input className={cx.input} name="ubicacion" type="text" value={form.ubicacion} onChange={handleChange} placeholder="ej. Planta baja" />
              </div>
            </div>
          </div>

          <div className={cx.section}>
            <div className={cx.sectionHdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-warning-a10" />
              <span>Sistema eléctrico</span>
            </div>
            <div className={`${cx.grid} grid-cols-4`}>
              <div className={cx.field}>
                <label className={cx.label}>Tensión mono (V)</label>
                <input className={cx.input} name="tension_mono" type="number" value={form.tension_mono} onChange={handleChange} placeholder="ej. 220" />
              </div>
              <div className={cx.field}>
                <label className={cx.label}>Tensión bi (V)</label>
                <input className={cx.input} name="tension_bi" type="number" value={form.tension_bi} onChange={handleChange} placeholder="ej. 220" />
              </div>
              <div className={cx.field}>
                <label className={cx.label}>Tensión tri (V)</label>
                <input className={cx.input} name="tension_tri" type="number" value={form.tension_tri} onChange={handleChange} placeholder="ej. 380" />
              </div>
              <div className={cx.field}>
                <label className={cx.label}>Frecuencia (Hz)</label>
                <input className={cx.input} name="frecuencia" type="number" value={form.frecuencia} onChange={handleChange} placeholder="ej. 50" />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-[13px] text-danger-a10 px-3 py-2 bg-[rgba(156,33,33,0.15)] rounded-lg border border-danger-a0">
              {error}
            </div>
          )}

        </div>

        <div className="px-4 py-3 border-t border-surface-tonal-a20 flex gap-2 justify-end bg-surface-tonal-a0 rounded-b-xl">
          <button className={cx.btn} onClick={onCerrar}>Cancelar</button>
          <button className={cx.btnPrimary} onClick={handleGuardar} disabled={loading}>
            {loading ? 'Guardando...' : 'Crear tablero'}
          </button>
        </div>

      </div>
    </div>
  )
}
