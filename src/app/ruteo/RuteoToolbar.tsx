'use client'
import { useState } from 'react'
import { TOOLS, COLORS } from './_constants'
import type { ToolType } from './_constants'
import { LayoutIcon } from './icons/LayoutIcon'
import { RuteoIcon } from './icons/RuteoIcon'

function ZInput({ valueCm, onChange, title, className }: {
  valueCm: number
  onChange: (cm: number) => void
  title?: string
  className?: string
}) {
  const [local, setLocal] = useState<string | null>(null)
  return (
    <input
      type="number"
      step="0.01"
      value={local ?? (valueCm / 100).toFixed(2)}
      title={title}
      className={className}
      onFocus={() => setLocal((valueCm / 100).toString())}
      onChange={e => {
        setLocal(e.target.value)
        const n = parseFloat(e.target.value)
        if (!isNaN(n)) onChange(Math.round(n * 100))
      }}
      onBlur={e => {
        const n = parseFloat(e.target.value)
        if (!isNaN(n)) onChange(Math.round(n * 100))
        setLocal(null)
      }}
    />
  )
}

interface Props {
  tool: ToolType
  drawZ: number
  conjuntos: { id: number; nombre: string }[]
  activeConjuntoId: number | null
  activeArquitecturaNombre: string | null
  drawStart: { x: number; y: number } | null
  activeCircId: number | null
  activeCirc: { circuito: string } | null
  selectedId: number | null
  tablasParedesCount: number
  verticalZMax: number
  verticalZMin: number
  continuarCanalizacion: boolean
  verticalTipo: 'canio' | 'bandeja'
  onChangeTool: (t: ToolType) => void
  onChangeDrawZ: (z: number) => void
  onChangeConjunto: (id: number) => void
  onOpenConjuntos: () => void
  onOpenParedes: () => void
  onChangeVerticalZMax: (z: number) => void
  onChangeVerticalZMin: (z: number) => void
  onToggleContinuar: (v: boolean) => void
  onChangeVerticalTipo: (t: 'canio' | 'bandeja') => void
}

export function RuteoToolbar({
  tool, drawZ, conjuntos, activeConjuntoId, activeArquitecturaNombre, drawStart,
  activeCircId, activeCirc, selectedId, tablasParedesCount,
  verticalZMax, verticalZMin, continuarCanalizacion, verticalTipo,
  onChangeTool, onChangeDrawZ, onChangeConjunto, onOpenConjuntos, onOpenParedes,
  onChangeVerticalZMax, onChangeVerticalZMin, onToggleContinuar, onChangeVerticalTipo,
}: Props) {
  const conjuntosAlert = conjuntos.length === 0
  const paredesAlert   = tablasParedesCount === 0

  const activeConjuntoNombre = conjuntos.find(c => c.id === activeConjuntoId)?.nombre ?? null

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
      <ZInput
        valueCm={drawZ} onChange={onChangeDrawZ}
        title="Altura de dibujo en metros"
        className="w-16 px-1.5 py-1 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-[5px] text-font-a0 text-xs outline-none focus:border-primary-a20"
      />

      <div className={separator} />

      {/* Canalizaciones: alerta = un solo botón con borde rojo; normal = icono + desplegable */}
      {conjuntosAlert ? (
        <button
          className="flex items-center gap-1.5 px-2 py-[5px] border border-[#ff5555] rounded-md bg-transparent text-[#ff5555] text-[13px] cursor-pointer"
          onClick={onOpenConjuntos}
        >
          <RuteoIcon className="w-4 h-4 shrink-0" />
          <span>Sin canalizaciones</span>
          <span>⚠</span>
        </button>
      ) : (
        <>
          <button
            className="flex items-center p-[5px] border border-transparent rounded-md bg-transparent text-font-a20 cursor-pointer hover:bg-surface-tonal-a10 hover:text-font-a0 transition-[background,color] duration-120"
            title="Gestionar canalizaciones"
            onClick={onOpenConjuntos}
          >
            <RuteoIcon className="w-4 h-4" />
          </button>
          <select
            value={activeConjuntoId ?? ''}
            onChange={e => onChangeConjunto(Number(e.target.value))}
            className="px-2 py-1 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 text-[13px] cursor-pointer max-w-40 outline-none focus:border-primary-a20"
          >
            {conjuntos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </>
      )}

      <div className={separator} />

      {/* Paredes: alerta = un solo botón con borde rojo; normal = icono + nombre */}
      {paredesAlert ? (
        <button
          className="flex items-center gap-1.5 px-2 py-[5px] border border-[#ff5555] rounded-md bg-transparent text-[#ff5555] text-[13px] cursor-pointer"
          onClick={onOpenParedes}
        >
          <LayoutIcon className="w-4 h-4 shrink-0" />
          <span>Sin arquitectura</span>
          <span>⚠</span>
        </button>
      ) : (
        <>
          <button
            className="flex items-center p-[5px] border border-transparent rounded-md bg-transparent text-font-a20 cursor-pointer hover:bg-surface-tonal-a10 hover:text-font-a0 transition-[background,color] duration-120"
            title="Gestionar paredes"
            onClick={onOpenParedes}
          >
            <LayoutIcon className="w-4 h-4" />
          </button>
          <span className="text-[13px] text-font-a20 max-w-32 truncate">{activeArquitecturaNombre}</span>
        </>
      )}

      <div className={separator} />

      {tool === 'vertical' ? (
        <>
          <label className="text-[11px] font-medium text-font-a20 tracking-[0.04em]">Z máx (m)</label>
          <ZInput
            valueCm={verticalZMax} onChange={onChangeVerticalZMax}
            title="Altura máxima del tramo vertical"
            className="w-16 px-1.5 py-1 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-[5px] text-font-a0 text-xs outline-none focus:border-primary-a20"
          />
          {!continuarCanalizacion && (
            <>
              <label className="text-[11px] font-medium text-font-a20 tracking-[0.04em]">Z mín (m)</label>
              <ZInput
                valueCm={verticalZMin} onChange={onChangeVerticalZMin}
                title="Altura mínima del tramo vertical"
                className="w-16 px-1.5 py-1 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-[5px] text-font-a0 text-xs outline-none focus:border-primary-a20"
              />
              <div className={separator} />
              {(['canio', 'bandeja'] as const).map(t => (
                <button key={t} onClick={() => onChangeVerticalTipo(t)}
                  className={toolBtn(verticalTipo === t)}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[t] }} />
                  {t === 'canio' ? 'Caño' : 'Bandeja'}
                </button>
              ))}
            </>
          )}
          <div className={separator} />
          <label className="flex items-center gap-1.5 text-xs text-font-a20 cursor-pointer select-none">
            <input
              type="checkbox" checked={continuarCanalizacion}
              onChange={e => onToggleContinuar(e.target.checked)}
              className="cursor-pointer accent-[var(--clr-primary-a0)]"
            />
            Continuar canalización
          </label>
          <div className={separator} />
          <span className="text-xs text-surface-tonal-a40">
            {continuarCanalizacion
              ? 'Click en un caño o bandeja horizontal para crear el tramo vertical desde su altura'
              : 'Click en el plano para insertar el tramo vertical'}
          </span>
        </>
      ) : drawStart ? (
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
