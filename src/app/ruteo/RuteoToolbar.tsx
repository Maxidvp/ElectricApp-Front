'use client'
import { TOOLS, COLORS } from './_constants'
import type { ToolType } from './_constants'

interface Props {
  tool: ToolType
  drawZ: number
  conjuntos: { id: number; nombre: string }[]
  activeConjuntoId: number | null
  drawStart: { x: number; y: number } | null
  activeCircId: number | null
  activeCirc: { circuito: string } | null
  selectedId: number | null
  tablasParedesCount: number
  onChangeTool: (t: ToolType) => void
  onChangeDrawZ: (z: number) => void
  onChangeConjunto: (id: number) => void
  onOpenConjuntos: () => void
  onOpenParedes: () => void
}

export function RuteoToolbar({
  tool, drawZ, conjuntos, activeConjuntoId, drawStart, activeCircId, activeCirc, selectedId,
  tablasParedesCount,
  onChangeTool, onChangeDrawZ, onChangeConjunto, onOpenConjuntos, onOpenParedes,
}: Props) {
  const conjuntosAlert = conjuntos.length === 0
  const paredesAlert   = tablasParedesCount === 0

  const toolBtn = (activo: boolean) =>
    `flex items-center gap-1.5 px-3 py-[5px] border rounded-md bg-transparent text-[13px] cursor-pointer transition-[background,color] duration-120 ${
      activo
        ? 'bg-surface-tonal-a20 text-font-a0 border-surface-tonal-a30'
        : 'border-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
    }`

  const separator = 'w-px h-5 bg-surface-tonal-a20 mx-1 shrink-0'

  return (
    <div className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-tonal-a0 border-b border-surface-tonal-a20 shrink-0 flex-wrap">
      {TOOLS.map(t => (
        <button key={t.id} className={toolBtn(tool === t.id)} onClick={() => onChangeTool(t.id)}>
          {t.dot && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[t.id] }} />}
          {t.label}
        </button>
      ))}

      <div className={separator} />

      <label className="text-[11px] font-medium text-font-a20 mr-1 tracking-[0.04em]">Z (m)</label>
      <input
        type="number" step="0.01" value={(drawZ / 100).toFixed(2)}
        onChange={e => onChangeDrawZ(Math.round(Number(e.target.value) * 100))}
        title="Altura de dibujo en metros"
        className="w-16 px-1.5 py-1 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-[5px] text-font-a0 text-xs outline-none focus:border-primary-a20"
      />

      <div className={separator} />

      <select
        value={activeConjuntoId ?? ''}
        onChange={e => onChangeConjunto(Number(e.target.value))}
        className="px-2 py-1 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 text-[13px] cursor-pointer max-w-40 outline-none focus:border-primary-a20"
      >
        {conjuntos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>

      <button
        className={toolBtn(false)}
        style={conjuntosAlert ? { color: '#ff5555', borderColor: '#ff5555' } : {}}
        onClick={onOpenConjuntos}
      >
        {conjuntosAlert ? '⚠ ' : ''}Canalizaciones
      </button>

      <button
        className={toolBtn(false)}
        style={paredesAlert ? { color: '#ff5555', borderColor: '#ff5555' } : {}}
        onClick={onOpenParedes}
      >
        {paredesAlert ? '⚠ ' : ''}Paredes
      </button>

      <div className={separator} />

      {drawStart ? (
        <span className="ml-3 text-xs text-surface-tonal-a40">Click para colocar el punto final · Esc para cancelar</span>
      ) : tool === 'asignar' ? (
        activeCircId
          ? <span className="ml-3 text-xs text-surface-tonal-a40">Circuito activo: <strong>{activeCirc?.circuito}</strong> · Click en caños/bandejas · Esc para deseleccionar</span>
          : <span className="ml-3 text-xs text-surface-tonal-a40">Seleccioná un circuito en el panel para activarlo</span>
      ) : selectedId && tool === 'seleccionar' ? (
        <span className="ml-3 text-xs text-surface-tonal-a40">Arrastrá los extremos para estirar · Supr para eliminar</span>
      ) : null}
    </div>
  )
}
