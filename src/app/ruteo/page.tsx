'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Stage, Layer, Line, Circle, Shape } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useTableros } from '@/context/TablerosContext'
import { useRuteo } from '@/context/RuteoContext'
import '../../styles/ruteo.css'

// ── Grid helpers ───────────────────────────────────────
const GRID = 10  // 10 cm snap

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

function snap(v: number) {
  return Math.round(v / GRID) * GRID
}

// ── Deferred number input ──────────────────────────────
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
      onBlur={() => {
        if (draft !== null) { onCommit(Number(draft)); setDraft(null) }
      }}
    />
  )
}

// ── Component ──────────────────────────────────────────
export default function RuteoPage() {
  const [isClient, setIsClient] = useState(false)
  const containerRef    = useRef<HTMLDivElement>(null)
  const stageRef        = useRef<Konva.Stage>(null)
  const stageInitialized = useRef(false)
  const [size, setSize] = useState({ w: 800, h: 600 })

  const [tool,       setTool]       = useState<ToolType>('seleccionar')
  const [drawStart,  setDrawStart]  = useState<{ x: number; y: number } | null>(null)
  const [mousePos,   setMousePos]   = useState({ x: 0, y: 0 })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [drawZ,      setDrawZ]      = useState(0)

  // ── Asignar mode state ─────────────────────────────
  const [activeCircId,     setActiveCircId]     = useState<number | null>(null)
  const [asignarTableroId, setAsignarTableroId] = useState<number | null>(null)

  const { tableros } = useTableros()
  const {
    segmentos, canios, bandejas,
    addSegmento, previewSegmento, editSegmento, removeSegmento,
    asignarCircuito, quitarCircuito,
  } = useRuteo()

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

  // Set Stage Y-flip once after first valid size
  useEffect(() => {
    if (stageInitialized.current || !stageRef.current || size.h === 0) return
    stageInitialized.current = true
    stageRef.current.scale({ x: 1, y: -1 })
    stageRef.current.y(size.h * 0.75)
  }, [size.h])

  // Initialize tablero tab for asignar panel
  useEffect(() => {
    if (tableros.length > 0 && asignarTableroId === null) {
      setAsignarTableroId(tableros[0].id)
    }
  }, [tableros, asignarTableroId])

  // ── Keyboard shortcuts ──────────────────────────────
  const handleDelete = useCallback(() => {
    if (!selectedId) return
    removeSegmento(selectedId)
    setSelectedId(null)
  }, [selectedId, removeSegmento])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawStart(null)
        setSelectedId(null)
        setActiveCircId(null)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) handleDelete()
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

  const snapPoint = useCallback((x: number, y: number, excludeId = -1) => {
    return findNearestEndpoint(x, y, excludeId) ?? { x: snap(x), y: snap(y) }
  }, [findNearestEndpoint])

  // ── Canvas helpers ──────────────────────────────────
  const getRawPos = (e: KonvaEventObject<MouseEvent>) =>
    e.target.getStage()!.getRelativePointerPosition()!

  // ── Zoom ────────────────────────────────────────────
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const pointer  = stage.getPointerPosition()!
    const newScale = Math.min(Math.max(oldScale * (e.evt.deltaY < 0 ? 1.1 : 0.9), 0.1), 20)
    const newX = pointer.x - (pointer.x - stage.x()) * newScale / oldScale
    const newY = pointer.y - (pointer.y - stage.y()) * newScale / oldScale
    stage.scale({ x: newScale, y: -newScale })
    stage.position({ x: newX, y: newY })
  }

  // ── Drawing ─────────────────────────────────────────
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
      addSegmento({ tipo: 'punto', x1: pos.x, y1: pos.y, z1: drawZ, x2: pos.x, y2: pos.y, z2: drawZ, canio_id: null, bandeja_id: null })
      return
    }

    const pos = snapPoint(snap(raw.x), snap(raw.y))
    if (!drawStart) {
      setDrawStart(pos)
    } else {
      addSegmento({ tipo: tool, x1: drawStart.x, y1: drawStart.y, z1: drawZ, x2: pos.x, y2: pos.y, z2: drawZ, canio_id: null, bandeja_id: null })
      setDrawStart(null)
    }
  }

  const handleSegmentClick = (id: number, e: KonvaEventObject<MouseEvent>) => {
    if (tool === 'seleccionar') {
      e.cancelBubble = true
      setSelectedId(id)
      return
    }

    if (tool === 'asignar') {
      if (!activeCircId) return
      e.cancelBubble = true
      const seg = segmentos.find(s => s.id === id)
      if (!seg || (seg.tipo !== 'canio' && seg.tipo !== 'bandeja')) return
      const hasCirc = seg.circuitos.some(c => c.id === activeCircId)
      if (hasCirc) {
        quitarCircuito(id, activeCircId)
      } else {
        const t = tableros.find(t => t.circuitos.find(c => c.id === activeCircId))
        const c = t?.circuitos.find(c => c.id === activeCircId)
        if (!c || !t) return
        asignarCircuito(id, activeCircId, { id: c.id, circuito: c.circuito, tablero: { tag: t.tag } })
      }
    }
  }

  const changeTool = (t: ToolType) => {
    setTool(t)
    setDrawStart(null)
    setSelectedId(null)
    setActiveCircId(null)
  }

  // ── Properties panel actions ────────────────────────
  const selectedSeg = segmentos.find(s => s.id === selectedId) ?? null

  const updateProp = (field: string, value: unknown) => {
    if (!selectedId) return
    editSegmento(selectedId, { [field]: value } as any)
  }

  const handleQuitar = (circId: number) => {
    if (!selectedId) return
    quitarCircuito(selectedId, circId)
  }

  // ── Asignar panel data ──────────────────────────────
  const asignarTablero = tableros.find(t => t.id === asignarTableroId)
  const asignarCircuitos = asignarTablero?.circuitos ?? []
  const activeCirc = tableros.flatMap(t => t.circuitos).find(c => c.id === activeCircId) ?? null

  // ── Grid drawing ───────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawGrid = useCallback((ctx: any, shape: any) => {
    const stage = shape.getStage()
    if (!stage) return
    const scale = stage.scaleX()
    const { x: ox, y: oy } = stage.position()

    const x0 = (0               - ox) / scale
    const x1 = (stage.width()   - ox) / scale
    const yA = (0               - oy) / (-scale)
    const yB = (stage.height()  - oy) / (-scale)
    const y0 = Math.min(yA, yB)
    const y1 = Math.max(yA, yB)

    const minor = niceSpacing(50  / scale)
    const major = minor * 5
    const thin  = 0.5 / scale
    const thick = 1   / scale

    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = thin
    ctx.beginPath()
    for (let x = Math.floor(x0 / minor) * minor; x <= x1 + minor; x += minor) {
      ctx.moveTo(x, y0); ctx.lineTo(x, y1)
    }
    for (let y = Math.floor(y0 / minor) * minor; y <= y1 + minor; y += minor) {
      ctx.moveTo(x0, y); ctx.lineTo(x1, y)
    }
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255,255,255,0.13)'
    ctx.lineWidth = thick
    ctx.beginPath()
    for (let x = Math.floor(x0 / major) * major; x <= x1 + major; x += major) {
      ctx.moveTo(x, y0); ctx.lineTo(x, y1)
    }
    for (let y = Math.floor(y0 / major) * major; y <= y1 + major; y += major) {
      ctx.moveTo(x0, y); ctx.lineTo(x1, y)
    }
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = thick
    ctx.beginPath()
    ctx.moveTo(0, y0); ctx.lineTo(0, y1)
    ctx.moveTo(x0, 0); ctx.lineTo(x1, 0)
    ctx.stroke()

    const fs  = 11 / scale
    const pad =  4 / scale
    ctx.font      = `${fs}px monospace`
    ctx.fillStyle = 'rgba(255,255,255,0.28)'

    for (let x = Math.floor(x0 / major) * major; x <= x1 + major; x += major) {
      if (Math.abs(x) < minor * 0.5) continue
      ctx.save()
      ctx.translate(x + pad, y1 - pad)
      ctx.scale(1, -1)
      ctx.textBaseline = 'top'
      ctx.fillText(formatM(x), 0, 0)
      ctx.restore()
    }

    for (let y = Math.floor(y0 / major) * major; y <= y1 + major; y += major) {
      if (Math.abs(y) < minor * 0.5) continue
      ctx.save()
      ctx.translate(x0 + pad, y + pad)
      ctx.scale(1, -1)
      ctx.textBaseline = 'bottom'
      ctx.fillText(formatM(y), 0, 0)
      ctx.restore()
    }
  }, [])

  // ── Render ───────────────────────────────────────────
  if (!isClient) return <div className="ruteo-loading">Cargando…</div>

  const previewColor  = COLORS[tool] ?? '#aaa'
  const previewStroke = STROKE[tool] ?? 2
  const isPanMode     = tool === 'seleccionar' || tool === 'asignar'

  // Dim segments that don't have the active circuit
  const dimming = tool === 'asignar' && activeCircId !== null
  const snappedMouse  = drawStart ? snapPoint(mousePos.x, mousePos.y) : mousePos
  const isSnapActive  = drawStart && (snappedMouse.x !== mousePos.x || snappedMouse.y !== mousePos.y)

  return (
    <div className="ruteo-layout">

      {/* Toolbar */}
      <div className="ruteo-toolbar">
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`ruteo-tool${tool === t.id ? ' activo' : ''}`}
            onClick={() => changeTool(t.id)}
          >
            {t.dot && <span className="tool-dot" style={{ background: COLORS[t.id] }} />}
            {t.label}
          </button>
        ))}

        <div className="ruteo-separator" />

        <label className="ruteo-zlabel">Z (m)</label>
        <input
          type="number"
          step="0.01"
          value={(drawZ / 100).toFixed(2)}
          onChange={e => setDrawZ(Math.round(Number(e.target.value) * 100))}
          className="ruteo-zinput"
          title="Altura de dibujo en metros"
        />

        <div className="ruteo-separator" />

        {drawStart ? (
          <span className="ruteo-hint">Click para colocar el punto final · Esc para cancelar</span>
        ) : tool === 'asignar' ? (
          activeCircId
            ? <span className="ruteo-hint">Circuito activo: <strong>{activeCirc?.circuito}</strong> · Click en caños/bandejas para asignar o quitar · Esc para deseleccionar</span>
            : <span className="ruteo-hint">Seleccioná un circuito en el panel para activarlo</span>
        ) : tool !== 'seleccionar' ? (
          <span className="ruteo-hint">Click para colocar el punto de inicio</span>
        ) : selectedId ? (
          <span className="ruteo-hint">Arrastrá los extremos para estirar · Supr para eliminar</span>
        ) : null}
      </div>

      {/* Canvas + Panel */}
      <div className="ruteo-content">

        <div
          ref={containerRef}
          className={`ruteo-canvas-wrapper${isPanMode ? ' tool-seleccionar' : ''}`}
        >
          <div className="ruteo-coords">
            X {(mousePos.x / 100).toFixed(2)}m · Y {(mousePos.y / 100).toFixed(2)}m · Z {(drawZ / 100).toFixed(2)}m
          </div>
          <Stage
            ref={stageRef}
            width={size.w}
            height={size.h}
            draggable={isPanMode}
            onWheel={handleWheel}
            onClick={handleStageClick}
            onMouseMove={handleMouseMove}
          >
            <Layer listening={false}>
              <Shape sceneFunc={(ctx, shape) => drawGrid(ctx, shape)} />
            </Layer>

            <Layer>
              {segmentos.map(seg => {
                const isSelected = seg.id === selectedId
                const color = isSelected ? '#ffffff' : (COLORS[seg.tipo] ?? '#aaa')
                const sw    = (STROKE[seg.tipo] ?? 2) + (isSelected ? 2 : 0)

                // In asignar mode with active circuit: dim segments that don't have it
                const hasActiveCirc = dimming && seg.circuitos.some(c => c.id === activeCircId)
                const canAssign     = seg.tipo === 'canio' || seg.tipo === 'bandeja'
                const opacity = dimming
                  ? (canAssign ? (hasActiveCirc ? 1 : 0.2) : 0.08)
                  : 1

                if (seg.tipo === 'punto') {
                  return (
                    <Circle
                      key={seg.id}
                      x={seg.x1} y={seg.y1}
                      radius={isSelected ? 8 : 6}
                      fill={color}
                      opacity={opacity}
                      draggable={isSelected && tool === 'seleccionar'}
                      onDragEnd={e => {
                        const pos = snapPoint(e.target.x(), e.target.y(), seg.id)
                        e.target.position(pos)
                        editSegmento(seg.id, { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y })
                      }}
                      onClick={e => handleSegmentClick(seg.id, e)}
                    />
                  )
                }

                return (
                  <Line
                    key={seg.id}
                    points={[seg.x1, seg.y1, seg.x2, seg.y2]}
                    stroke={color}
                    strokeWidth={sw}
                    lineCap="round"
                    hitStrokeWidth={12}
                    opacity={opacity}
                    draggable={isSelected && tool === 'seleccionar'}
                    onDragEnd={e => {
                      const dx = e.target.x()
                      const dy = e.target.y()
                      e.target.position({ x: 0, y: 0 })
                      editSegmento(seg.id, {
                        x1: snap(seg.x1 + dx), y1: snap(seg.y1 + dy),
                        x2: snap(seg.x2 + dx), y2: snap(seg.y2 + dy),
                      })
                    }}
                    onClick={e => handleSegmentClick(seg.id, e)}
                  />
                )
              })}

              {/* Endpoint handles for selected line (seleccionar mode only) */}
              {selectedSeg && selectedSeg.tipo !== 'punto' && tool === 'seleccionar' && (
                <>
                  <Circle
                    x={selectedSeg.x1} y={selectedSeg.y1}
                    radius={7}
                    fill="#fff"
                    stroke={COLORS[selectedSeg.tipo] ?? '#aaa'}
                    strokeWidth={2}
                    draggable
                    onClick={e => { e.cancelBubble = true }}
                    onDragEnd={e => {
                      e.cancelBubble = true
                      const pos = snapPoint(e.target.x(), e.target.y(), selectedSeg.id)
                      e.target.position(pos)
                      editSegmento(selectedSeg.id, { x1: pos.x, y1: pos.y })
                    }}
                  />
                  <Circle
                    x={selectedSeg.x2} y={selectedSeg.y2}
                    radius={7}
                    fill="#fff"
                    stroke={COLORS[selectedSeg.tipo] ?? '#aaa'}
                    strokeWidth={2}
                    draggable
                    onClick={e => { e.cancelBubble = true }}
                    onDragEnd={e => {
                      e.cancelBubble = true
                      const pos = snapPoint(e.target.x(), e.target.y(), selectedSeg.id)
                      e.target.position(pos)
                      editSegmento(selectedSeg.id, { x2: pos.x, y2: pos.y })
                    }}
                  />
                </>
              )}

              {/* Drawing preview */}
              {drawStart && (
                <>
                  <Line
                    points={[drawStart.x, drawStart.y, snappedMouse.x, snappedMouse.y]}
                    stroke={previewColor}
                    strokeWidth={previewStroke}
                    dash={[6, 5]}
                    lineCap="round"
                    listening={false}
                    opacity={0.6}
                  />
                  <Circle
                    x={drawStart.x} y={drawStart.y}
                    radius={4}
                    fill={previewColor}
                    listening={false}
                  />
                  {isSnapActive && (
                    <Circle
                      x={snappedMouse.x} y={snappedMouse.y}
                      radius={7}
                      stroke="#47D5A6"
                      strokeWidth={2}
                      listening={false}
                    />
                  )}
                </>
              )}
            </Layer>
          </Stage>
        </div>

        {/* Properties / Asignar panel */}
        <div className="ruteo-panel">
          {tool === 'asignar' ? (

            /* ── Asignar panel ── */
            <div className="panel-asignar">
              <div className="panel-asignar-hint">
                {activeCircId
                  ? <>Circuito activo: <strong>{activeCirc?.circuito}</strong><br /><span>Click en un caño o bandeja para asignar o quitar</span></>
                  : 'Seleccioná un circuito para activarlo'
                }
              </div>

              {/* Tablero tabs */}
              {tableros.length > 0 && (
                <div className="panel-asignar-tabs">
                  {tableros.map(t => (
                    <button
                      key={t.id}
                      className={`panel-asignar-tab${asignarTableroId === t.id ? ' active' : ''}`}
                      onClick={() => setAsignarTableroId(t.id)}
                    >
                      {t.tag}
                    </button>
                  ))}
                </div>
              )}

              {/* Circuit list */}
              <div className="panel-asignar-circs">
                {asignarCircuitos.length === 0
                  ? <span className="panel-asignar-empty">Sin circuitos</span>
                  : asignarCircuitos.map(c => (
                      <button
                        key={c.id}
                        className={`panel-asignar-circ${activeCircId === c.id ? ' activo' : ''}`}
                        onClick={() => setActiveCircId(activeCircId === c.id ? null : c.id)}
                      >
                        {c.circuito}
                      </button>
                    ))
                }
              </div>
            </div>

          ) : selectedSeg ? (

            /* ── Seleccionar panel ── */
            <>
              <div className="panel-header">
                <span className="panel-dot" style={{ background: COLORS[selectedSeg.tipo] }} />
                <span className="panel-title">{selectedSeg.tipo}</span>
                <button className="panel-delete" onClick={handleDelete}>Eliminar</button>
              </div>

              <div className="panel-section">
                <label>Punto inicio</label>
                <div className="panel-row">
                  <div>
                    <label>X1 (m)</label>
                    <DeferredInput type="number" step="0.01" value={selectedSeg.x1 / 100}
                      onPreview={v => previewSegmento(selectedSeg.id, { x1: Math.round(v * 100) })}
                      onCommit={v => updateProp('x1', Math.round(v * 100))} />
                  </div>
                  <div>
                    <label>Y1 (m)</label>
                    <DeferredInput type="number" step="0.01" value={selectedSeg.y1 / 100}
                      onPreview={v => previewSegmento(selectedSeg.id, { y1: Math.round(v * 100) })}
                      onCommit={v => updateProp('y1', Math.round(v * 100))} />
                  </div>
                  <div>
                    <label>Z1 (m)</label>
                    <DeferredInput type="number" step="0.01" value={selectedSeg.z1 / 100}
                      onPreview={v => previewSegmento(selectedSeg.id, { z1: Math.round(v * 100) })}
                      onCommit={v => updateProp('z1', Math.round(v * 100))} />
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <label>Punto fin</label>
                <div className="panel-row">
                  <div>
                    <label>X2 (m)</label>
                    <DeferredInput type="number" step="0.01" value={selectedSeg.x2 / 100}
                      onPreview={v => previewSegmento(selectedSeg.id, { x2: Math.round(v * 100) })}
                      onCommit={v => updateProp('x2', Math.round(v * 100))} />
                  </div>
                  <div>
                    <label>Y2 (m)</label>
                    <DeferredInput type="number" step="0.01" value={selectedSeg.y2 / 100}
                      onPreview={v => previewSegmento(selectedSeg.id, { y2: Math.round(v * 100) })}
                      onCommit={v => updateProp('y2', Math.round(v * 100))} />
                  </div>
                  <div>
                    <label>Z2 (m)</label>
                    <DeferredInput type="number" step="0.01" value={selectedSeg.z2 / 100}
                      onPreview={v => previewSegmento(selectedSeg.id, { z2: Math.round(v * 100) })}
                      onCommit={v => updateProp('z2', Math.round(v * 100))} />
                  </div>
                </div>
              </div>

              {selectedSeg.tipo === 'canio' && (
                <div className="panel-section">
                  <label>Tipo de caño</label>
                  <select
                    value={selectedSeg.canio_id ?? ''}
                    onChange={e => updateProp('canio_id', e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">— Sin especificar —</option>
                    {canios.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedSeg.tipo === 'bandeja' && (
                <div className="panel-section">
                  <label>Tipo de bandeja</label>
                  <select
                    value={selectedSeg.bandeja_id ?? ''}
                    onChange={e => updateProp('bandeja_id', e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">— Sin especificar —</option>
                    {bandejas.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.nombre ?? 'Bandeja'} — {b.ancho} mm
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(selectedSeg.tipo === 'canio' || selectedSeg.tipo === 'bandeja') && selectedSeg.circuitos.length > 0 && (
                <div className="panel-section">
                  <label>Circuitos asignados</label>
                  <div className="panel-chips">
                    {selectedSeg.circuitos.map(c => (
                      <div key={c.id} className="panel-chip">
                        <div>
                          <span>{c.circuito}</span>
                          <span className="panel-chip-sub"> · {c.tablero.tag}</span>
                        </div>
                        <button onClick={() => handleQuitar(c.id)}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>

          ) : (
            <div className="panel-empty">
              <span>Seleccioná un elemento para ver sus propiedades</span>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
