// Modelo geométrico del unifilar — separa "qué hay que dibujar" (coordenadas, en el
// mismo sistema de unidades que los símbolos reales: 1 unidad = 1 mm, ver
// CadSymbol.tsx) de "cómo se dibuja" (Konva en UnifilarCanvas.tsx, AutoLISP en
// _export.ts). Cualquiera de los dos renderers recorre exactamente esta misma
// estructura, así no hay dos copias de la aritmética de posiciones que puedan
// desincronizarse entre lo que se ve en pantalla y lo que se exporta a AutoCAD.
import type { Circuito, Proteccion } from '@/context/types'
import { columnX, diagramWidth, type ColumnLayout } from './_layout'
import { CABLE_MARK_BY_POLES, CABLE_GND, BORNE, ITM, CARTEL_RIESGO_ELECTRICO, type SymbolDef } from './_symbols'

// Entrada (acometida) — todavía con geometría "a ojo", pendiente de acotar con el
// mismo criterio que los circuitos terminales (ver abajo).
export const ENTRY_TOP_Y = 10
export const ENTRY_TICK_Y = 28
export const ENTRY_BREAKER_CENTER_Y = 64
export const BUS_Y = 108

// Placeholder para cualquier símbolo del que todavía no tenemos el bloque real
// digitalizado (ver _symbols.ts) — un rectángulo celeste simple, para no bloquear el
// dibujo mientras se consigue el SVG real (ej. el seccionador de entrada, o una
// cantidad de polos sin marca de cable todavía en CABLE_MARK_BY_POLES).
export const MISSING_SYMBOL_W = 4
export const MISSING_SYMBOL_H = 12

export function missingSymbolRect(cx: number, cy: number): ModelRect {
  return { x: cx - MISSING_SYMBOL_W / 2, y: cy - MISSING_SYMBOL_H / 2, w: MISSING_SYMBOL_W, h: MISSING_SYMBOL_H }
}

// Circuitos terminales — cotas reales en mm provistas por el usuario, medidas desde
// O = tope de la protección:
//   barra -> O:                    15 mm (LINEA_PRINCIPAL)
//   alto de la protección:         12 mm (PROTECCION_H)
//   O -> marca de cantidad de cables: 15 mm
//   O -> barra de tierra:          30 mm
//   barra de tierra -> cable de tierra: 5 mm  (o sea, 35 mm desde O)
//   O -> bornera:                  40 mm (una en la línea principal, blanca, y otra
//                                  en la derivación de tierra, verde — mismo bloque)
//   O -> fin del tramo:            50 mm (deja 10 mm de margen después de la bornera)
export const LINEA_PRINCIPAL = 10
export const PROTECCION_H = 12
export const DIST_MARCA_CABLE = 20
export const DIST_BARRA_TIERRA = 30
export const DIST_CABLE_TIERRA = DIST_BARRA_TIERRA + 5
export const DIST_BORNERA = 40
export const LARGO_TRAMO = 50
// La derivación de tierra es un conductor propio, no la misma línea recoloreada —
// sale de la barra de tierra corrida a un costado (sin cota real todavía, valor a ojo).
export const DERIVACION_TIERRA_OFFSET = 5

export const CANVAS_H = 230

// Separación vertical entre el unifilar y la planilla — comparten el mismo canvas
// (ver UnifilarCanvas.tsx) y el mismo .lsp (ver _export.ts), así que este número
// vive en un solo lugar para que los dos usen exactamente el mismo offset.
export const GAP_UNIFILAR_PLANILLA = 10

// Tamaño de texto normalizado para todo lo que es dibujo del unifilar (no la
// planilla, que tiene el suyo propio — ver TEXT_SIZE_TITULO/DATO en _planilla.ts).
export const TEXT_SIZE_UNIFILAR = 1.8
// Mismo criterio para el grosor de línea — un solo valor para todo el unifilar (bus,
// bajadas, caja de protección, tierra) en vez de números sueltos por elemento.
export const LINE_WEIGHT_UNIFILAR = 0.25

type Formacion = NonNullable<Circuito['formacion']>

// Mismo mapeo que INTERRUPTOR_ABBR de _planilla.ts, duplicado acá (no se importa de
// ahí) porque _planilla.ts ya importa tipos de este archivo — importar en el otro
// sentido formaría un ciclo.
const INTERRUPTOR_ABBR: Record<string, string> = {
  termomagnetico: 'ITM',
  caja_moldeada:  'ITM',
  diferencial:    'ID',
  guardamotor:    'GM',
}

export function proteccionRating(p: Proteccion | null): string {
  if (!p) return 'sin protección'
  return [
    p.polos != null ? `${p.polos}P` : null,
    p.In != null ? `${p.In}A` : null,
    p.curva ? `curva ${p.curva}` : null,
  ].filter(Boolean).join(' ') || 'sin datos'
}

// Cantidad de conductores de la formación (fases + neutro si es un cable propio) —
// determina qué bloque de marca de cable corresponde (CABLE_MARK_BY_POLES).
export function poleCount(f: Formacion): number {
  return f.Nfases * f.cond_por_fase + (f.cable_neutro && f.Nneutro > 0 ? f.Nneutro : 0)
}

// Igual criterio que "SECC. CABLE" de la planilla — cantidad de conductores x sección,
// más la sección de PE si tiene tierra propia.
export function formacionResumen(f: Formacion): string {
  const base = `${poleCount(f)}x${f.cable.seccion_f}${f.cable.calibre_tipo}`
  return f.cable_tierra ? `${base} + PE ${f.cable_tierra.seccion_f}${f.cable_tierra.calibre_tipo}` : base
}

// `role` marca elementos que van en verde (todo lo referido a tierra) — es semántico,
// no un color: el color hex lo decide el renderer (UnifilarCanvas), no este modelo.
// 'titulo' es lo mismo pero para la planilla (ver _planilla.ts): distingue el borde
// exterior/cabecera de la grilla de datos, ya que el grosor dejó de servir para eso.
// 'limite' es el recuadro que marca el límite físico del tablero (gabinete) — celeste,
// no confundir con los rects celestes de missingSymbolRect (esos son placeholders de
// bloque faltante, este es un elemento real y permanente del dibujo).
export type ModelLine = { x1: number; y1: number; x2: number; y2: number; weight: number; role?: 'tierra' | 'titulo' | 'limite' }
export type ModelRect = { x: number; y: number; w: number; h: number }
export type ModelDot = { x: number; y: number; r: number; role?: 'tierra' }
export type ModelText = { x: number; y: number; text: string; size: number; bold?: boolean; align?: 'left' | 'center' | 'right'; width?: number; rotation?: number; role?: 'tierra' | 'peligro' }
// `esConductor` distingue símbolos que representan al conductor mismo (bornera: sigue
// el mismo blanco/verde que las líneas) de los que son solo una marca informativa
// sobre el conductor (cantidad de cables: siempre celeste, no cambia con `role`).
// 'peligro' es color fijo (amarillo/negro de cartel de seguridad, ver CARTEL_
// RIESGO_ELECTRICO) — no sigue la lógica celeste/blanco de esConductor.
export type ModelSymbol = { x: number; y: number; def: SymbolDef; role?: 'tierra' | 'peligro'; esConductor?: boolean }

export interface UnifilarModel {
  width: number
  height: number
  lines: ModelLine[]
  rects: ModelRect[]
  dots: ModelDot[]
  texts: ModelText[]
  symbols: ModelSymbol[]
}

export function buildUnifilarModel(circuitos: Circuito[], entrada: Circuito | null, layout: ColumnLayout): UnifilarModel {
  const n = circuitos.length
  const width = diagramWidth(n, layout)
  const lines: ModelLine[] = []
  const rects: ModelRect[] = []
  const dots: ModelDot[] = []
  const texts: ModelText[] = []
  const symbols: ModelSymbol[] = []

  if (n === 0) return { width, height: CANVAS_H, lines, rects, dots, texts, symbols }

  const busX1 = columnX(0, layout)
  const busX2 = columnX(Math.max(n - 1, 0), layout)
  const entryX = (busX1 + busX2) / 2

  // Dos barras separadas, igual que en el plano real: la de potencia (arriba, de
  // donde cuelgan las protecciones de los circuitos) y la de tierra (más abajo, a la
  // que se conecta el PE de cada circuito) — no son la misma línea.
  const O = BUS_Y + LINEA_PRINCIPAL // tope de la protección, igual para todos los circuitos terminales
  const yBarraTierra = O + DIST_BARRA_TIERRA

  lines.push({ x1: busX1, y1: BUS_Y, x2: busX2, y2: BUS_Y, weight: LINE_WEIGHT_UNIFILAR })
  lines.push({ x1: busX1+DERIVACION_TIERRA_OFFSET, y1: yBarraTierra, x2: busX2+DERIVACION_TIERRA_OFFSET, y2: yBarraTierra, weight: LINE_WEIGHT_UNIFILAR, role: 'tierra' })

  if (entrada) {
    const entradaProteccion = entrada.proteccion ?? null
    const entradaFormacion = entrada.formacion ?? null
    const entryLineBottom = entradaProteccion ? ENTRY_BREAKER_CENTER_Y - MISSING_SYMBOL_H / 2 : BUS_Y

    lines.push({ x1: entryX, y1: ENTRY_TOP_Y, x2: entryX, y2: entryLineBottom, weight: LINE_WEIGHT_UNIFILAR })

    if (entradaProteccion) {
      lines.push({ x1: entryX, y1: ENTRY_BREAKER_CENTER_Y + MISSING_SYMBOL_H / 2, x2: entryX, y2: BUS_Y, weight: LINE_WEIGHT_UNIFILAR })
      // Seccionador de entrada: todavía no tenemos ese bloque real digitalizado (ver
      // MISSING_SYMBOL_W/H arriba) — placeholder celeste en vez de la caja+diagonal
      // dibujada a mano de antes.
      rects.push(missingSymbolRect(entryX, ENTRY_BREAKER_CENTER_Y))
      texts.push({ x: entryX + 14, y: ENTRY_BREAKER_CENTER_Y - 6, text: proteccionRating(entradaProteccion), size: TEXT_SIZE_UNIFILAR })
    }

    if (entradaFormacion) {
      const def = CABLE_MARK_BY_POLES[poleCount(entradaFormacion)]
      if (def) symbols.push({ x: entryX, y: ENTRY_TICK_Y, def })
      else rects.push(missingSymbolRect(entryX, ENTRY_TICK_Y))
      texts.push({ x: entryX + 10, y: ENTRY_TICK_Y - 6, text: formacionResumen(entradaFormacion), size: TEXT_SIZE_UNIFILAR })
    }

    texts.push({ x: entryX - 96, y: ENTRY_TOP_Y - 1, width: 88, align: 'right', text: entrada.circuito, size: TEXT_SIZE_UNIFILAR, bold: true })
  }

  const yMarcaCable = O + DIST_MARCA_CABLE
  const yCableTierra = O + DIST_CABLE_TIERRA
  const yBornera = O + DIST_BORNERA
  const yFinTramo = O + LARGO_TRAMO

  circuitos.forEach((c, i) => {
    const x = columnX(i, layout)
    const cableTierra = c.formacion?.cable_tierra ?? null

    // Línea principal: de la barra de potencia al fin del tramo, siempre derecho —
    // el conductor de tierra es un conductor aparte, no una continuación de esta línea.
    //dots.push({ x, y: BUS_Y, r: 3 })
    lines.push({ x1: x, y1: BUS_Y, x2: x, y2: O, weight: LINE_WEIGHT_UNIFILAR })
    // ITM: bloque real, se inserta por su extremo superior (ver insertX/insertY en
    // _symbols.ts) — por eso va en y=O, no en el centro de la caja como antes. Celeste
    // (no esConductor): es una marca informativa del dispositivo, no el conductor.
    symbols.push({ x, y: O, def: ITM })
    lines.push({ x1: x, y1: O + PROTECCION_H, x2: x, y2: yFinTramo, weight: LINE_WEIGHT_UNIFILAR })

    // 4 líneas de datos a la derecha del bloque, mismo criterio que el plano de
    // referencia: tag, polos+In, curva+Icu, norma — cada una si hay dato para mostrar.
    const p = c.proteccion
    const abbr = p ? (INTERRUPTOR_ABBR[p.familia?.tipo ?? ''] ?? '') : ''
    const lineas = [
      [abbr, c.circuito].filter(Boolean).join(' '),
      p ? [p.polos != null ? `${p.polos}P` : null, p.In != null ? `${p.In}A` : null].filter(Boolean).join(' ') : '',
      p ? [p.curva ? `"${p.curva}"` : null, p.Icu != null ? `${p.Icu}kA` : null].filter(Boolean).join(' ') : '',
      p?.familia?.norma ?? '',
    ]
    lineas.forEach((texto, li) => {
      if (texto) texts.push({ x: x + 4, y: O + 1 + li * 2.2, text: texto, size: TEXT_SIZE_UNIFILAR })
    })

    if (c.formacion) {
      const def = CABLE_MARK_BY_POLES[poleCount(c.formacion)]
      if (def) symbols.push({ x, y: yMarcaCable, def })
      else rects.push(missingSymbolRect(x, yMarcaCable))
    }

    // Bornera de potencia — blanca, siempre (todo circuito termina en una). Es
    // "conductor" (blanco/verde), no una marca informativa (celeste).
    symbols.push({ x, y: yBornera, def: BORNE, esConductor: true })

    // Derivación de tierra: conductor propio en paralelo a la línea principal, corrido
    // a un costado — solo si el circuito tiene conductor de tierra propio. Del lado
    // derecho de x, como en el original. Nace directo de la barra de tierra (que ya
    // pasa por xTierra) — sin salto horizontal hasta x: tocaba la línea de fase y se
    // veía como un cortocircuito entre fase y tierra.
    if (cableTierra) {
      const xTierra = x + DERIVACION_TIERRA_OFFSET
      lines.push({ x1: xTierra, y1: yBarraTierra, x2: xTierra, y2: yFinTramo, weight: LINE_WEIGHT_UNIFILAR, role: 'tierra' })
      symbols.push({ x: xTierra, y: yCableTierra, def: CABLE_GND, role: 'tierra' })
      // El centro del texto alineado con el centro del símbolo (y == yCableTierra sería
      // el borde superior del texto, no el centro — se corrige restando medio alto de línea).
      texts.push({ x: xTierra + 4, y: yCableTierra - TEXT_SIZE_UNIFILAR / 2, text: `PE ${cableTierra.nombre}`, size: TEXT_SIZE_UNIFILAR, role: 'tierra' })
      // Bornera de tierra — verde, misma marca que la de potencia, sobre la barra de
      // tierra (misma altura que esa línea horizontal, no la de la bornera de potencia).
      symbols.push({ x: xTierra, y: yBarraTierra, def: BORNE, role: 'tierra', esConductor: true })
    }
  })

  // Recuadro celeste que marca el límite físico del tablero (gabinete) — envuelve todo
  // el contenido dibujado (entrada + circuitos) con un margen fijo. No es lo mismo que
  // missingSymbolRect: ese es un placeholder de bloque faltante, este es un elemento
  // real y permanente del plano.
  const LIMITE_MARGIN = 8
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const consider = (px: number, py: number) => {
    minX = Math.min(minX, px); maxX = Math.max(maxX, px)
    minY = Math.min(minY, py); maxY = Math.max(maxY, py)
  }
  for (const l of lines) { consider(l.x1, l.y1); consider(l.x2, l.y2) }
  for (const s of symbols) consider(s.x, s.y)
  for (const d of dots) consider(d.x, d.y)
  for (const r of rects) { consider(r.x, r.y); consider(r.x + r.w, r.y + r.h) }
  // El título de la entrada se extiende a la izquierda del resto del contenido.
  if (entrada) consider(entryX - 96, ENTRY_TOP_Y)

  const limX1 = minX - LIMITE_MARGIN, limY1 = minY + 5
  const limX2 = maxX + LIMITE_MARGIN, limY2 = maxY - 5
  lines.push({ x1: limX1, y1: limY1, x2: limX2, y2: limY1, weight: LINE_WEIGHT_UNIFILAR, role: 'limite' })
  lines.push({ x1: limX2, y1: limY1, x2: limX2, y2: limY2, weight: LINE_WEIGHT_UNIFILAR, role: 'limite' })
  lines.push({ x1: limX2, y1: limY2, x2: limX1, y2: limY2, weight: LINE_WEIGHT_UNIFILAR, role: 'limite' })
  lines.push({ x1: limX1, y1: limY2, x2: limX1, y2: limY1, weight: LINE_WEIGHT_UNIFILAR, role: 'limite' })

  // Cartel de riesgo eléctrico, esquina inferior izquierda del tablero — se ancla por
  // su propia esquina inferior izquierda (insertX/insertY, ver _symbols.ts) directo
  // contra la esquina del recuadro límite, con el mismo margen.
  const cartelX = limX1 + LIMITE_MARGIN
  const cartelY = limY2 - LIMITE_MARGIN
  symbols.push({ x: cartelX, y: cartelY, def: CARTEL_RIESGO_ELECTRICO, role: 'peligro' })

  // Texto dentro del recuadro inferior de la placa (ver inner box en
  // CARTEL_RIESGO_ELECTRICO, local x:1.27-26.69 y:25.65-36.89 dentro del símbolo) — se
  // convierte a coordenadas de mundo restando insertY (38.26, ver _symbols.ts) igual
  // que hace CadSymbol internamente.
  const cartelTextoX = cartelX + 1.27
  const cartelTextoW = 26.69 - 1.27
  texts.push({ x: cartelTextoX, y: cartelY + 27.0 - 38.26, text: 'ATENCION', size: 3.2, bold: true, align: 'center', width: cartelTextoW, role: 'peligro' })
  texts.push({ x: cartelTextoX, y: cartelY + 31.2 - 38.26, text: 'RIESGO DE', size: 1.8, align: 'center', width: cartelTextoW, role: 'peligro' })
  texts.push({ x: cartelTextoX, y: cartelY + 33.4 - 38.26, text: 'CHOQUE ELECTRICO', size: 1.8, align: 'center', width: cartelTextoW, role: 'peligro' })

  // Alto real del contenido (no CANVAS_H, que es mucho más alto que yFinTramo y dejaba
  // un colchón de ~57mm de aire antes de la tabla, además del GAP_UNIFILAR_PLANILLA).
  return { width, height: yFinTramo, lines, rects, dots, texts, symbols }
}
