'use client'
import { useEffect, useState } from 'react'
import { useProtecciones } from '@/context/ProteccionesContext'
import { TIPOS_PROTECCION, varianteLabel } from '@/utils/protecciones'
import type { Proteccion } from '@/context/types'

type Props = {
  proteccionInicial?: Proteccion | null
  onGuardar: (proteccion: Proteccion | null) => void | Promise<void>
  onCerrar: () => void
}

const cx = {
  input: 'h-[34px] border border-surface-tonal-a30 rounded-[7px] px-[10px] text-[13px] bg-surface-a10 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10 disabled:opacity-40 disabled:cursor-not-allowed',
  label: 'text-xs text-font-a20',
  field: 'flex flex-col gap-[5px]',
  btn: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 transition-colors hover:bg-surface-tonal-a10 hover:text-font-a0 disabled:opacity-50 disabled:cursor-not-allowed',
  btnPrimary: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 transition-colors hover:bg-info-a10 hover:border-info-a10 disabled:opacity-50 disabled:cursor-not-allowed',
}

// Valor numérico por el que se ordena la variante — In para la mayoría de los tipos,
// rango_regulacion_min para guardamotor (que no usa In). Sin valor cargado va al final.
function valorOrden(p: Proteccion, tipo: string): number {
  const v = tipo === 'guardamotor' ? p.rango_regulacion_min : p.In
  return v ?? Infinity
}

let globalClipboard: { tipo: string; familia_id: string; proteccion_id: string } | null = null
let globalLastFamilia: { tipo: string; familia_id: string } | null = null

export default function ProteccionModal({ proteccionInicial, onGuardar, onCerrar }: Props) {
  const { familias, loading: loadingFamilias, getProteccionesDeFamilia } = useProtecciones()

  const [tipoFiltro, setTipoFiltro] = useState<string>(() =>
    proteccionInicial?.familia.tipo ?? globalLastFamilia?.tipo ?? 'termomagnetico')
  const [familiaId, setFamiliaId] = useState<string>(() => proteccionInicial
    ? String(proteccionInicial.familia_id)
    : (globalLastFamilia?.familia_id ?? ''))
  const [proteccionId, setProteccionId] = useState<string>(proteccionInicial ? String(proteccionInicial.id) : '')
  const [variantes, setVariantes] = useState<Proteccion[]>([])
  const [loadingVariantes, setLoadingVariantes] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [clipboardSnapshot, setClipboardSnapshot] = useState(globalClipboard)
  const [copiadoReciente, setCopiadoReciente] = useState(false)

  const familiasFiltradas = familias.filter(f => f.tipo === tipoFiltro)
  const variantesOrdenadas = [...variantes].sort((a, b) => valorOrden(a, tipoFiltro) - valorOrden(b, tipoFiltro))

  useEffect(() => {
    if (!familiaId) { setVariantes([]); return }
    setLoadingVariantes(true)
    getProteccionesDeFamilia(Number(familiaId)).then(vs => {
      setVariantes(vs)
      setLoadingVariantes(false)
    })
  }, [familiaId])

  const handleTipoChange = (tipo: string) => {
    setTipoFiltro(tipo)
    setFamiliaId('')
    setProteccionId('')
  }

  const handleFamiliaChange = (id: string) => {
    setFamiliaId(id)
    setProteccionId('')
  }

  const handleCopiar = () => {
    globalClipboard = { tipo: tipoFiltro, familia_id: familiaId, proteccion_id: proteccionId }
    setClipboardSnapshot(globalClipboard)
    setCopiadoReciente(true)
    setTimeout(() => setCopiadoReciente(false), 1500)
  }

  const handlePegar = async () => {
    if (!clipboardSnapshot?.familia_id || !clipboardSnapshot?.proteccion_id) return
    const { tipo, familia_id, proteccion_id } = clipboardSnapshot
    const vs = await getProteccionesDeFamilia(Number(familia_id))
    const seleccionada = vs.find(v => String(v.id) === proteccion_id)
    if (!seleccionada) return
    setTipoFiltro(tipo)
    setFamiliaId(familia_id)
    setVariantes(vs)
    setProteccionId(proteccion_id)
    globalLastFamilia = { tipo, familia_id }
    setGuardando(true)
    try {
      await onGuardar(seleccionada)
    } finally {
      setGuardando(false)
    }
    onCerrar()
  }

  const handleGuardar = async () => {
    if (!proteccionId) return
    const seleccionada = variantes.find(v => String(v.id) === proteccionId) ?? null
    if (!seleccionada) return
    globalLastFamilia = { tipo: tipoFiltro, familia_id: familiaId }
    setGuardando(true)
    try {
      await onGuardar(seleccionada)
    } finally {
      setGuardando(false)
    }
  }

  const handleQuitar = async () => {
    setGuardando(true)
    try {
      await onGuardar(null)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-100" onClick={onCerrar}>
      <div className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl w-100 max-w-[95vw] flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.6)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-tonal-a20 bg-surface-tonal-a0 rounded-t-xl gap-2">
          <span className="text-[14px] font-medium text-font-a0">Protección</span>
          <button className={cx.btn} onClick={handleCopiar} disabled={!proteccionId}>
            {copiadoReciente ? '¡Copiado!' : 'Copiar'}
          </button>
          <button className={cx.btn} onClick={handlePegar} disabled={!clipboardSnapshot?.proteccion_id || guardando}>
            Pegar
          </button>
          <button className="bg-transparent border-none cursor-pointer text-font-a20 flex items-center p-1 rounded-md hover:bg-surface-tonal-a10 hover:text-font-a0" onClick={onCerrar}>
            <i className="material-icons">close</i>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className={cx.field}>
            <label className={cx.label}>Tipo <span className="text-danger-a10 ml-0.5">*</span></label>
            <select className={cx.input} value={tipoFiltro} onChange={e => handleTipoChange(e.target.value)}>
              {TIPOS_PROTECCION.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className={cx.field}>
            <label className={cx.label}>Familia (marca / modelo) <span className="text-danger-a10 ml-0.5">*</span></label>
            <select className={cx.input} value={familiaId} onChange={e => handleFamiliaChange(e.target.value)} disabled={loadingFamilias}>
              <option value="">{loadingFamilias ? 'Cargando...' : '— Seleccioná —'}</option>
              {familiasFiltradas.map(f => (
                <option key={f.id} value={f.id}>{[f.marca, f.modelo].filter(Boolean).join(' ') || `Familia #${f.id}`}</option>
              ))}
            </select>
            {!loadingFamilias && familiasFiltradas.length === 0 && (
              <span className="text-[11px] text-danger-a10">
                No hay familias de este tipo cargadas — agregalas en la página Protecciones.
              </span>
            )}
          </div>

          <div className={cx.field}>
            <label className={cx.label}>Variante <span className="text-danger-a10 ml-0.5">*</span></label>
            <select className={cx.input} value={proteccionId} onChange={e => setProteccionId(e.target.value)} disabled={!familiaId || loadingVariantes}>
              <option value="">{loadingVariantes ? 'Cargando...' : '— Seleccioná —'}</option>
              {variantesOrdenadas.map(v => <option key={v.id} value={v.id}>{varianteLabel(v, tipoFiltro)}</option>)}
            </select>
            {familiaId && !loadingVariantes && variantes.length === 0 && (
              <span className="text-[11px] text-danger-a10">Esta familia no tiene variantes cargadas.</span>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-surface-tonal-a20 flex gap-2 justify-end bg-surface-tonal-a0 rounded-b-xl">
          {proteccionInicial != null && (
            <button className={cx.btn} onClick={handleQuitar} disabled={guardando}>Quitar protección</button>
          )}
          <button className={cx.btn} onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button className={cx.btnPrimary} onClick={handleGuardar} disabled={!proteccionId || guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
