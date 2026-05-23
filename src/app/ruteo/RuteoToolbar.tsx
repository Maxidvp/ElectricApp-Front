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
  onChangeTool: (t: ToolType) => void
  onChangeDrawZ: (z: number) => void
  onChangeConjunto: (id: number) => void
  onOpenConfig: () => void
}

export function RuteoToolbar({
  tool, drawZ, conjuntos, activeConjuntoId, drawStart, activeCircId, activeCirc, selectedId,
  onChangeTool, onChangeDrawZ, onChangeConjunto, onOpenConfig,
}: Props) {
  return (
    <div className="ruteo-toolbar">
      {TOOLS.map(t => (
        <button key={t.id} className={`ruteo-tool${tool === t.id ? ' activo' : ''}`} onClick={() => onChangeTool(t.id)}>
          {t.dot && <span className="tool-dot" style={{ background: COLORS[t.id] }} />}
          {t.label}
        </button>
      ))}

      <div className="ruteo-separator" />

      <label className="ruteo-zlabel">Z (m)</label>
      <input type="number" step="0.01" value={(drawZ / 100).toFixed(2)}
        onChange={e => onChangeDrawZ(Math.round(Number(e.target.value) * 100))}
        className="ruteo-zinput" title="Altura de dibujo en metros" />

      <div className="ruteo-separator" />

      <select className="ruteo-conjunto-select" value={activeConjuntoId ?? ''}
        onChange={e => onChangeConjunto(Number(e.target.value))}>
        {conjuntos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      <button className="ruteo-tool" onClick={onOpenConfig}>⚙ Configurar</button>

      <div className="ruteo-separator" />

      {drawStart ? (
        <span className="ruteo-hint">Click para colocar el punto final · Esc para cancelar</span>
      ) : tool === 'asignar' ? (
        activeCircId
          ? <span className="ruteo-hint">Circuito activo: <strong>{activeCirc?.circuito}</strong> · Click en caños/bandejas · Esc para deseleccionar</span>
          : <span className="ruteo-hint">Seleccioná un circuito en el panel para activarlo</span>
      ) : selectedId && tool === 'seleccionar' ? (
        <span className="ruteo-hint">Arrastrá los extremos para estirar · Supr para eliminar</span>
      ) : null}
    </div>
  )
}
