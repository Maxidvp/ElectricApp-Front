'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage, Layer, Line, Rect, Text, Circle, Shape } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { UnifilarModel } from './_model'
import { GAP_UNIFILAR_PLANILLA, LINE_WEIGHT_UNIFILAR } from './_model'
import type { PlanillaModel } from './_planilla'
import CadSymbol from './CadSymbol'
import PlanillaLayer from './PlanillaLayer'

const DARK_BG = '#121212'
const STROKE = '#ffffff'
const MUTED = '#a3a3a3'
const SYMBOL_COLOR = '#4fc3f7'
const GREEN = '#4caf50'
// Color fijo del cartel de riesgo eléctrico (mismo amarillo de cartel de seguridad que
// trae el SVG original, RGB(255,191,0)) — no sigue la paleta celeste/blanco del resto,
// un cartel de seguridad real siempre es amarillo/negro sin importar el tema.
const PELIGRO_COLOR = '#ffbf00'

// Alto mínimo del panel antes de hidratar (placeholder) — una vez montado, el panel
// ocupa todo el alto disponible de su contenedor (ver className flex-1 más abajo) en
// vez de un alto fijo: es independiente del alto real del contenido (unifilar +
// planilla, en mm), total acá se puede hacer zoom/pan.
const MIN_VIEWPORT_H = 420

// Redondea un paso de grilla en mm a un número "prolijo" — mismo criterio que
// niceSpacing de RuteoCanvas (src/app/ruteo/_constants.ts), duplicado acá porque la
// unidad es distinta (mm en vez de cm) y no vale la pena acoplar los dos módulos por
// una función de 3 líneas.
function niceSpacingMM(worldPx: number): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
  return steps.find(s => s >= worldPx) ?? 5000
}

function formatMM(mm: number): string {
  return mm === 0 ? '0' : `${Math.round(mm)}mm`
}

interface Props {
  model: UnifilarModel
  // La planilla se dibuja en el mismo Stage, debajo del unifilar — así comparten
  // el mismo zoom/pan y se mueven juntos en vez de ser dos canvas independientes.
  planilla?: PlanillaModel | null
}

export default function UnifilarCanvas({ model, planilla }: Props) {
  const [isClient, setIsClient] = useState(false)
  const [size, setSize] = useState({ w: 800, h: MIN_VIEWPORT_H })
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)

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

  // Zoom centrado en el cursor — misma fórmula que RuteoCanvas (ver src/app/ruteo/
  // RuteoCanvas.tsx): mantiene el punto del mundo debajo del puntero fijo durante el
  // escalado. Acá no hace falta el flip de eje Y que usa ruteo (nuestras coordenadas
  // ya crecen hacia abajo, igual que Konva).
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()
    if (!stage || !pointer) return
    // Tope de zoom alto (80x) a propósito: la grilla recién puede llegar a marcar
    // milímetros individuales (niceSpacingMM elige 1mm) cuando 50/scale <= 1, es decir
    // scale >= 50 — con el tope viejo (8x) nunca se llegaba a esa resolución.
    const oldScale = stage.scaleX()
    const newScale = Math.min(Math.max(oldScale * (e.evt.deltaY < 0 ? 1.1 : 0.9), 0.3), 80)
    stage.scale({ x: newScale, y: newScale })
    stage.position({
      x: pointer.x - (pointer.x - stage.x()) * newScale / oldScale,
      y: pointer.y - (pointer.y - stage.y()) * newScale / oldScale,
    })
  }

  // Cuadrícula de fondo — misma idea que RuteoCanvas (drawGrid en RuteoCanvas.tsx):
  // líneas menores/mayores + coordenadas en mm, recalculadas en cada redraw según el
  // zoom/pan actual del Stage. Sin el flip de eje Y que usa ruteo (acá no hace falta).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawGrid = useCallback((ctx: any, shape: any) => {
    const stage = shape.getStage(); if (!stage) return
    const scale = stage.scaleX()
    const { x: ox, y: oy } = stage.position()
    const x0 = (0 - ox) / scale, x1 = (stage.width() - ox) / scale
    const y0 = (0 - oy) / scale, y1 = (stage.height() - oy) / scale
    const minor = niceSpacingMM(50 / scale), major = minor * 5
    const thin = 0.5 / scale, thick = 1 / scale

    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = thin; ctx.beginPath()
    for (let x = Math.floor(x0 / minor) * minor; x <= x1 + minor; x += minor) { ctx.moveTo(x, y0); ctx.lineTo(x, y1) }
    for (let y = Math.floor(y0 / minor) * minor; y <= y1 + minor; y += minor) { ctx.moveTo(x0, y); ctx.lineTo(x1, y) }
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = thick; ctx.beginPath()
    for (let x = Math.floor(x0 / major) * major; x <= x1 + major; x += major) { ctx.moveTo(x, y0); ctx.lineTo(x, y1) }
    for (let y = Math.floor(y0 / major) * major; y <= y1 + major; y += major) { ctx.moveTo(x0, y); ctx.lineTo(x1, y) }
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = thick; ctx.beginPath()
    ctx.moveTo(0, y0); ctx.lineTo(0, y1); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke()

    const fs = 11 / scale, pad = 4 / scale
    ctx.font = `${fs}px monospace`; ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.textBaseline = 'top'
    for (let x = Math.floor(x0 / major) * major; x <= x1 + major; x += major) {
      if (Math.abs(x) < minor * 0.5) continue
      ctx.fillText(formatMM(x), x + pad, y0 + pad)
    }
    for (let y = Math.floor(y0 / major) * major; y <= y1 + major; y += major) {
      if (Math.abs(y) < minor * 0.5) continue
      ctx.fillText(formatMM(y), x0 + pad, y + pad)
    }
  }, [])

  if (!isClient) return <div className="flex-1" style={{ minHeight: MIN_VIEWPORT_H }} />

  const vacio = model.lines.length === 0

  return (
    <div
      ref={containerRef}
      className="cursor-grab active:cursor-grabbing flex-1 min-h-0"
      style={{ background: DARK_BG, overflow: 'hidden' }}
    >
      <Stage ref={stageRef} width={size.w} height={size.h} draggable onWheel={handleWheel}>
        <Layer listening={false}>
          <Shape sceneFunc={(ctx, shape) => drawGrid(ctx, shape)} />
        </Layer>
        <Layer>
          {vacio ? (
            <Text x={20} y={size.h / 2 - 8} text="Sin circuitos en este tablero." fontSize={13} fill={MUTED} />
          ) : (
            <>
              {model.lines.map((l, i) => (
                <Line
                  key={`l${i}`} points={[l.x1, l.y1, l.x2, l.y2]}
                  stroke={l.role === 'tierra' ? GREEN : l.role === 'limite' ? SYMBOL_COLOR : STROKE}
                  strokeWidth={l.weight}
                />
              ))}
              {/* rects = placeholder de símbolo faltante (ver missingSymbolRect en
                  _model.ts) — siempre celeste, mismo color informativo que un CadSymbol
                  sin esConductor. */}
              {model.rects.map((r, i) => (
                <Rect key={`r${i}`} x={r.x} y={r.y} width={r.w} height={r.h} stroke={SYMBOL_COLOR} strokeWidth={LINE_WEIGHT_UNIFILAR} />
              ))}
              {model.dots.map((d, i) => (
                <Circle key={`d${i}`} x={d.x} y={d.y} radius={d.r} fill={d.role === 'tierra' ? GREEN : STROKE} />
              ))}
              {model.symbols.map((s, i) => (
                <CadSymbol
                  key={`s${i}`} def={s.def} x={s.x} y={s.y}
                  color={s.role === 'peligro' ? PELIGRO_COLOR : s.role === 'tierra' ? GREEN : s.esConductor ? STROKE : SYMBOL_COLOR}
                />
              ))}
              {model.texts.map((t, i) => (
                <Text
                  key={`t${i}`}
                  x={t.x} y={t.y} width={t.width} align={t.align ?? 'left'}
                  text={t.text} fontSize={t.size} fontStyle={t.bold ? 'bold' : 'normal'}
                  fill={t.role === 'peligro' ? PELIGRO_COLOR : t.role === 'tierra' ? GREEN : t.bold ? STROKE : MUTED}
                />
              ))}
              {planilla && <PlanillaLayer model={planilla} dy={model.height + GAP_UNIFILAR_PLANILLA} />}
            </>
          )}
        </Layer>
      </Stage>
    </div>
  )
}
