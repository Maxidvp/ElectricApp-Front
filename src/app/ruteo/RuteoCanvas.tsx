'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Line, Circle, Shape, Rect } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useProyectos } from '@/context/ProyectosContext'
import type { Segmento, Pared } from '@/services/ruteo'
import { COLORS, STROKE, snap, niceSpacing, formatM } from './_constants'
import type { ToolType } from './_constants'

// ── Split helper ──────────────────────────────────────────────────

function closestPtOnSegLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return null
  const t = ((px - x1) * dx + (py - y1) * dy) / len2
  if (t <= 0.02 || t >= 0.98) return null
  return { x: x1 + t * dx, y: y1 + t * dy, t }
}

// ── Rubber-band helpers ────────────────────────────────────────────

function ptInRect(px: number, py: number, rx1: number, ry1: number, rx2: number, ry2: number) {
  const xMin = Math.min(rx1, rx2), xMax = Math.max(rx1, rx2)
  const yMin = Math.min(ry1, ry2), yMax = Math.max(ry1, ry2)
  return px >= xMin && px <= xMax && py >= yMin && py <= yMax
}

function segIntersectsRect(ax1: number, ay1: number, ax2: number, ay2: number,
                            rx1: number, ry1: number, rx2: number, ry2: number) {
  const xMin = Math.min(rx1, rx2), xMax = Math.max(rx1, rx2)
  const yMin = Math.min(ry1, ry2), yMax = Math.max(ry1, ry2)
  const dx = ax2 - ax1, dy = ay2 - ay1
  let tMin = 0, tMax = 1
  const p = [-dx, dx, -dy, dy]
  const q = [ax1 - xMin, xMax - ax1, ay1 - yMin, yMax - ay1]
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false }
    else {
      const t = q[i] / p[i]
      if (p[i] < 0) tMin = Math.max(tMin, t); else tMax = Math.min(tMax, t)
    }
    if (tMin > tMax) return false
  }
  return true
}

interface Props {
  tool: ToolType
  drawStart: { x: number; y: number } | null
  drawZ: number
  selectedIds: Set<number>
  selectedParedId: number | null
  activeCircId: number | null
  isSegVisible: (seg: Segmento) => boolean
  isParedVisible: (p: Pared) => boolean
  getSegColor: (seg: Segmento) => string
  snapPoint: (x: number, y: number, excludeId?: number) => { x: number; y: number }
  onStageClick: (isBackground: boolean, rawPos: { x: number; y: number }) => void
  onSegmentClick: (id: number, e: KonvaEventObject<MouseEvent>) => void
  onBoxSelect: (ids: number[]) => void
  onSelectPared: (id: number | null) => void
  onSplitSegment: (segId: number, x: number, y: number, z: number) => void
}

export function RuteoCanvas({
  tool, drawStart, drawZ, selectedIds, selectedParedId, activeCircId,
  isSegVisible, isParedVisible, getSegColor, snapPoint,
  onStageClick, onSegmentClick, onBoxSelect, onSelectPared, onSplitSegment,
}: Props) {
  const [isClient,      setIsClient]      = useState(false)
  const [size,          setSize]          = useState({ w: 800, h: 600 })
  const [mousePos,      setMousePos]      = useState({ x: 0, y: 0 })
  const [midPanning,    setMidPanning]    = useState(false)
  const [selStart,      setSelStart]      = useState<{ x: number; y: number } | null>(null)
  const [selCurrent,    setSelCurrent]    = useState<{ x: number; y: number } | null>(null)
  const [splitSnap,     setSplitSnap]     = useState<{ x: number; y: number; z: number; segId: number } | null>(null)
  const boxSelectDone = useRef(false)
  const containerRef     = useRef<HTMLDivElement>(null)
  const stageRef         = useRef<Konva.Stage>(null)
  const stageInitialized = useRef(false)
  const midPanActive     = useRef(false)
  const midPanLast       = useRef({ x: 0, y: 0 })

  const { segmentos, paredes, editSegmento, editPared } = useProyectos()

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

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage    = stageRef.current!
    const oldScale = stage.scaleX()
    const pointer  = stage.getPointerPosition()!
    const newScale = Math.min(Math.max(oldScale * (e.evt.deltaY < 0 ? 1.1 : 0.9), 0.1), 20)
    stage.scale({ x: newScale, y: -newScale })
    stage.position({
      x: pointer.x - (pointer.x - stage.x()) * newScale / oldScale,
      y: pointer.y - (pointer.y - stage.y()) * newScale / oldScale,
    })
  }

  useEffect(() => { if (tool !== 'dividir') setSplitSnap(null) }, [tool])

  // Limpia el pan si el usuario suelta la rueda fuera del canvas
  useEffect(() => {
    const onUp = (e: MouseEvent) => {
      if (e.button === 1 && midPanActive.current) {
        midPanActive.current = false
        setMidPanning(false)
      }
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) {
      e.evt.preventDefault()
      midPanActive.current = true
      midPanLast.current = { x: e.evt.clientX, y: e.evt.clientY }
      setMidPanning(true)
      return
    }
    if (e.evt.button === 0 && tool === 'seleccionar' && e.target === e.target.getStage()) {
      const pos = e.target.getStage()!.getRelativePointerPosition()!
      setSelStart(pos)
      setSelCurrent(null)
    }
  }

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) {
      midPanActive.current = false
      setMidPanning(false)
      return
    }
    if (e.evt.button === 0 && selStart && selCurrent) {
      const dx = Math.abs(selCurrent.x - selStart.x)
      const dy = Math.abs(selCurrent.y - selStart.y)
      if (dx > 10 || dy > 10) {
        const crossing = selCurrent.x < selStart.x
        const ids = segmentos
          .filter(s => isSegVisible(s))
          .filter(s => crossing
            ? ptInRect(s.x1, s.y1, selStart.x, selStart.y, selCurrent.x, selCurrent.y)
              || ptInRect(s.x2, s.y2, selStart.x, selStart.y, selCurrent.x, selCurrent.y)
              || segIntersectsRect(s.x1, s.y1, s.x2, s.y2, selStart.x, selStart.y, selCurrent.x, selCurrent.y)
            : ptInRect(s.x1, s.y1, selStart.x, selStart.y, selCurrent.x, selCurrent.y)
              && ptInRect(s.x2, s.y2, selStart.x, selStart.y, selCurrent.x, selCurrent.y)
          )
          .map(s => s.id)
        onBoxSelect(ids)
        boxSelectDone.current = true
      }
    }
    setSelStart(null)
    setSelCurrent(null)
  }

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const raw = e.target.getStage()!.getRelativePointerPosition()!
    setMousePos({ x: snap(raw.x), y: snap(raw.y) })
    if (midPanActive.current) {
      const stage = stageRef.current!
      const dx = e.evt.clientX - midPanLast.current.x
      const dy = e.evt.clientY - midPanLast.current.y
      stage.position({ x: stage.x() + dx, y: stage.y() + dy })
      midPanLast.current = { x: e.evt.clientX, y: e.evt.clientY }
    }
    if (selStart) setSelCurrent({ x: raw.x, y: raw.y })

    if (tool === 'dividir') {
      const scale = stageRef.current?.scaleX() ?? 1
      const hitDist = 12 / scale
      let best: { x: number; y: number; z: number; segId: number; dist: number } | null = null
      for (const seg of segmentos) {
        if (!isSegVisible(seg) || seg.tipo === 'punto') continue
        const cp = closestPtOnSegLine(raw.x, raw.y, seg.x1, seg.y1, seg.x2, seg.y2)
        if (!cp) continue
        const dist = Math.hypot(raw.x - cp.x, raw.y - cp.y)
        if (dist > hitDist) continue
        if (best && dist >= best.dist) continue
        const isH = seg.y1 === seg.y2, isV = seg.x1 === seg.x2
        let sx: number, sy: number
        if (isH) { sx = snap(raw.x); sy = seg.y1 }
        else if (isV) { sx = seg.x1; sy = snap(raw.y) }
        else { sx = snap(cp.x); sy = snap(cp.y) }
        const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1
        const len2 = dx * dx + dy * dy
        const t2 = ((sx - seg.x1) * dx + (sy - seg.y1) * dy) / len2
        if (t2 <= 0.01 || t2 >= 0.99) continue
        const sz = snap(seg.z1 + t2 * (seg.z2 - seg.z1))
        best = { x: sx, y: sy, z: sz, segId: seg.id, dist }
      }
      setSplitSnap(best ? { x: best.x, y: best.y, z: best.z, segId: best.segId } : null)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawGrid = useCallback((ctx: any, shape: any) => {
    const stage = shape.getStage(); if (!stage) return
    const scale = stage.scaleX()
    const { x: ox, y: oy } = stage.position()
    const x0 = (0 - ox) / scale;             const x1 = (stage.width()  - ox) / scale
    const yA = (0 - oy) / (-scale);           const yB = (stage.height() - oy) / (-scale)
    const y0 = Math.min(yA, yB);              const y1 = Math.max(yA, yB)
    const minor = niceSpacing(50 / scale);    const major = minor * 5
    const thin  = 0.5 / scale;               const thick = 1 / scale

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

  if (!isClient) return null

  const isPanMode     = tool === 'seleccionar' || tool === 'asignar'
  const previewColor  = COLORS[tool] ?? '#aaa'
  const previewStroke = STROKE[tool] ?? 2
  const dimming       = tool === 'asignar' && activeCircId !== null
  const snappedMouse  = drawStart ? snapPoint(mousePos.x, mousePos.y) : mousePos
  const isSnapActive  = drawStart && (snappedMouse.x !== mousePos.x || snappedMouse.y !== mousePos.y)
  const selectedId    = selectedIds.size === 1 ? [...selectedIds][0] : null
  const selectedSeg   = selectedId !== null ? segmentos.find(s => s.id === selectedId) ?? null : null

  const cursorClass = midPanning ? 'cursor-grabbing'
    : tool === 'dividir' ? (splitSnap ? 'cursor-crosshair' : 'cursor-default')
    : isPanMode ? 'cursor-default' : 'cursor-crosshair'

  return (
    <div ref={containerRef} className={`flex-1 overflow-hidden relative ${cursorClass}`}>
      <div className="absolute bottom-2.5 left-3 text-[11px] text-surface-tonal-a40 bg-[rgba(27,26,32,0.75)] px-2 py-0.75 rounded-sm pointer-events-none z-5 tabular-nums tracking-[0.02em]">
        X {(mousePos.x/100).toFixed(2)}m · Y {(mousePos.y/100).toFixed(2)}m · Z {(drawZ/100).toFixed(2)}m
      </div>
      <Stage ref={stageRef} width={size.w} height={size.h}
        draggable={false} onWheel={handleWheel}
        onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}
        onClick={e => {
          if (e.evt.button !== 0) return
          if (boxSelectDone.current) { boxSelectDone.current = false; return }
          if (tool === 'dividir' && splitSnap) {
            onSplitSegment(splitSnap.segId, splitSnap.x, splitSnap.y, splitSnap.z)
            setSplitSnap(null)
            return
          }
          const stage = e.target.getStage()!
          onStageClick(e.target === stage, stage.getRelativePointerPosition()!)
        }}>

        <Layer listening={false}>
          <Shape sceneFunc={(ctx, shape) => drawGrid(ctx, shape)} />
        </Layer>

        <Layer>
          {segmentos.map(seg => {
            const visible       = isSegVisible(seg)
            const isSelected    = selectedIds.has(seg.id)
            const color         = isSelected ? '#ffffff' : getSegColor(seg)
            const sw            = (STROKE[seg.tipo] ?? 2) + (isSelected ? 2 : 0)
            const hasActiveCirc = dimming && seg.circuitos.some(c => c.id === activeCircId)
            const canAssign     = seg.tipo === 'canio' || seg.tipo === 'bandeja'
            const opacity = !visible ? 0
              : dimming ? (canAssign ? (hasActiveCirc ? 1 : 0.2) : 0.08)
              : 1

            if (seg.tipo === 'punto') return (
              <Circle key={seg.id} x={seg.x1} y={seg.y1}
                radius={isSelected ? 8 : 6} fill={color} opacity={opacity} listening={visible}
                draggable={isSelected && selectedIds.size === 1 && tool === 'seleccionar'}
                onDragEnd={e => {
                  const pos = snapPoint(e.target.x(), e.target.y(), seg.id)
                  e.target.position(pos)
                  editSegmento(seg.id, { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y })
                }}
                onClick={e => onSegmentClick(seg.id, e)} />
            )

            if (seg.x1 === seg.x2 && seg.y1 === seg.y2) {
              const r = sw * 2 + 3
              return (
                <Shape key={seg.id}
                  x={seg.x1} y={seg.y1}
                  sceneFunc={(ctx, shape) => {
                    ctx.beginPath()
                    ctx.moveTo(-r, -r); ctx.lineTo(r, r)
                    ctx.moveTo(-r,  r); ctx.lineTo(r, -r)
                    ctx.strokeShape(shape)
                  }}
                  stroke={color} strokeWidth={sw} lineCap="round"
                  hitFunc={(ctx, shape) => {
                    ctx.beginPath(); ctx.rect(-r - 4, -r - 4, (r + 4) * 2, (r + 4) * 2)
                    ctx.fillShape(shape)
                  }}
                  opacity={opacity} listening={visible}
                  draggable={isSelected && selectedIds.size === 1 && tool === 'seleccionar'}
                  onDragEnd={e => {
                    const pos = snapPoint(e.target.x(), e.target.y(), seg.id)
                    e.target.position(pos)
                    editSegmento(seg.id, { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y })
                  }}
                  onClick={e => onSegmentClick(seg.id, e)} />
              )
            }

            return (
              <Line key={seg.id} points={[seg.x1, seg.y1, seg.x2, seg.y2]}
                stroke={color} strokeWidth={sw} lineCap="round" hitStrokeWidth={12}
                opacity={opacity} listening={visible}
                draggable={isSelected && selectedIds.size === 1 && tool === 'seleccionar'}
                onDragEnd={e => {
                  const dx = e.target.x(); const dy = e.target.y()
                  e.target.position({ x: 0, y: 0 })
                  editSegmento(seg.id, { x1: snap(seg.x1+dx), y1: snap(seg.y1+dy), x2: snap(seg.x2+dx), y2: snap(seg.y2+dy) })
                }}
                onClick={e => onSegmentClick(seg.id, e)} />
            )
          })}

          {segmentos.flatMap(seg => {
            if (!isSegVisible(seg) || selectedIds.has(seg.id)) return []
            if (seg.tipo === 'punto' || (seg.x1 === seg.x2 && seg.y1 === seg.y2)) return []
            const baseSw     = STROKE[seg.tipo] ?? 2
            const color      = getSegColor(seg)
            const hasActiveCirc = dimming && seg.circuitos.some(c => c.id === activeCircId)
            const canAssign  = seg.tipo === 'canio' || seg.tipo === 'bandeja'
            const opacity    = dimming ? (canAssign ? (hasActiveCirc ? 1 : 0.2) : 0.08) : 1
            const r = baseSw * 0.75
            return [
              <Circle key={`ep1-${seg.id}`} x={seg.x1} y={seg.y1} radius={r} fill={color} opacity={opacity} listening={false} />,
              <Circle key={`ep2-${seg.id}`} x={seg.x2} y={seg.y2} radius={r} fill={color} opacity={opacity} listening={false} />,
            ]
          })}

          {paredes.map(p => {
            const visible    = isParedVisible(p)
            const isSelected = p.id === selectedParedId
            const color      = isSelected ? '#ffffff' : (p.color ?? COLORS.pared)
            const sw         = STROKE.pared + (isSelected ? 2 : 0)
            return (
              <Line key={`pared-${p.id}`} points={[p.x1, p.y1, p.x2, p.y2]}
                stroke={color} strokeWidth={sw} lineCap="round" hitStrokeWidth={12}
                opacity={visible ? 1 : 0} listening={visible}
                draggable={isSelected && selectedIds.size === 1 && tool === 'seleccionar'}
                onDragEnd={e => {
                  const dx = e.target.x(); const dy = e.target.y()
                  e.target.position({ x: 0, y: 0 })
                  editPared(p.id, { x1: snap(p.x1+dx), y1: snap(p.y1+dy), x2: snap(p.x2+dx), y2: snap(p.y2+dy) })
                }}
                onClick={e => {
                  if (tool !== 'seleccionar') return
                  e.cancelBubble = true
                  onSelectPared(isSelected ? null : p.id)
                }} />
            )
          })}

          {/* Endpoint handles for selected pared */}
          {(() => {
            const sp = paredes.find(p => p.id === selectedParedId)
            if (!sp || tool !== 'seleccionar') return null
            return (<>
              <Circle x={sp.x1} y={sp.y1} radius={7} fill="#fff" stroke={COLORS.pared} strokeWidth={2} draggable
                onClick={e => { e.cancelBubble = true }}
                onDragEnd={e => {
                  e.cancelBubble = true
                  const pos = snapPoint(e.target.x(), e.target.y(), -sp.id - 1e6)
                  e.target.position(pos); editPared(sp.id, { x1: pos.x, y1: pos.y })
                }} />
              <Circle x={sp.x2} y={sp.y2} radius={7} fill="#fff" stroke={COLORS.pared} strokeWidth={2} draggable
                onClick={e => { e.cancelBubble = true }}
                onDragEnd={e => {
                  e.cancelBubble = true
                  const pos = snapPoint(e.target.x(), e.target.y(), -sp.id - 1e6)
                  e.target.position(pos); editPared(sp.id, { x2: pos.x, y2: pos.y })
                }} />
            </>)
          })()}

          {/* Endpoint handles for selected segmento */}
          {selectedSeg && selectedSeg.tipo !== 'punto' && tool === 'seleccionar' && (() => {
            const isVert = selectedSeg.x1 === selectedSeg.x2 && selectedSeg.y1 === selectedSeg.y2
            return (<>
              <Circle x={selectedSeg.x1} y={selectedSeg.y1} radius={7} fill="#fff"
                stroke={COLORS[selectedSeg.tipo] ?? '#aaa'} strokeWidth={2} draggable
                onClick={e => { e.cancelBubble = true }}
                onDragEnd={e => {
                  e.cancelBubble = true
                  const pos = snapPoint(e.target.x(), e.target.y(), selectedSeg.id)
                  e.target.position(pos)
                  if (isVert) editSegmento(selectedSeg.id, { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y })
                  else editSegmento(selectedSeg.id, { x1: pos.x, y1: pos.y })
                }} />
              {!isVert && (
                <Circle x={selectedSeg.x2} y={selectedSeg.y2} radius={7} fill="#fff"
                  stroke={COLORS[selectedSeg.tipo] ?? '#aaa'} strokeWidth={2} draggable
                  onClick={e => { e.cancelBubble = true }}
                  onDragEnd={e => {
                    e.cancelBubble = true
                    const pos = snapPoint(e.target.x(), e.target.y(), selectedSeg.id)
                    e.target.position(pos); editSegmento(selectedSeg.id, { x2: pos.x, y2: pos.y })
                  }} />
              )}
            </>)
          })()}

          {/* Rubber-band selection rect */}
          {selStart && selCurrent && (() => {
            const scale    = stageRef.current?.scaleX() ?? 1
            const crossing = selCurrent.x < selStart.x
            return (
              <Rect
                x={Math.min(selStart.x, selCurrent.x)}
                y={Math.min(selStart.y, selCurrent.y)}
                width={Math.abs(selCurrent.x - selStart.x)}
                height={Math.abs(selCurrent.y - selStart.y)}
                fill={crossing ? 'rgba(0,196,140,0.06)' : 'rgba(74,158,255,0.06)'}
                stroke={crossing ? '#00c48c' : '#4a9eff'}
                strokeWidth={1 / scale}
                dash={crossing ? [8 / scale, 4 / scale] : undefined}
                listening={false}
              />
            )
          })()}

          {/* Split crosshair */}
          {tool === 'dividir' && splitSnap && (() => {
            const scale = stageRef.current?.scaleX() ?? 1
            const arm = 10 / scale
            const sw  = 1.5 / scale
            return (<>
              <Line points={[splitSnap.x - arm, splitSnap.y, splitSnap.x + arm, splitSnap.y]}
                stroke="#FFD700" strokeWidth={sw} listening={false} />
              <Line points={[splitSnap.x, splitSnap.y - arm, splitSnap.x, splitSnap.y + arm]}
                stroke="#FFD700" strokeWidth={sw} listening={false} />
              <Circle x={splitSnap.x} y={splitSnap.y} radius={3 / scale} fill="#FFD700" listening={false} />
            </>)
          })()}

          {/* Drawing preview */}
          {drawStart && (<>
            <Line points={[drawStart.x, drawStart.y, snappedMouse.x, snappedMouse.y]}
              stroke={previewColor} strokeWidth={previewStroke} dash={[6, 5]} lineCap="round" listening={false} opacity={0.6} />
            <Circle x={drawStart.x} y={drawStart.y} radius={4} fill={previewColor} listening={false} />
            {isSnapActive && <Circle x={snappedMouse.x} y={snappedMouse.y} radius={7} stroke="#47D5A6" strokeWidth={2} listening={false} />}
          </>)}
        </Layer>
      </Stage>
    </div>
  )
}
