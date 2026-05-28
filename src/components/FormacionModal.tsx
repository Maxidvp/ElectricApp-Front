'use client'
import { useEffect, useState } from 'react'
import { useCables, type CableItem } from '@/context/CablesContext'

type FormacionForm = {
  familia_id: string
  cable_fase_id: string
  cond_por_fase: string
  Nfases: string
  cable_neutro_id: string
  Nneutro: string
  familia_tierra_id: string
  cable_tierra_id: string
}

export type FormacionCables = {
  fase: CableItem
  neutro: CableItem | null
  tierra: CableItem | null
}

const initialState: FormacionForm = {
  familia_id: '',
  cable_fase_id: '', cond_por_fase: '1', Nfases: '3',
  cable_neutro_id: '', Nneutro: '1',
  familia_tierra_id: '', cable_tierra_id: '',
}

type Props = {
  formacionInicial?: FormacionForm
  onGuardar: (data: FormacionForm, cables: FormacionCables) => void | Promise<void>
  onCerrar: () => void
}

let globalClipboard: FormacionForm | null = null

const cx = {
  input: 'h-[34px] border border-surface-tonal-a30 rounded-[7px] px-[10px] text-[13px] bg-surface-a10 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10 focus:shadow-[0_0_0_3px_rgba(64,119,209,0.2)] disabled:opacity-40 disabled:cursor-not-allowed',
  label: 'text-xs text-font-a20',
  field: 'flex flex-col gap-[5px]',
  section: 'border border-surface-tonal-a20 rounded-[10px] overflow-hidden',
  sectionHdr: 'flex items-center gap-2 px-[14px] py-2 bg-surface-tonal-a0 border-b border-surface-tonal-a20 text-xs font-medium text-font-a20',
  grid: 'p-3 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-[10px] bg-surface-a10',
  btn: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 transition-colors hover:bg-surface-tonal-a10 hover:text-font-a0 disabled:opacity-50 disabled:cursor-not-allowed',
  btnPrimary: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 transition-colors hover:bg-info-a10 hover:border-info-a10 disabled:opacity-50 disabled:cursor-not-allowed',
}

export default function FormacionModal({ formacionInicial, onGuardar, onCerrar }: Props) {
  const { familias, getCablesDeFamilia } = useCables()
  const [cablesFase,   setCablesFase]   = useState<CableItem[]>([])
  const [cablesNeutro, setCablesNeutro] = useState<CableItem[]>([])
  const [cablesTierra, setCablesTierra] = useState<CableItem[]>([])
  const [form, setForm] = useState<FormacionForm>(formacionInicial ?? initialState)
  const [loading, setLoading] = useState(false)
  const [clipboardSnapshot, setClipboardSnapshot] = useState<FormacionForm | null>(globalClipboard)
  const [copiadoReciente, setCopiadoReciente] = useState(false)

  const handleCopiar = () => {
    globalClipboard = { ...form }
    setClipboardSnapshot(globalClipboard)
    setCopiadoReciente(true)
    setTimeout(() => setCopiadoReciente(false), 1500)
  }

  const handlePegar = async () => {
    if (!clipboardSnapshot) return
    const snap = clipboardSnapshot
    setForm({ ...snap })
    if (!snap.cable_fase_id || !snap.familia_id) return
    const cablesF = snap.familia_id ? await getCablesDeFamilia(Number(snap.familia_id)) : []
    const fase    = cablesF.find(c => String(c.id) === snap.cable_fase_id)
    if (!fase) return
    const neutro  = cablesF.find(c => String(c.id) === snap.cable_neutro_id) ?? null
    const cablesT = snap.familia_tierra_id ? await getCablesDeFamilia(Number(snap.familia_tierra_id)) : []
    const tierra  = cablesT.find(c => String(c.id) === snap.cable_tierra_id) ?? null
    await onGuardar(snap, { fase, neutro, tierra })
    onCerrar()
  }

  useEffect(() => {
    if (!form.familia_id) { setCablesFase([]); setCablesNeutro([]); return }
    getCablesDeFamilia(Number(form.familia_id)).then(cables => {
      setCablesFase(cables)
      setCablesNeutro(cables)
    })
  }, [form.familia_id])

  useEffect(() => {
    if (!form.familia_tierra_id) { setCablesTierra([]); return }
    getCablesDeFamilia(Number(form.familia_tierra_id)).then(setCablesTierra)
  }, [form.familia_tierra_id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === 'familia_id') {
      setForm(prev => ({ ...prev, familia_id: value, cable_fase_id: '', cable_neutro_id: '' }))
      return
    }
    if (name === 'familia_tierra_id') {
      setForm(prev => ({ ...prev, familia_tierra_id: value, cable_tierra_id: '' }))
      return
    }
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleGuardar = async () => {
    if (!form.cable_fase_id || !form.familia_id) return
    const fase   = cablesFase.find(c => String(c.id) === form.cable_fase_id)
    if (!fase) return
    const neutro = cablesNeutro.find(c => String(c.id) === form.cable_neutro_id) ?? null
    const tierra = cablesTierra.find(c => String(c.id) === form.cable_tierra_id) ?? null
    setLoading(true)
    try {
      await onGuardar(form, { fase, neutro, tierra })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-100" onClick={onCerrar}>
      <div className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl w-140 max-w-[95vw] max-h-[90vh] overflow-y-auto flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-tonal-a20 bg-surface-tonal-a0 rounded-t-xl gap-2">
          <span className="text-[14px] font-medium text-font-a0">Formación</span>
          <button className={cx.btn} onClick={handleCopiar}>
            {copiadoReciente ? '¡Copiado!' : 'Copiar'}
          </button>
          <button className={cx.btn} onClick={handlePegar} disabled={!clipboardSnapshot}>
            Pegar
          </button>
          <button className="bg-transparent border-none cursor-pointer text-font-a20 flex items-center p-1 rounded-md hover:bg-surface-tonal-a10 hover:text-font-a0" onClick={onCerrar}>
            <i className="material-icons">close</i>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 bg-surface-a0">

          <div className={cx.section}>
            <div className={cx.sectionHdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#378ADD' }} />
              <span>Conductores</span>
            </div>

            <div className="px-3 pt-3">
              <div className={cx.field}>
                <label className={cx.label}>Familia <span className="text-danger-a10 ml-0.5">*</span></label>
                <select className={cx.input} name="familia_id" value={form.familia_id} onChange={handleChange}>
                  <option value="">— Seleccioná —</option>
                  {familias.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mx-3 mt-3 border-t border-surface-tonal-a20" />

            <div className="px-3 pt-2">
              <span className="text-[11px] font-medium text-font-a20 tracking-[0.04em]">FASE</span>
            </div>
            <div className={cx.grid}>
              <div className={cx.field}>
                <label className={cx.label}>Conductores por fase <span className="text-danger-a10 ml-0.5">*</span></label>
                <input className={cx.input} name="cond_por_fase" type="number" min="1" max="4" value={form.cond_por_fase} onChange={handleChange} />
              </div>
              <div className={cx.field}>
                <label className={cx.label}>N° fases <span className="text-danger-a10 ml-0.5">*</span></label>
                <input className={cx.input} name="Nfases" type="number" min="1" max="3" value={form.Nfases} onChange={handleChange} />
              </div>
              <div className={cx.field}>
                <label className={cx.label}>Cable <span className="text-danger-a10 ml-0.5">*</span></label>
                <select className={cx.input} name="cable_fase_id" value={form.cable_fase_id} onChange={handleChange} disabled={!form.familia_id}>
                  <option value="">— Seleccioná —</option>
                  {cablesFase.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mx-3 mt-2 border-t border-surface-tonal-a20" />

            <div className="px-3 pt-2">
              <span className="text-[11px] font-medium text-font-a20 tracking-[0.04em]">NEUTRO</span>
            </div>
            <div className={`${cx.grid} pb-3`}>
              <div className={cx.field}>
                <label className={cx.label}>N° neutros</label>
                <input className={cx.input} name="Nneutro" type="number" min="0" max="2" value={form.Nneutro} onChange={handleChange} />
              </div>
              <div className={cx.field}>
                <label className={cx.label}>Cable</label>
                <select className={cx.input} name="cable_neutro_id" value={form.cable_neutro_id} onChange={handleChange} disabled={!form.familia_id || form.Nneutro === '0'}>
                  <option value="">— Sin neutro —</option>
                  {cablesNeutro.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={cx.section}>
            <div className={cx.sectionHdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#888780' }} />
              <span>Tierra</span>
            </div>
            <div className={cx.grid}>
              <div className={cx.field}>
                <label className={cx.label}>Familia</label>
                <select className={cx.input} name="familia_tierra_id" value={form.familia_tierra_id} onChange={handleChange}>
                  <option value="">— Sin tierra —</option>
                  {familias.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>
              <div className={cx.field}>
                <label className={cx.label}>Cable</label>
                <select className={cx.input} name="cable_tierra_id" value={form.cable_tierra_id} onChange={handleChange} disabled={!form.familia_tierra_id}>
                  <option value="">— Sin tierra —</option>
                  {cablesTierra.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        </div>

        <div className="px-4 py-3 border-t border-surface-tonal-a20 flex gap-2 justify-end bg-surface-tonal-a0 rounded-b-xl">
          <button className={cx.btn} onClick={onCerrar}>Cancelar</button>
          <button className={cx.btnPrimary} onClick={handleGuardar} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar formación'}
          </button>
        </div>

      </div>
    </div>
  )
}
