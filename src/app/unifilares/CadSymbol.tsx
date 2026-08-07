'use client'
import { Line, Circle, Group, Shape } from 'react-konva'
import type { SymbolDef } from './_symbols'
import { LINE_WEIGHT_UNIFILAR } from './_model'

interface Props {
  def: SymbolDef
  x: number
  y: number
  color?: string
  strokeWidth?: number
}

// Renderiza un símbolo tomado de un bloque de AutoCAD (ver _symbols.ts) insertado en
// (x, y) — el punto de inserción del SVG original (por default el centro del viewBox,
// salvo que el símbolo defina insertX/insertY, ej. el ITM engancha por arriba) hace
// de ancla, igual que un INSERT de bloque en CAD. strokeWidth por default =
// LINE_WEIGHT_UNIFILAR (no el 0.25 del SVG original, pensado para plotear a escala
// real) para que el símbolo tenga el mismo grosor de trazo que el resto del unifilar.
export default function CadSymbol({ def, x, y, color = '#1a1a1a', strokeWidth = LINE_WEIGHT_UNIFILAR }: Props) {
  const ix = def.insertX ?? def.viewBox / 2
  const iy = def.insertY ?? def.viewBox / 2
  return (
    <Group x={x} y={y}>
      {def.lines.map((l, i) => (
        <Line key={i} points={[l.x1 - ix, l.y1 - iy, l.x2 - ix, l.y2 - iy]} stroke={color} strokeWidth={strokeWidth} />
      ))}
      {def.dots.map((d, i) => (
        <Circle
          key={i} x={d.x - ix} y={d.y - iy} radius={d.r}
          fill={d.filled === false ? undefined : color}
          stroke={d.filled === false ? color : undefined}
          strokeWidth={d.filled === false ? strokeWidth : undefined}
        />
      ))}
      {def.arcs?.map((a, i) => (
        <Shape
          key={i}
          stroke={color}
          strokeWidth={strokeWidth}
          sceneFunc={(ctx, shape) => {
            ctx.beginPath()
            ctx.arc(a.cx - ix, a.cy - iy, a.r, (a.startAngle * Math.PI) / 180, (a.endAngle * Math.PI) / 180, false)
            ctx.strokeShape(shape)
          }}
        />
      ))}
    </Group>
  )
}
