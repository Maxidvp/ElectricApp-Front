'use client'
import { useProyectos } from '@/context/ProyectosContext'
import { COLORS } from './_constants'
import type { ToolType } from './_constants'
import { DeferredInput } from './DeferredInput'

interface Props {
  tool: ToolType
  selectedId: number | null
  activeCircId: number | null
  asignarTableroId: number | null
  setActiveCircId: (id: number | null) => void
  setAsignarTableroId: (id: number | null) => void
  handleDelete: () => void
}

export function RuteoPanel({
  tool, selectedId, activeCircId, asignarTableroId,
  setActiveCircId, setAsignarTableroId, handleDelete,
}: Props) {
  const {
    tableros, segmentos, canios, bandejas, conjuntos,
    previewSegmento, editSegmento, quitarCircuito,
    addSegmentoToConjunto, removeSegmentoFromConjunto,
  } = useProyectos()

  const selectedSeg      = segmentos.find(s => s.id === selectedId) ?? null
  const updateProp       = (field: string, value: unknown) => { if (selectedId) editSegmento(selectedId, { [field]: value } as never) }
  const handleQuitar     = (circId: number) => { if (selectedId) quitarCircuito(selectedId, circId) }
  const asignarTablero   = tableros.find(t => t.id === asignarTableroId)
  const asignarCircuitos = asignarTablero?.circuitos ?? []
  const activeCirc       = tableros.flatMap(t => t.circuitos).find(c => c.id === activeCircId) ?? null

  if (tool === 'asignar') return (
    <div className="ruteo-panel">
      <div className="panel-asignar">
        <div className="panel-asignar-hint">
          {activeCircId
            ? <>Circuito activo: <strong>{activeCirc?.circuito}</strong><br /><span>Click en un caño o bandeja para asignar o quitar</span></>
            : 'Seleccioná un circuito para activarlo'}
        </div>
        {tableros.length > 0 && (
          <div className="panel-asignar-tabs">
            {tableros.map(t => (
              <button key={t.id} className={`panel-asignar-tab${asignarTableroId === t.id ? ' active' : ''}`}
                onClick={() => setAsignarTableroId(t.id)}>{t.tag}</button>
            ))}
          </div>
        )}
        <div className="panel-asignar-circs">
          {asignarCircuitos.length === 0
            ? <span className="panel-asignar-empty">Sin circuitos</span>
            : asignarCircuitos.map(c => (
                <button key={c.id}
                  className={`panel-asignar-circ${activeCircId === c.id ? ' activo' : ''}`}
                  onClick={() => setActiveCircId(activeCircId === c.id ? null : c.id)}
                >{c.circuito}</button>
              ))}
        </div>
      </div>
    </div>
  )

  if (!selectedSeg) return (
    <div className="ruteo-panel">
      <div className="panel-empty">
        <span>Seleccioná un elemento para ver sus propiedades</span>
      </div>
    </div>
  )

  return (
    <div className="ruteo-panel">
      <div className="panel-header">
        <span className="panel-dot" style={{ background: COLORS[selectedSeg.tipo] }} />
        <span className="panel-title">{selectedSeg.tipo}</span>
        <button className="panel-delete" onClick={handleDelete}>Eliminar</button>
      </div>

      <div className="panel-section">
        <label>Punto inicio</label>
        <div className="panel-row">
          <div><label>X1 (m)</label>
            <DeferredInput type="number" step="0.01" value={selectedSeg.x1/100}
              onPreview={v => previewSegmento(selectedSeg.id, { x1: Math.round(v*100) })}
              onCommit={v => updateProp('x1', Math.round(v*100))} /></div>
          <div><label>Y1 (m)</label>
            <DeferredInput type="number" step="0.01" value={selectedSeg.y1/100}
              onPreview={v => previewSegmento(selectedSeg.id, { y1: Math.round(v*100) })}
              onCommit={v => updateProp('y1', Math.round(v*100))} /></div>
          <div><label>Z1 (m)</label>
            <DeferredInput type="number" step="0.01" value={selectedSeg.z1/100}
              onPreview={v => previewSegmento(selectedSeg.id, { z1: Math.round(v*100) })}
              onCommit={v => updateProp('z1', Math.round(v*100))} /></div>
        </div>
      </div>

      <div className="panel-section">
        <label>Punto fin</label>
        <div className="panel-row">
          <div><label>X2 (m)</label>
            <DeferredInput type="number" step="0.01" value={selectedSeg.x2/100}
              onPreview={v => previewSegmento(selectedSeg.id, { x2: Math.round(v*100) })}
              onCommit={v => updateProp('x2', Math.round(v*100))} /></div>
          <div><label>Y2 (m)</label>
            <DeferredInput type="number" step="0.01" value={selectedSeg.y2/100}
              onPreview={v => previewSegmento(selectedSeg.id, { y2: Math.round(v*100) })}
              onCommit={v => updateProp('y2', Math.round(v*100))} /></div>
          <div><label>Z2 (m)</label>
            <DeferredInput type="number" step="0.01" value={selectedSeg.z2/100}
              onPreview={v => previewSegmento(selectedSeg.id, { z2: Math.round(v*100) })}
              onCommit={v => updateProp('z2', Math.round(v*100))} /></div>
        </div>
      </div>

      {selectedSeg.tipo === 'canio' && (
        <div className="panel-section">
          <label>Tipo de caño</label>
          <select value={selectedSeg.canio_id ?? ''}
            onChange={e => updateProp('canio_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Sin especificar —</option>
            {canios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      )}

      {selectedSeg.tipo === 'bandeja' && (
        <div className="panel-section">
          <label>Tipo de bandeja</label>
          <select value={selectedSeg.bandeja_id ?? ''}
            onChange={e => updateProp('bandeja_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Sin especificar —</option>
            {bandejas.map(b => <option key={b.id} value={b.id}>{b.nombre ?? 'Bandeja'} — {b.ancho} mm</option>)}
          </select>
        </div>
      )}

      {(selectedSeg.tipo === 'canio' || selectedSeg.tipo === 'bandeja') && selectedSeg.circuitos.length > 0 && (
        <div className="panel-section">
          <label>Circuitos asignados</label>
          <div className="panel-chips">
            {selectedSeg.circuitos.map(c => (
              <div key={c.id} className="panel-chip">
                <div><span>{c.circuito}</span><span className="panel-chip-sub"> · {c.tablero.tag}</span></div>
                <button onClick={() => handleQuitar(c.id)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {conjuntos.length > 0 && (
        <div className="panel-section">
          <label>Canalizaciones</label>
          <div className="panel-seg-conjuntos">
            {conjuntos.map(c => {
              const inC = selectedSeg.conjuntos.some(sc => sc.id === c.id)
              return (
                <button key={c.id}
                  className={`panel-seg-conjunto-btn${inC ? ' in' : ''}`}
                  onClick={() => inC
                    ? removeSegmentoFromConjunto(selectedSeg.id, c.id)
                    : addSegmentoToConjunto(selectedSeg.id, c.id)}
                >{inC ? '✓ ' : ''}{c.nombre}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
