'use client'
import { useEffect, useState } from 'react'
import { useCables, type CableItem } from '@/context/CablesContext'
import type { Cable } from '@/context/types'

// El resultado se tipa con `Cable` (no `CableItem`) porque es lo que devuelve el
// back en LazoInstrumentacion.cable — un subconjunto de CableItem, que sigue
// siendo asignable acá ya que solo se usan campos en común.
export type CableSimpleResult = {
  cable_id: number | null
  cantidad_cables: number | null
  cable: Cable | null
}

type Props = {
  valorInicial?: CableSimpleResult
  onGuardar: (data: CableSimpleResult) => void | Promise<void>
  onCerrar: () => void
}

// Portapapeles global (no por instancia) — igual que en FormacionModal, así se
// puede copiar un cable en un lazo/puerto y pegarlo en otro, incluso entre
// /instrumentos y /rack ya que comparten este mismo componente.
let globalClipboard: CableSimpleResult | null = null

const cx = {
  input: 'h-[34px] border border-surface-tonal-a30 rounded-[7px] px-[10px] text-[13px] bg-surface-a10 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10 disabled:opacity-40 disabled:cursor-not-allowed',
  label: 'text-xs text-font-a20',
  field: 'flex flex-col gap-[5px]',
  btn: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 transition-colors hover:bg-surface-tonal-a10 hover:text-font-a0',
  btnPrimary: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 transition-colors hover:bg-info-a10 hover:border-info-a10 disabled:opacity-50 disabled:cursor-not-allowed',
}

export default function CableSimpleModal({ valorInicial, onGuardar, onCerrar }: Props) {
  const { familiasFiltradas: familias, getCablesDeFamilia } = useCables()

  const [familiaId, setFamiliaId] = useState<string>(valorInicial?.cable?.familia_id ? String(valorInicial.cable.familia_id) : '')
  const [cableId, setCableId] = useState<string>(valorInicial?.cable_id ? String(valorInicial.cable_id) : '')
  const [cantidad, setCantidad] = useState<string>(valorInicial?.cantidad_cables ? String(valorInicial.cantidad_cables) : '1')
  const [cables, setCables] = useState<CableItem[]>([])
  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [clipboardSnapshot, setClipboardSnapshot] = useState<CableSimpleResult | null>(globalClipboard)
  const [copiadoReciente, setCopiadoReciente] = useState(false)

  useEffect(() => {
    if (!familiaId) { setCables([]); return }
    setLoading(true)
    getCablesDeFamilia(Number(familiaId)).then(cs => { setCables(cs); setLoading(false) })
  }, [familiaId])

  const handleFamiliaChange = (v: string) => { setFamiliaId(v); setCableId('') }

  const puedeGuardar = !!cableId && !!cantidad.trim() && Number(cantidad) > 0

  const handleGuardar = async () => {
    if (!puedeGuardar) return
    const cable = cables.find(c => String(c.id) === cableId) ?? null
    setGuardando(true)
    try {
      await onGuardar({ cable_id: Number(cableId), cantidad_cables: Number(cantidad), cable })
    } finally {
      setGuardando(false)
    }
  }

  const handleQuitar = async () => {
    setGuardando(true)
    try {
      await onGuardar({ cable_id: null, cantidad_cables: null, cable: null })
    } finally {
      setGuardando(false)
    }
  }

  const handleCopiar = () => {
    if (!puedeGuardar) return
    const cable = cables.find(c => String(c.id) === cableId) ?? null
    const snapshot: CableSimpleResult = { cable_id: Number(cableId), cantidad_cables: Number(cantidad), cable }
    globalClipboard = snapshot
    setClipboardSnapshot(snapshot)
    setCopiadoReciente(true)
    setTimeout(() => setCopiadoReciente(false), 1500)
  }

  const handlePegar = async () => {
    if (!clipboardSnapshot?.cable_id) return
    const snap = clipboardSnapshot
    setFamiliaId(snap.cable?.familia_id ? String(snap.cable.familia_id) : '')
    setCableId(String(snap.cable_id))
    setCantidad(snap.cantidad_cables ? String(snap.cantidad_cables) : '1')
    setGuardando(true)
    try {
      await onGuardar(snap)
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-100" onClick={onCerrar}>
      <div className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl w-100 max-w-[95vw] flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.6)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-tonal-a20 bg-surface-tonal-a0 rounded-t-xl gap-2">
          <span className="text-[14px] font-medium text-font-a0">Cable</span>
          <button className={cx.btn} onClick={handleCopiar} disabled={!puedeGuardar || guardando}>
            {copiadoReciente ? '¡Copiado!' : 'Copiar'}
          </button>
          <button className={cx.btn} onClick={handlePegar} disabled={!clipboardSnapshot?.cable_id || guardando}>
            Pegar
          </button>
          <button className="bg-transparent border-none cursor-pointer text-font-a20 flex items-center p-1 rounded-md hover:bg-surface-tonal-a10 hover:text-font-a0" onClick={onCerrar}>
            <i className="material-icons">close</i>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className={cx.field}>
            <label className={cx.label}>Familia <span className="text-danger-a10 ml-0.5">*</span></label>
            <select className={cx.input} value={familiaId} onChange={e => handleFamiliaChange(e.target.value)}>
              <option value="">— Seleccioná —</option>
              {familias.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>

          <div className={cx.field}>
            <label className={cx.label}>Cantidad de cables <span className="text-danger-a10 ml-0.5">*</span></label>
            <input className={cx.input} type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} />
          </div>

          <div className={cx.field}>
            <label className={cx.label}>Cable <span className="text-danger-a10 ml-0.5">*</span></label>
            <select className={cx.input} value={cableId} onChange={e => setCableId(e.target.value)} disabled={!familiaId || loading}>
              <option value="">{loading ? 'Cargando...' : '— Seleccioná —'}</option>
              {cables.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {familiaId && !loading && cables.length === 0 && (
              <span className="text-[11px] text-danger-a10">Esta familia no tiene cables cargados.</span>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-surface-tonal-a20 flex gap-2 justify-end bg-surface-tonal-a0 rounded-b-xl">
          {valorInicial?.cable_id && (
            <button className={cx.btn} onClick={handleQuitar} disabled={guardando}>Quitar cable</button>
          )}
          <button className={cx.btn} onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button className={cx.btnPrimary} onClick={handleGuardar} disabled={!puedeGuardar || guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
