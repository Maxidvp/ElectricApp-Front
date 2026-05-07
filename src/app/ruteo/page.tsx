'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Stage, Layer, Line, Circle, Shape } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useTableros } from '@/context/TablerosContext'
import { useRuteo } from '@/context/RuteoContext'
import type { Segmento } from '@/services/ruteo'
import '../../styles/ruteo.css'

// ── Grid helpers ───────────────────────────────────────
const GRID = 10

function niceSpacing(worldPx: number): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
  return steps.find(s => s >= worldPx) ?? 10000
}

function formatM(cm: number): string {
  if (cm === 0) return '0'
  const m = cm / 100
  return m.toFixed(2).replace(/\.?0+$/, '') + 'm'
}
const SNAP_EP_DIST = GRID * 1.5

const COLORS: Record<string, string> = {
  pared:   '#888780',
  bandeja: '#378ADD',
  canio:   '#E87C3A',
  punto:   '#47D5A6',
}

const STROKE: Record<string, number> = {
  pared:   2,
  bandeja: 6,
  canio:   3,
  punto:   0,
}


type ToolType = 'seleccionar' | 'asignar' | 'pared' | 'canio' | 'bandeja' | 'punto'

const TOOLS: { id: ToolType; label: string; dot?: boolean }[] = [
  { id: 'seleccionar', label: 'Seleccionar' },
  { id: 'asignar',     label: 'Asignar'     },
  { id: 'pared',       label: 'Pared',   dot: true },
  { id: 'bandeja',     label: 'Bandeja', dot: true },
  { id: 'canio',       label: 'Caño',    dot: true },
  { id: 'punto',       label: 'Punto',   dot: true },
]

function snap(v: number) { return Math.round(v / GRID) * GRID }

function DeferredInput({
  value, onPreview, onCommit, ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number
  onPreview?: (v: number) => void
  onCommit: (v: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      {...rest}
      value={draft ?? String(value)}
      onFocus={() => setDraft(String(value))}
      onChange={e => { setDraft(e.target.value); onPreview?.(Number(e.target.value)) }}
      onBlur={() => { if (draft !== null) { onCommit(Number(draft)); setDraft(null) } }}
    />
  )
}

// ── Main component ─────────────────────────────────────
export default function RuteoPage() {
  const [isClient, setIsClient] = useState(false)
  const containerRef     = useRef<HTMLDivElement>(null)
  const stageRef         = useRef<Konva.Stage>(null)
  const stageInitialized = useRef(false)
  const [size, setSize]  = useState({ w: 800, h: 600 })

  const [tool,       setTool]       = useState<ToolType>('seleccionar')
  const [drawStart,  setDrawStart]  = useState<{ x: number; y: number } | null>(null)
  const [mousePos,   setMousePos]   = useState({ x: 0, y: 0 })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [drawZ,      setDrawZ]      = useState(0)

  const [activeCircId,     setActiveCircId]     = useState<number | null>(null)
  const [asignarTableroId, setAsignarTableroId] = useState<number | null>(null)
  const [showConfigModal,  setShowConfigModal]  = useState(false)

  const { tableros } = useTableros()
  const {
    segmentos, canios, bandejas, conjuntos, activeConjuntoId,
    setActiveConjuntoId,
    addSegmento, previewSegmento, editSegmento, removeSegmento,
    asignarCircuito, quitarCircuito,
    addSegmentoToConjunto, removeSegmentoFromConjunto,
  } = useRuteo()

  const getSegColor = useCallback((seg: Segmento): string => {
    if (seg.color) return seg.color
    if (seg.tipo === 'canio')   return seg.canio?.color   ?? '#ffffff'
    if (seg.tipo === 'bandeja') return seg.bandeja?.color ?? '#ffffff'
    return COLORS[seg.tipo] ?? '#aaa'
  }, [])

  // ── Mount + resize ──────────────────────────────────
  useEffect(() => { setIsClient(true) }, [])

  useEffect(() => {
    if (!isClient || !containerRef.current) return
    const el = containerRef.current
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [isClient])

  useEffect(() => {
    if (stageInitialized.current || !stageRef.current || size.h === 0) return
    stageInitialized.current = true
    stageRef.current.scale({ x: 1, y: -1 })
    stageRef.current.y(size.h * 0.75)
  }, [size.h])

  useEffect(() => {
    if (tableros.length > 0 && asignarTableroId === null) setAsignarTableroId(tableros[0].id)
  }, [tableros, asignarTableroId])

  // ── Keyboard ────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!selectedId) return
    removeSegmento(selectedId)
    setSelectedId(null)
  }, [selectedId, removeSegmento])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDrawStart(null); setSelectedId(null); setActiveCircId(null) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId &&
          document.activeElement?.tagName !== 'INPUT') handleDelete()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, handleDelete])

  // ── Endpoint snap ───────────────────────────────────
  const findNearestEndpoint = useCallback((x: number, y: number, excludeId: number) => {
    let nearest: { x: number; y: number } | null = null
    let minDist = SNAP_EP_DIST
    for (const seg of segmentos) {
      if (seg.id === excludeId) continue
      for (const [px, py] of [[seg.x1, seg.y1], [seg.x2, seg.y2]] as [number, number][]) {
        const d = Math.hypot(x - px, y - py)
        if (d < minDist) { minDist = d; nearest = { x: px, y: py } }
      }
    }
    return nearest
  }, [segmentos])

  const snapPoint = useCallback((x: number, y: number, excludeId = -1) =>
    findNearestEndpoint(x, y, excludeId) ?? { x: snap(x), y: snap(y) }
  , [findNearestEndpoint])

  // ── Canvas ──────────────────────────────────────────
  const getRawPos = (e: KonvaEventObject<MouseEvent>) =>
    e.target.getStage()!.getRelativePointerPosition()!

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current!
    const oldScale = stage.scaleX()
    const pointer  = stage.getPointerPosition()!
    const newScale = Math.min(Math.max(oldScale * (e.evt.deltaY < 0 ? 1.1 : 0.9), 0.1), 20)
    stage.scale({ x: newScale, y: -newScale })
    stage.position({
      x: pointer.x - (pointer.x - stage.x()) * newScale / oldScale,
      y: pointer.y - (pointer.y - stage.y()) * newScale / oldScale,
    })
  }

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const raw = getRawPos(e)
    setMousePos({ x: snap(raw.x), y: snap(raw.y) })
  }

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    if (tool === 'seleccionar') {
      if (e.target === e.target.getStage()) setSelectedId(null)
      return
    }
    if (tool === 'asignar') return
    const raw = getRawPos(e)
    if (tool === 'punto') {
      const pos = { x: snap(raw.x), y: snap(raw.y) }
      addSegmento({ tipo: 'punto', x1: pos.x, y1: pos.y, z1: drawZ, x2: pos.x, y2: pos.y, z2: drawZ,
        canio_id: null, bandeja_id: null, conjunto_ids: activeConjuntoId ? [activeConjuntoId] : [] })
      return
    }
    const pos = snapPoint(snap(raw.x), snap(raw.y))
    if (!drawStart) {
      setDrawStart(pos)
    } else {
      addSegmento({ tipo: tool, x1: drawStart.x, y1: drawStart.y, z1: drawZ, x2: pos.x, y2: pos.y, z2: drawZ,
        canio_id: null, bandeja_id: null, conjunto_ids: activeConjuntoId ? [activeConjuntoId] : [] })
      setDrawStart(null)
    }
  }

  const handleSegmentClick = (id: number, e: KonvaEventObject<MouseEvent>) => {
    if (tool === 'seleccionar') { e.cancelBubble = true; setSelectedId(id); return }
    if (tool === 'asignar') {
      if (!activeCircId) return
      e.cancelBubble = true
      const seg = segmentos.find(s => s.id === id)
      if (!seg || (seg.tipo !== 'canio' && seg.tipo !== 'bandeja')) return
      if (seg.circuitos.some(c => c.id === activeCircId)) {
        quitarCircuito(id, activeCircId)
      } else {
        const t = tableros.find(t => t.circuitos.find(c => c.id === activeCircId))
        const c = t?.circuitos.find(c => c.id === activeCircId)
        if (!c || !t) return
        asignarCircuito(id, activeCircId, { id: c.id, circuito: c.circuito, tablero: { tag: t.tag } })
      }
    }
  }

  const changeTool = (t: ToolType) => { setTool(t); setDrawStart(null); setSelectedId(null); setActiveCircId(null) }

  // ── Visibility ──────────────────────────────────────
  const isSegVisible = useCallback((seg: Segmento) => {
    if (activeConjuntoId === null) return true
    return seg.conjuntos.some(c => c.id === activeConjuntoId)
  }, [activeConjuntoId])

  // ── Panel ───────────────────────────────────────────
  const selectedSeg      = segmentos.find(s => s.id === selectedId) ?? null
  const updateProp       = (field: string, value: unknown) => { if (selectedId) editSegmento(selectedId, { [field]: value } as any) }
  const handleQuitar     = (circId: number) => { if (selectedId) quitarCircuito(selectedId, circId) }
  const asignarTablero   = tableros.find(t => t.id === asignarTableroId)
  const asignarCircuitos = asignarTablero?.circuitos ?? []
  const activeCirc       = tableros.flatMap(t => t.circuitos).find(c => c.id === activeCircId) ?? null

  // ── Grid ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawGrid = useCallback((ctx: any, shape: any) => {
    const stage = shape.getStage(); if (!stage) return
    const scale = stage.scaleX()
    const { x: ox, y: oy } = stage.position()
    const x0 = (0 - ox) / scale;               const x1 = (stage.width()  - ox) / scale
    const yA = (0 - oy) / (-scale);             const yB = (stage.height() - oy) / (-scale)
    const y0 = Math.min(yA, yB);                const y1 = Math.max(yA, yB)
    const minor = niceSpacing(50 / scale);       const major = minor * 5
    const thin = 0.5 / scale;                   const thick = 1 / scale

    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = thin; ctx.beginPath()
    for (let x = Math.floor(x0/minor)*minor; x <= x1+minor; x += minor) { ctx.moveTo(x,y0); ctx.lineTo(x,y1) }
    for (let y = Math.floor(y0/minor)*minor; y <= y1+minor; y += minor) { ctx.moveTo(x0,y); ctx.lineTo(x1,y) }
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = thick; ctx.beginPath()
    for (let x = Math.floor(x0/major)*major; x <= x1+major; x += major) { ctx.moveTo(x,y0); ctx.lineTo(x,y1) }
    for (let y = Math.floor(y0/major)*major; y <= y1+major; y += major) { ctx.moveTo(x0,y); ctx.lineTo(x1,y) }
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = thick; ctx.beginPath()
    ctx.moveTo(0,y0); ctx.lineTo(0,y1); ctx.moveTo(x0,0); ctx.lineTo(x1,0); ctx.stroke()

    const fs = 11/scale; const pad = 4/scale
    ctx.font = `${fs}px monospace`; ctx.fillStyle = 'rgba(255,255,255,0.28)'
    for (let x = Math.floor(x0/major)*major; x <= x1+major; x += major) {
      if (Math.abs(x) < minor*0.5) continue
      ctx.save(); ctx.translate(x+pad, y1-pad); ctx.scale(1,-1); ctx.textBaseline='top'; ctx.fillText(formatM(x),0,0); ctx.restore()
    }
    for (let y = Math.floor(y0/major)*major; y <= y1+major; y += major) {
      if (Math.abs(y) < minor*0.5) continue
      ctx.save(); ctx.translate(x0+pad, y+pad); ctx.scale(1,-1); ctx.textBaseline='bottom'; ctx.fillText(formatM(y),0,0); ctx.restore()
    }
  }, [])

  if (!isClient) return <div className="ruteo-loading">Cargando…</div>

  const previewColor  = COLORS[tool] ?? '#aaa'
  const previewStroke = STROKE[tool] ?? 2
  const isPanMode     = tool === 'seleccionar' || tool === 'asignar'
  const dimming       = tool === 'asignar' && activeCircId !== null
  const snappedMouse  = drawStart ? snapPoint(mousePos.x, mousePos.y) : mousePos
  const isSnapActive  = drawStart && (snappedMouse.x !== mousePos.x || snappedMouse.y !== mousePos.y)

  return (
    <div className="ruteo-layout">

      {/* ── Toolbar ── */}
      <div className="ruteo-toolbar">
        {TOOLS.map(t => (
          <button key={t.id} className={`ruteo-tool${tool === t.id ? ' activo' : ''}`} onClick={() => changeTool(t.id)}>
            {t.dot && <span className="tool-dot" style={{ background: COLORS[t.id] }} />}
            {t.label}
          </button>
        ))}

        <div className="ruteo-separator" />

        <label className="ruteo-zlabel">Z (m)</label>
        <input type="number" step="0.01" value={(drawZ/100).toFixed(2)}
          onChange={e => setDrawZ(Math.round(Number(e.target.value)*100))}
          className="ruteo-zinput" title="Altura de dibujo en metros" />

        <div className="ruteo-separator" />

        <select
          className="ruteo-conjunto-select"
          value={activeConjuntoId ?? ''}
          onChange={e => setActiveConjuntoId(Number(e.target.value))}
        >
          {conjuntos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button className="ruteo-tool" onClick={() => setShowConfigModal(true)}>
          ⚙ Configurar
        </button>

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

      {/* ── Canvas + Panel ── */}
      <div className="ruteo-content">

        <div ref={containerRef} className={`ruteo-canvas-wrapper${isPanMode ? ' tool-seleccionar' : ''}`}>
          <div className="ruteo-coords">
            X {(mousePos.x/100).toFixed(2)}m · Y {(mousePos.y/100).toFixed(2)}m · Z {(drawZ/100).toFixed(2)}m
          </div>
          <Stage ref={stageRef} width={size.w} height={size.h}
            draggable={isPanMode} onWheel={handleWheel} onClick={handleStageClick} onMouseMove={handleMouseMove}>
            <Layer listening={false}>
              <Shape sceneFunc={(ctx, shape) => drawGrid(ctx, shape)} />
            </Layer>
            <Layer>
              {segmentos.map(seg => {
                const visible    = isSegVisible(seg)
                const isSelected = seg.id === selectedId
                const color      = isSelected ? '#ffffff' : getSegColor(seg)
                const sw         = (STROKE[seg.tipo] ?? 2) + (isSelected ? 2 : 0)
                const hasActiveCirc = dimming && seg.circuitos.some(c => c.id === activeCircId)
                const canAssign     = seg.tipo === 'canio' || seg.tipo === 'bandeja'
                const opacity = !visible ? 0
                  : dimming ? (canAssign ? (hasActiveCirc ? 1 : 0.2) : 0.08)
                  : 1

                if (seg.tipo === 'punto') return (
                  <Circle key={seg.id} x={seg.x1} y={seg.y1}
                    radius={isSelected ? 8 : 6} fill={color} opacity={opacity} listening={visible}
                    draggable={isSelected && tool === 'seleccionar'}
                    onDragEnd={e => {
                      const pos = snapPoint(e.target.x(), e.target.y(), seg.id)
                      e.target.position(pos); editSegmento(seg.id, { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y })
                    }}
                    onClick={e => handleSegmentClick(seg.id, e)} />
                )
                return (
                  <Line key={seg.id} points={[seg.x1, seg.y1, seg.x2, seg.y2]}
                    stroke={color} strokeWidth={sw} lineCap="round" hitStrokeWidth={12}
                    opacity={opacity} listening={visible}
                    draggable={isSelected && tool === 'seleccionar'}
                    onDragEnd={e => {
                      const dx = e.target.x(); const dy = e.target.y()
                      e.target.position({ x: 0, y: 0 })
                      editSegmento(seg.id, { x1: snap(seg.x1+dx), y1: snap(seg.y1+dy), x2: snap(seg.x2+dx), y2: snap(seg.y2+dy) })
                    }}
                    onClick={e => handleSegmentClick(seg.id, e)} />
                )
              })}

              {selectedSeg && selectedSeg.tipo !== 'punto' && tool === 'seleccionar' && (<>
                <Circle x={selectedSeg.x1} y={selectedSeg.y1} radius={7} fill="#fff"
                  stroke={COLORS[selectedSeg.tipo]??'#aaa'} strokeWidth={2} draggable
                  onClick={e => { e.cancelBubble = true }}
                  onDragEnd={e => { e.cancelBubble = true
                    const pos = snapPoint(e.target.x(), e.target.y(), selectedSeg.id)
                    e.target.position(pos); editSegmento(selectedSeg.id, { x1: pos.x, y1: pos.y }) }} />
                <Circle x={selectedSeg.x2} y={selectedSeg.y2} radius={7} fill="#fff"
                  stroke={COLORS[selectedSeg.tipo]??'#aaa'} strokeWidth={2} draggable
                  onClick={e => { e.cancelBubble = true }}
                  onDragEnd={e => { e.cancelBubble = true
                    const pos = snapPoint(e.target.x(), e.target.y(), selectedSeg.id)
                    e.target.position(pos); editSegmento(selectedSeg.id, { x2: pos.x, y2: pos.y }) }} />
              </>)}

              {drawStart && (<>
                <Line points={[drawStart.x, drawStart.y, snappedMouse.x, snappedMouse.y]}
                  stroke={previewColor} strokeWidth={previewStroke} dash={[6,5]} lineCap="round" listening={false} opacity={0.6} />
                <Circle x={drawStart.x} y={drawStart.y} radius={4} fill={previewColor} listening={false} />
                {isSnapActive && <Circle x={snappedMouse.x} y={snappedMouse.y} radius={7} stroke="#47D5A6" strokeWidth={2} listening={false} />}
              </>)}
            </Layer>
          </Stage>
        </div>

        {/* ── Panel derecho ── */}
        <div className="ruteo-panel">
          {tool === 'asignar' ? (
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

          ) : selectedSeg ? (<>
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
                <label>Conjuntos</label>
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
          </>) : (
            <div className="panel-empty">
              <span>Seleccioná un elemento para ver sus propiedades</span>
            </div>
          )}
        </div>
      </div>

      {showConfigModal && <ConjuntosModal onClose={() => setShowConfigModal(false)} />}
    </div>
  )
}

// ── Modal de configuración de conjuntos ────────────────
function ConjuntosModal({ onClose }: { onClose: () => void }) {
  const { conjuntos, segmentos, addConjunto, renameConjunto, deleteConjunto, addSegmentoToConjunto } = useRuteo()

  const [newName,     setNewName]     = useState('')
  const [editingId,   setEditingId]   = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [copyFrom,    setCopyFrom]    = useState<number | ''>(conjuntos[0]?.id ?? '')
  const [copyTo,      setCopyTo]      = useState<number | ''>(conjuntos[1]?.id ?? '')
  const [copied,      setCopied]      = useState(false)

  const paredsDe = (conjId: number | '') =>
    conjId !== '' ? segmentos.filter(s => s.tipo === 'pared' && s.conjuntos.some(c => c.id === conjId)) : []

  const paredsPendientes = copyFrom !== '' && copyTo !== '' && copyFrom !== copyTo
    ? paredsDe(copyFrom).filter(s => !s.conjuntos.some(c => c.id === copyTo)).length
    : 0

  const handleCreate = () => {
    const name = newName.trim(); if (!name) return
    addConjunto(name); setNewName('')
  }

  const handleRenameCommit = (id: number) => {
    const name = editingName.trim(); if (name) renameConjunto(id, name)
    setEditingId(null)
  }

  const handleCopy = () => {
    if (copyFrom === '' || copyTo === '' || copyFrom === copyTo) return
    paredsDe(copyFrom).forEach(s => {
      if (!s.conjuntos.some(c => c.id === copyTo)) addSegmentoToConjunto(s.id, Number(copyTo))
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="ruteo-modal-overlay" onClick={onClose}>
      <div className="ruteo-modal" onClick={e => e.stopPropagation()}>

        <div className="ruteo-modal-title">Configurar conjuntos</div>

        {/* Lista de conjuntos */}
        <div className="ruteo-modal-section-label">Conjuntos</div>
        <div className="rcm-list">
          {conjuntos.map(c => (
            <div key={c.id} className="rcm-item">
              {editingId === c.id ? (
                <input
                  className="rcm-rename-input"
                  value={editingName}
                  autoFocus
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={() => handleRenameCommit(c.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameCommit(c.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <span className="rcm-name">{c.nombre}</span>
              )}
              <div className="rcm-actions">
                {editingId !== c.id && (
                  <button className="rcm-btn" onClick={() => { setEditingId(c.id); setEditingName(c.nombre) }}>
                    Renombrar
                  </button>
                )}
                {conjuntos.length > 1 && (
                  <button className="rcm-btn danger" onClick={() => deleteConjunto(c.id)}>
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Crear nuevo */}
        <div className="rcm-create">
          <input
            className="rcm-create-input"
            placeholder="Nombre del nuevo conjunto…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          />
          <button className="rcm-create-btn" onClick={handleCreate} disabled={!newName.trim()}>
            Crear
          </button>
        </div>

        {/* Copiar paredes */}
        {conjuntos.length >= 2 && (
          <>
            <div className="ruteo-modal-section-label" style={{ marginTop: 20 }}>Copiar paredes</div>
            <div className="rcm-copy-row">
              <select className="rcm-copy-select" value={copyFrom}
                onChange={e => { setCopyFrom(Number(e.target.value)); setCopied(false) }}>
                {conjuntos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <span className="rcm-copy-arrow">→</span>
              <select className="rcm-copy-select" value={copyTo}
                onChange={e => { setCopyTo(Number(e.target.value)); setCopied(false) }}>
                {conjuntos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button
                className="rcm-copy-btn"
                onClick={handleCopy}
                disabled={!paredsPendientes || copied}
              >
                {copied ? '✓ Copiado' : `Copiar${paredsPendientes ? ` (${paredsPendientes})` : ''}`}
              </button>
            </div>
            {copyFrom === copyTo && copyFrom !== '' && (
              <p className="rcm-copy-warn">Origen y destino deben ser distintos</p>
            )}
          </>
        )}

        <div className="ruteo-modal-footer">
          <button className="rcm-close-btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
