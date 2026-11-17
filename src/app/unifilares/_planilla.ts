// Mismo criterio que _model.ts: separa qué hay que dibujar (grilla + textos, en las
// mismas unidades que el unifilar) de cómo se dibuja — lo consumen tanto
// PlanillaLayer (Konva) como _export.ts (AutoLISP).
import type { Circuito, Tablero } from '@/context/types'
import { calcCorriente, generarFormacionCopaipa, type FormatoFormacion } from '@/utils/electricidad'
import { COL_W, diagramWidth, type ColumnLayout } from './_layout'
import { textWidth, wrappedLines } from './_measure'
import { poleCount, type ModelLine, type ModelText } from './_model'
import type { CargaCircuito } from '@/utils/cargas'

// Mismo criterio que el resto de la app (ver Caídas/Cargas): la tensión de cálculo
// sale de tipo_tension del circuito + la tensión correspondiente del tablero.
function tensionCircuito(c: Circuito, t: Tablero): number | null {
  if (c.tipo_tension === 'mono') return t.tension_mono
  if (c.tipo_tension === 'bi')   return t.tension_bi
  if (c.tipo_tension === 'tri')  return t.tension_tri
  return null
}

const INTERRUPTOR_ABBR: Record<string, string> = {
  termomagnetico: 'ITM',
  caja_moldeada:  'ITM',
  diferencial:    'ID',
  guardamotor:    'GM',
  seccionador:    'IS',
}

// `carga`: la carga efectiva del circuito (utils/cargas.ts). Con ella la planilla muestra lo
// mismo que Cargas: la demanda de un alimentador vinculado y la corriente simultánea.
type Row = { label: string; get: (c: Circuito, t: Tablero, carga?: CargaCircuito) => string }

export const ROWS: Row[] = [
  { label: 'CIRCUITO N°', get: c => c.circuito },
  {
    label: 'FASE/S DE CONEXIÓN',
    get: c => {
      if (!c.fase) return '—'
      const neutro = (c.formacion?.Nneutro ?? 0) > 0 ? '/N' : ''
      return `${c.fase.split('').join('-')}${neutro}`
    },
  },
  { label: 'TIPO CIRCUITO', get: c => c.tipo ?? '—' },
  {
    label: 'POTENCIA (kW)',
    get: (c, _t, carga) => {
      const p = carga ? carga.potenciaInstalada : c.potencia
      return p != null ? String(Number(p.toFixed(2))) : '—'
    },
  },
  {
    label: 'CORRIENTE (A)',
    get: (c, t, carga) => {
      const i = carga ? carga.corriente : calcCorriente(c.potencia, c.tipo_tension, tensionCircuito(c, t), c.FP)
      return i != null ? i.toFixed(2) : '—'
    },
  },
  {
    label: 'INTERRUPTOR',
    get: c => c.proteccion ? (INTERRUPTOR_ABBR[c.proteccion.familia?.tipo ?? ''] ?? '—') : '—',
  },
  {
    label: 'REGULACIÓN (A)',
    get: c => {
      const p = c.proteccion
      if (!p) return '—'
      if (p.familia?.tipo === 'guardamotor') {
        return p.rango_regulacion_min != null && p.rango_regulacion_max != null
          ? `${p.rango_regulacion_min}-${p.rango_regulacion_max}A` : '—'
      }
      return 'FIJA'
    },
  },
  { label: 'NORMA CONDUCTOR', get: c => c.formacion?.cable.familia?.norma ?? '—' },
  {
    label: 'SECC. CABLE (mm²)',
    get: c => {
      const f = c.formacion
      if (!f) return '—'
      // Misma cuenta de conductores que la marca de cable del dibujo (poleCount).
      const paralelo = f.cond_por_fase > 1 ? `${f.cond_por_fase}x(` : ''
      return `${paralelo}${poleCount(f)}x${f.cable.seccion_f}${f.cable.calibre_tipo}${paralelo ? ')' : ''}`
    },
  },
  {
    label: 'SECC. CABLE PE (mm²)',
    get: c => c.formacion?.cable_tierra
      ? `1x${c.formacion.cable_tierra.seccion_f}${c.formacion.cable_tierra.calibre_tipo}`
      : '—',
  },
  { label: 'DESTINO DEL CIRCUITO', get: c => c.tablero_destino ? `Tablero ${c.tablero_destino.tag}` : c.descripcion ?? '—' },
]

// Formato COPAIPA: norma + sección + PE van juntos en una sola fila, completos (con
// norma) — en las tablas del resto de la app el mismo formato va sin norma.
const ROW_COPAIPA: Row = {
  label: 'SECCIÓN [mm²] TIPO NORMA',
  get: c => c.formacion ? generarFormacionCopaipa(c.formacion, true) : '—',
}
const ROWS_CABLE_SEPARADO = ['NORMA CONDUCTOR', 'SECC. CABLE (mm²)', 'SECC. CABLE PE (mm²)']

export function planillaRows(formato: FormatoFormacion): Row[] {
  if (formato !== 'copaipa') return ROWS
  const i = ROWS.findIndex(r => r.label === ROWS_CABLE_SEPARADO[0])
  const resto = ROWS.filter(r => !ROWS_CABLE_SEPARADO.includes(r.label))
  return [...resto.slice(0, i), ROW_COPAIPA, ...resto.slice(i)]
}

// Todo lo que sigue son mínimos — crecen si el contenido no entra (ver
// computeColumnLayout y el cálculo de alto de fila en buildPlanillaModel).
export const ROW_H_MIN = 8
export const GROUP_COL_W_MIN = 20
export const LABEL_COL_W_MIN = 40

// Mismo criterio que TEXT_SIZE_TITULO/DATO (ver comentario en el uso más abajo) para
// el grosor de línea: borde exterior/cabecera vs grilla de datos.
export const LINE_WEIGHT_TITULO = 0.25
export const LINE_WEIGHT_DATO = 0.2

const TEXT_SIZE_TITULO = 2.5
const TEXT_SIZE_DATO = 2
const LINE_H = 1.3       // factor de alto de línea sobre el tamaño de fuente
const PAD_X_LABEL = 6    // padding horizontal de la columna de etiquetas (cada lado)
const PAD_X_DATO = 4     // padding horizontal de una celda de dato (cada lado)
const PAD_Y = 2          // padding vertical de una celda (cada lado)

// Ancho de las columnas de grupo/etiqueta para un tablero — mínimos que crecen si el
// tag del tablero o alguna etiqueta de fila no entran. Se calcula una sola vez por
// tablero (no depende de los circuitos) y se comparte entre la planilla y el
// unifilar (columnX/diagramWidth en _layout.ts) para que las columnas sigan alineadas.
export function computeColumnLayout(tablero: Tablero, formato: FormatoFormacion = 'ingles'): ColumnLayout {
  const maxLabelW = planillaRows(formato).reduce((max, r) => Math.max(max, textWidth(r.label, TEXT_SIZE_TITULO, true)), 0)
  const labelColW = Math.max(LABEL_COL_W_MIN, maxLabelW + PAD_X_LABEL * 2)

  // El tag va rotado — lo que tiene que entrar en el ancho de la columna es el alto
  // de línea de la fuente (no el largo del string, que corre a lo largo de toda la
  // tabla, no de la columna).
  const tagThickness = TEXT_SIZE_TITULO * LINE_H + PAD_X_LABEL * 2
  const groupColW = Math.max(GROUP_COL_W_MIN, tagThickness)

  return { groupColW, labelColW }
}

export interface PlanillaModel {
  width: number
  height: number
  groupColW: number
  // Posición/alto real de cada fila — ya no es un ROW_H fijo (las filas crecen según
  // el contenido), así que PlanillaLayer necesita esto para dibujar el zebra-striping
  // en el lugar correcto.
  rowY: number[]
  rowHeights: number[]
  lines: ModelLine[]
  texts: ModelText[]
}

export function buildPlanillaModel(circuitos: Circuito[], tablero: Tablero, layout: ColumnLayout, formato: FormatoFormacion = 'ingles', cargas?: Map<number, CargaCircuito>): PlanillaModel {
  const ROWS = planillaRows(formato)
  const n = circuitos.length
  const { groupColW, labelColW } = layout
  const width = diagramWidth(n, layout)
  const lines: ModelLine[] = []
  const texts: ModelText[] = []

  // Alto de cada fila — mínimo ROW_H_MIN, crece si la etiqueta o algún valor de
  // circuito necesitan más de una línea al ajustarse (word-wrap) al ancho real de su
  // columna.
  const rowHeights = ROWS.map(row => {
    let maxLines = wrappedLines(row.label, TEXT_SIZE_TITULO, labelColW - PAD_X_LABEL * 2, true)
    for (const c of circuitos) {
      const lines = wrappedLines(row.get(c, tablero, cargas?.get(c.id)), TEXT_SIZE_DATO, COL_W - PAD_X_DATO * 2)
      maxLines = Math.max(maxLines, lines)
    }
    return Math.max(ROW_H_MIN, maxLines * TEXT_SIZE_TITULO * LINE_H + PAD_Y * 2)
  })
  const rowY = rowHeights.reduce<number[]>((acc, h, i) => [...acc, i === 0 ? 0 : acc[i - 1] + rowHeights[i - 1]], [])
  const height = rowY[rowY.length - 1] + rowHeights[rowHeights.length - 1]

  ROWS.forEach((row, ri) => {
    const y = rowY[ri]
    texts.push({ x: groupColW + PAD_X_LABEL, y: y + PAD_Y, width: labelColW - PAD_X_LABEL * 2, text: row.label, size: TEXT_SIZE_TITULO, bold: true })
    circuitos.forEach((c, ci) => {
      texts.push({
        x: groupColW + labelColW + ci * COL_W + PAD_X_DATO, y: y + PAD_Y,
        width: COL_W - PAD_X_DATO * 2, align: 'center', text: row.get(c, tablero, cargas?.get(c.id)), size: TEXT_SIZE_DATO,
      })
    })
  })

  // Tag del tablero, rotado, ocupando toda la columna de grupo como una sola celda.
  texts.push({
    x: groupColW / 2 + 5, y: height - 4, width: height - 8, align: 'center',
    text: tablero.tag, size: TEXT_SIZE_TITULO, bold: true, rotation: -90,
  })

  // Grilla — las horizontales arrancan después de la columna de grupo para que esa
  // columna se vea como una sola celda fusionada, sin líneas internas.
  for (const y of [...rowY, height]) {
    lines.push({ x1: groupColW, y1: y, x2: width, y2: y, weight: LINE_WEIGHT_DATO })
  }
  for (let i = 0; i <= n; i++) {
    const x = groupColW + labelColW + i * COL_W
    lines.push({ x1: x, y1: 0, x2: x, y2: height, weight: LINE_WEIGHT_DATO })
  }
  lines.push({ x1: groupColW, y1: 0, x2: groupColW, y2: height, weight: LINE_WEIGHT_DATO })

  // Borde exterior — role:'titulo' porque ya no alcanza con el grosor para distinguirlo
  // de la grilla (ver PlanillaLayer.tsx, que usa esto para elegir el color).
  lines.push({ x1: 0, y1: 0, x2: width, y2: 0, weight: LINE_WEIGHT_TITULO, role: 'titulo' })
  lines.push({ x1: width, y1: 0, x2: width, y2: height, weight: LINE_WEIGHT_TITULO, role: 'titulo' })
  lines.push({ x1: width, y1: height, x2: 0, y2: height, weight: LINE_WEIGHT_TITULO, role: 'titulo' })
  lines.push({ x1: 0, y1: height, x2: 0, y2: 0, weight: LINE_WEIGHT_TITULO, role: 'titulo' })

  return { width, height, groupColW, rowY, rowHeights, lines, texts }
}
