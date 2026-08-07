'use client'
import { Group, Rect, Text, Line } from 'react-konva'
import type { PlanillaModel } from './_planilla'

const BG = '#121212'
const HEADER_FILL = '#22262d'
const ALT_FILL = '#1a1d22'
const STROKE = '#ffffff'
const GRID = '#4a4f57'

interface Props {
  model: PlanillaModel
  // Desplazamiento vertical dentro del canvas compartido — la planilla se dibuja
  // debajo del unifilar, en el mismo Stage (mismo criterio que _export.ts, que
  // también corre la planilla hacia abajo antes de volcarla al .lsp).
  dy: number
}

// Sub-capa de Konva (no tiene Stage/div propio) — se monta dentro del Layer del
// unifilar para que los dos compartan el mismo zoom/pan (ver UnifilarCanvas.tsx).
export default function PlanillaLayer({ model, dy }: Props) {
  return (
    <Group y={dy}>
      {model.rowY.map((y, ri) => (
        <Rect
          key={ri}
          x={model.groupColW} y={y} width={model.width - model.groupColW} height={model.rowHeights[ri]}
          fill={ri % 2 === 0 ? BG : ALT_FILL}
        />
      ))}
      <Rect x={0} y={0} width={model.groupColW} height={model.height} fill={HEADER_FILL} />

      {model.lines.map((l, i) => (
        <Line key={i} points={[l.x1, l.y1, l.x2, l.y2]} stroke={l.role === 'titulo' ? STROKE : GRID} strokeWidth={l.weight} />
      ))}
      {model.texts.map((t, i) => (
        <Text
          key={i}
          x={t.x} y={t.y} width={t.width} align={t.align ?? 'left'} rotation={t.rotation ?? 0}
          text={t.text} fontSize={t.size} fontStyle={t.bold ? 'bold' : 'normal'} fill={STROKE}
        />
      ))}
    </Group>
  )
}
