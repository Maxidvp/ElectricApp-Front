// Modelo geométrico del unifilar — separa "qué hay que dibujar" (coordenadas, en el
// mismo sistema de unidades que los símbolos reales: 1 unidad = 1 mm, ver
// CadSymbol.tsx) de "cómo se dibuja" (Konva en UnifilarCanvas.tsx, AutoLISP en
// _export.ts). Cualquiera de los dos renderers recorre exactamente esta misma
// estructura, así no hay dos copias de la aritmética de posiciones que puedan
// desincronizarse entre lo que se ve en pantalla y lo que se exporta a AutoCAD.
import type { Circuito, Proteccion } from '@/context/types'
import { columnX, diagramWidth, type ColumnLayout } from './_layout'
import { textWidth, wrappedLines } from './_measure'
import { CABLE_MARK_BY_POLES, CABLE_GND, BORNE, ID, CARTEL_RIESGO_ELECTRICO, simboloDeProteccion, type SymbolDef } from './_symbols'

// ─────────────────────────────────────────────────────────────────────────
// Cotas del dibujo — todas las distancias y márgenes agrupadas por eje (X/Y), en el
// orden en que se usan de arriba a abajo / de izquierda a derecha, para poder
// ajustarlas de un vistazo en vez de rastrearlas dispersas por el archivo. "a ojo" en
// un comentario = todavía no sale de una medida real, es un valor visual pendiente de
// contrastar contra un plano acotado. Las cotas internas del cartel de riesgo
// eléctrico (dónde va el texto DENTRO de su propio recuadro) no están acá — esas
// dependen de la geometría fija del símbolo (ver CARTEL_RIESGO_ELECTRICO en
// _symbols.ts), no son márgenes entre elementos del dibujo.
// ─────────────────────────────────────────────────────────────────────────

export const TEXT_SIZE_UNIFILAR = 1.8    // tamaño de texto normalizado para todo el unifilar
export const LINE_WEIGHT_UNIFILAR = 0.25 // grosor de línea normalizado para todo el unifilar

// ── Eje Y (vertical, de arriba hacia abajo) ────────────────────────────────
export const ENTRY_TOP_Y = 10                     // tope del dibujo -> arranque de la entrada (a ojo)
export const ENTRY_TICK_Y = 28                    // entrada -> marca de cantidad de cables (a ojo)
export const ENTRY_TITULO_OFFSET_Y = -1           // título de la entrada, respecto a ENTRY_TOP_Y
export const ENTRY_FORMACION_TEXTO_OFFSET_Y = -6  // texto de formación, respecto a ENTRY_TICK_Y
export const ENTRY_BREAKER_CENTER_Y = 64          // entrada -> centro del seccionador (a ojo)
export const ENTRY_PROTECCION_TEXTO_OFFSET_Y = -6 // texto de protección, respecto a ENTRY_BREAKER_CENTER_Y
export const BUS_Y = 108                          // entrada -> barra de potencia (a ojo)

// Circuitos terminales — cotas reales en mm provistas por el usuario, medidas desde
// O = tope de la protección de cada circuito:
//   barra -> O:                    10 mm (LINEA_PRINCIPAL)
//   alto de la protección:         12 mm (PROTECCION_H)
//   O -> marca de cantidad de cables: 20 mm
//   O -> barra de tierra:          30 mm
//   barra de tierra -> cable de tierra: 5 mm  (o sea, 35 mm desde O)
//   O -> bornera:                  40 mm (una en la línea principal, blanca, y otra
//                                  en la derivación de tierra, verde — mismo bloque)
//   O -> fin del tramo:            50 mm (deja 10 mm de margen después de la bornera)
export const LINEA_PRINCIPAL = 10        // barra -> O
export const PROTECCION_H = 12           // alto de la protección (ITM)
export const MISSING_SYMBOL_H = 12       // alto del placeholder de un símbolo sin bloque real
export const DATOS_CIRCUITO_OFFSET_Y = 1 // primera línea del bloque de datos, respecto a O
export const DATOS_CIRCUITO_LINE_H = 2.2 // alto de línea entre esos datos
export const DIST_MARCA_CABLE = 20       // O -> marca de cantidad de cables
export const DIST_BARRA_TIERRA = 30      // O -> barra de tierra
export const DIST_CABLE_TIERRA = DIST_BARRA_TIERRA + 5 // O -> marca del cable de tierra (35)
export const DIST_BORNERA = 40           // O -> bornera (potencia y tierra)
export const LARGO_TRAMO = 50            // O -> fin del tramo (deja 10mm de margen tras la bornera)

// Grupos diferenciales (ver GrupoDiferencial en context/types.ts): un ID compartido
// entre varios circuitos consecutivos, colgado de un peine de conexión — mismo criterio
// que un plano real (barra -> ID -> peine -> ITM de cada circuito).
export const DIST_PEINE_GRUPO = 20 // barra -> peine de un grupo diferencial (a ojo)
// Cuando el tablero tiene al menos un grupo, O se corre para TODOS los circuitos (con
// o sin grupo) para dejarle lugar al peine + ID — si no, el símbolo del ID (mismo alto
// que MISSING_SYMBOL_H) no entraría en los 10mm de LINEA_PRINCIPAL.
export const EXTRA_LINEA_CON_GRUPO = DIST_PEINE_GRUPO + 5 // (25)

// Recuadro límite del tablero y cartel de riesgo eléctrico.
export const LIMITE_INSET_TOP = 5    // cuánto entra el borde superior del recuadro (a ojo)
export const LIMITE_INSET_BOTTOM = 5 // cuánto entra el borde inferior del recuadro (a ojo)
export const CARTEL_ALTURA = 38.26   // alto de CARTEL_RIESGO_ELECTRICO, ver _symbols.ts
export const CARTEL_OFFSET_Y = 10    // cuánto sube el cartel desde el fin del contenido (maxY)

export const GAP_UNIFILAR_PLANILLA = 10 // unifilar -> planilla (mismo canvas, ver UnifilarCanvas.tsx y _export.ts)
export const CANVAS_H = 230              // alto de respaldo si el tablero no tiene circuitos

// ── Eje X (horizontal, de izquierda a derecha) ─────────────────────────────
export const ENTRY_TITULO_OFFSET_X = 96           // título de la entrada, a la izquierda de la entrada (a ojo)
export const ENTRY_TITULO_W = 88                  // ancho del texto de título de la entrada (a ojo)
export const ENTRY_FORMACION_TEXTO_OFFSET_X = 10  // texto de formación, a la derecha de la entrada
export const ENTRY_PROTECCION_TEXTO_OFFSET_X = 14 // texto de protección, a la derecha de la entrada

export const LIMITE_MARGIN = 8                // recuadro límite -> contenido, lados izquierdo/derecho (a ojo)
export const LIMITE_MARGIN_DERECHA_EXTRA = 20 // margen extra del lado derecho del recuadro (a ojo)

export const MISSING_SYMBOL_W = 4         // ancho del placeholder de un símbolo sin bloque real
export const DERIVACION_TIERRA_OFFSET = 5 // circuito -> su bajada de tierra (a ojo)
export const SIMBOLO_TEXTO_OFFSET_X = 4   // texto de un símbolo -> cuánto se corre a su derecha
                                           // (bloque de datos del circuito, texto de PE)
export const GRUPO_TEXTO_OFFSET_X = 2     // texto del grupo diferencial, además de medio ancho del ID

export const CARTEL_ANCHO = 27.82 // ancho de CARTEL_RIESGO_ELECTRICO, ver _symbols.ts
export const CARTEL_MARGIN = 6    // cartel / bloque de datos -> cualquier otro elemento, separación mínima

// Placeholder para cualquier símbolo del que todavía no tenemos el bloque real
// digitalizado (ver _symbols.ts) — un rectángulo celeste simple, para no bloquear el
// dibujo mientras se consigue el SVG real (ej. el seccionador de entrada, o una
// cantidad de polos sin marca de cable todavía en CABLE_MARK_BY_POLES).
export function missingSymbolRect(cx: number, cy: number): ModelRect {
  return { x: cx - MISSING_SYMBOL_W / 2, y: cy - MISSING_SYMBOL_H / 2, w: MISSING_SYMBOL_W, h: MISSING_SYMBOL_H }
}

type Formacion = NonNullable<Circuito['formacion']>

// Mismo mapeo que INTERRUPTOR_ABBR de _planilla.ts, duplicado acá (no se importa de
// ahí) porque _planilla.ts ya importa tipos de este archivo — importar en el otro
// sentido formaría un ciclo. Sí se exporta para el resto del módulo (ej.
// DiferencialesModal.tsx, que lo usa para el tagueo automático por tipo de protección).
export const INTERRUPTOR_ABBR: Record<string, string> = {
  termomagnetico: 'ITM',
  caja_moldeada:  'ITM',
  diferencial:    'ID',
  guardamotor:    'GM',
  seccionador:    'IS',
}

// Líneas de datos de un aparato, como las pide el esquema tipo de CTM-003: tag, polos y
// corriente, curva y poder de corte (o sensibilidad y clase en un diferencial), norma.
// En un guardamotor la corriente es su rango de regulación.
export function lineasDeProteccion(tag: string, p: Proteccion | null | undefined): string[] {
  if (!p) return [tag, 'SIN PROTECCIÓN', '', '']
  const tipo = p.familia?.tipo
  const corriente = tipo === 'guardamotor'
    ? (p.rango_regulacion_min != null && p.rango_regulacion_max != null ? `${p.rango_regulacion_min}-${p.rango_regulacion_max}A` : null)
    : (p.In != null ? `${p.In}A` : null)
  return [
    tag,
    [p.polos != null ? `${p.polos}P` : null, corriente].filter(Boolean).join(' '),
    (tipo === 'diferencial'
      ? [p.sensibilidad_mA != null ? `${p.sensibilidad_mA}mA` : null, p.clase_diferencial ?? null]
      : [p.curva ? `"${p.curva}"` : null, p.Icu != null ? `${p.Icu}kA` : null]).filter(Boolean).join(' '),
    p.familia?.norma ?? '',
  ]
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
// Cuenta fases + neutro, no los conductores en paralelo por fase (eso va en el texto de
// la formación). El neutro se cuenta aunque no tenga un cable propio elegido: en ese
// caso usa el mismo que las fases (mismo criterio que generarFormacionCopaipa). Antes
// se contaba solo con cable de neutro propio y un monofásico F+N daba 1 conductor.
// En un cable multipolar los conductores son los del propio cable.
export function poleCount(f: Formacion): number {
  if ((f.cable.Nfases ?? 1) > 1) return (f.cable.Nfases ?? 1) + (f.cable.Nneutro ?? 0)
  return f.Nfases + (f.Nneutro > 0 ? 1 : 0)
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

// Una acometida del tablero para el dibujo. `hasta` = cuántos circuitos terminales
// tiene arriba en el orden del tablero (los que alimenta, ver CLAUDE.md: una acometida
// alimenta todo lo que tiene arriba).
// `desde`: de dónde viene ("TP-GENERAL", "RED"…), para el encabezado de la entrada.
export type EntradaUnifilar = { circuito: Circuito; hasta: number; desde?: string }

// Acometidas y circuitos terminales de un tablero, listos para buildUnifilarModel.
export function separarEntradas(principales: Circuito[]): { entradas: EntradaUnifilar[]; circuitos: Circuito[] } {
  const entradas: EntradaUnifilar[] = []
  const circuitos: Circuito[] = []
  for (const c of principales) {
    if (c.es_acometida) entradas.push({ circuito: c, hasta: circuitos.length })
    else circuitos.push(c)
  }
  return { entradas, circuitos }
}

type Barra = { ini: number; fin: number; entradas: EntradaUnifilar[] }   // columnas [ini, fin)

// Con una sola acometida hay una barra con todos los circuitos, como siempre. Con dos
// o más, el tablero se dibuja con una barra por tramo (criterio del usuario: sistema de
// dos barras): cada acometida entra a la barra de los circuitos que quedan entre la
// acometida anterior y ella, y las barras contiguas se unen con un acoplamiento. Así la
// de emergencia entra a la barra de cargas esenciales y la principal a la de las no
// esenciales, y con el acoplamiento cerrado la principal alimenta todo.
function armarBarras(n: number, entradas: EntradaUnifilar[]): Barra[] {
  const ents = [...entradas].sort((a, b) => a.hasta - b.hasta)
  if (ents.length <= 1) return [{ ini: 0, fin: n, entradas: ents }]
  // La última es la principal: su barra llega hasta el final, aunque queden circuitos debajo de ella.
  const fines = ents.map((e, i) => i === ents.length - 1 ? n : Math.min(Math.max(e.hasta, 0), n))
  const cortes = [...new Set(fines.filter(f => f > 0 && f < n))].sort((a, b) => a - b)
  const barras: Barra[] = [...cortes, n].map((fin, i, arr) => ({ ini: i === 0 ? 0 : arr[i - 1], fin, entradas: [] }))
  ents.forEach((e, i) => {
    // Una acometida sin circuitos propios en su tramo comparte la barra más cercana.
    const barra = barras.find(b => b.fin === fines[i]) ?? barras.find(b => b.fin > fines[i]) ?? barras[barras.length - 1]
    barra.entradas.push(e)
  })
  return barras
}

// Conductores de una formación como los rotula el esquema tipo de CTM-003: L1/L2/L3/N/PE.
export function fasesDeFormacion(f: Formacion): string {
  const partes = Array.from({ length: Math.min(Math.max(f.Nfases, 1), 3) }, (_, i) => `L${i + 1}`)
  const conNeutro = f.Nneutro > 0 || ((f.cable.Nfases ?? 1) > 1 && (f.cable.Nneutro ?? 0) > 0)
  if (conNeutro) partes.push('N')
  if (f.cable_tierra) partes.push('PE')
  return partes.join('/')
}

// Metal / aislación / norma del cable, ej. "Cobre/PVC IRAM 2178".
export function especificacionCable(f: Formacion): string {
  const fam = f.cable.familia
  return [[fam?.material, fam?.aislamiento].filter(Boolean).join('/'), fam?.norma].filter(Boolean).join(' ')
}

// Bloque de datos del tablero (CTM-003 hoja 2), arriba a la izquierda del gabinete.
export type DatosTableroUnifilar = { titulo: string; lineas: string[] }
export const DATOS_TABLERO_TITULO_SIZE = 3
export const DATOS_TABLERO_OFFSET_Y = 10       // tope del dibujo -> título del bloque (a ojo)
export const DATOS_TABLERO_LINE_H = 2.6        // alto de línea del bloque
export const ENTRY_ENCABEZADO_MARGEN = 0.6      // último renglón del encabezado -> borde del gabinete
export const ENTRY_ENCABEZADO_LINE_H = 2.6     // entre el título de la entrada y sus líneas "Desde…" / fases
export const ENTRY_NORMA_OFFSET_Y = 2.4        // norma del cable de entrada, debajo de su formación

export const ENTRADAS_SEPARACION_X = 24   // entre dos acometidas que entran a la misma barra (a ojo)
export const BARRA_UNICA_MEDIO_ANCHO = 8  // media barra cuando tiene un solo circuito (a ojo)
export const ACOPLAMIENTO_W = 12          // largo del placeholder del acoplamiento entre barras
export const ACOPLAMIENTO_TEXTO_OFFSET_Y = -7 // leyenda del acoplamiento, respecto a la barra

// `entradas`: las acometidas del tablero (ver separarEntradas). Si no se pasa, se usa
// `entrada` sola, con todos los circuitos colgando de ella.
// ── Cajas (bounding boxes) ───────────────────────────────────────────────────
// Para ubicar el cartel y el bloque de datos sin que toquen nada hay que saber cuánto
// ocupa de verdad cada elemento: un símbolo ocupa su dibujo (no solo su punto de
// inserción) y un texto su ancho medido.
export type Caja = { x1: number; y1: number; x2: number; y2: number }

function cajaDeSimbolo(sim: ModelSymbol): Caja {
  const d = sim.def
  const ix = d.insertX ?? d.viewBox / 2, iy = d.insertY ?? d.viewBox / 2
  const xs: number[] = [], ys: number[] = []
  for (const l of d.lines) { xs.push(l.x1, l.x2); ys.push(l.y1, l.y2) }
  for (const p of d.dots) { xs.push(p.x - p.r, p.x + p.r); ys.push(p.y - p.r, p.y + p.r) }
  for (const a of d.arcs ?? []) { xs.push(a.cx - a.r, a.cx + a.r); ys.push(a.cy - a.r, a.cy + a.r) }
  if (xs.length === 0) return { x1: sim.x, y1: sim.y, x2: sim.x, y2: sim.y }
  return { x1: sim.x + Math.min(...xs) - ix, y1: sim.y + Math.min(...ys) - iy, x2: sim.x + Math.max(...xs) - ix, y2: sim.y + Math.max(...ys) - iy }
}

const ALTO_RENGLON = 1.2   // alto de un renglón de texto, en tamaños de letra

function cajaDeTexto(t: ModelText): Caja {
  const ancho = textWidth(t.text, t.size, t.bold)
  if (t.width == null) return { x1: t.x, y1: t.y, x2: t.x + ancho, y2: t.y + t.size * ALTO_RENGLON }
  // Con ancho de caja: el texto se alinea adentro, y si no entra pasa a más renglones.
  const renglones = wrappedLines(t.text, t.size, t.width, t.bold)
  const w = Math.min(ancho, t.width)
  const x1 = t.align === 'right' ? t.x + t.width - w : t.align === 'center' ? t.x + (t.width - w) / 2 : t.x
  return { x1, y1: t.y, x2: x1 + w, y2: t.y + renglones * t.size * ALTO_RENGLON }
}

export function cajasDe(m: Pick<UnifilarModel, 'lines' | 'rects' | 'dots' | 'texts' | 'symbols'>): Caja[] {
  return [
    ...m.lines.map(l => ({ x1: Math.min(l.x1, l.x2), y1: Math.min(l.y1, l.y2), x2: Math.max(l.x1, l.x2), y2: Math.max(l.y1, l.y2) })),
    ...m.rects.map(r => ({ x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y + r.h })),
    ...m.dots.map(d => ({ x1: d.x - d.r, y1: d.y - d.r, x2: d.x + d.r, y2: d.y + d.r })),
    ...m.texts.map(cajaDeTexto),
    ...m.symbols.map(cajaDeSimbolo),
  ]
}

export const seTocan = (a: Caja, b: Caja, margen = 0) =>
  a.x1 < b.x2 + margen && b.x1 < a.x2 + margen && a.y1 < b.y2 + margen && b.y1 < a.y2 + margen

// REGLA DE UBICACIÓN de lo que va en la columna izquierda (cartel de riesgo, bloque de
// datos del tablero): la x más a la derecha en la que una caja de `ancho`, entre y1 e
// y2, queda a `margen` o más de todo lo que cruza esa franja. Nunca "a ojo": sale de
// las cajas reales de lo ya dibujado, así que vale para cualquier cantidad de
// circuitos, acometidas, grupos diferenciales o largo de textos.
function xLibreALaIzquierda(cajas: Caja[], y1: number, y2: number, ancho: number, margen: number, respaldo: number): number {
  const enLaFranja = cajas.filter(c => c.y2 > y1 - margen && c.y1 < y2 + margen)
  const limite = enLaFranja.length ? Math.min(...enLaFranja.map(c => c.x1)) : respaldo
  return limite - margen - ancho
}

export function buildUnifilarModel(circuitos: Circuito[], entrada: Circuito | null, layout: ColumnLayout, entradas?: EntradaUnifilar[], datosTablero?: DatosTableroUnifilar): UnifilarModel {
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

  // Barras separadas, igual que en el plano real: la(s) de potencia (arriba, de donde
  // cuelgan las protecciones de los circuitos) y la de tierra (más abajo, a la que se
  // conecta el PE de cada circuito) — no son la misma línea.
  const hayGrupos = circuitos.some(c => c.grupo_diferencial_id != null)
  const O = BUS_Y + LINEA_PRINCIPAL + (hayGrupos ? EXTRA_LINEA_CON_GRUPO : 0) // tope de la protección, igual para todos los circuitos terminales
  const yBarraTierra = O + DIST_BARRA_TIERRA
  const yPeine = BUS_Y + DIST_PEINE_GRUPO

  lines.push({ x1: busX1+DERIVACION_TIERRA_OFFSET, y1: yBarraTierra, x2: busX2+DERIVACION_TIERRA_OFFSET, y2: yBarraTierra, weight: LINE_WEIGHT_UNIFILAR, role: 'tierra' })

  const barras = armarBarras(n, entradas ?? (entrada ? [{ circuito: entrada, hasta: n }] : []))

  barras.forEach((barra, bi) => {
    const xIni = columnX(barra.ini, layout)
    const xFin = columnX(barra.fin - 1, layout)
    const unica = barras.length > 1 && xIni === xFin
    const bx1 = unica ? xIni - BARRA_UNICA_MEDIO_ANCHO : xIni
    const bx2 = unica ? xFin + BARRA_UNICA_MEDIO_ANCHO : xFin
    lines.push({ x1: bx1, y1: BUS_Y, x2: bx2, y2: BUS_Y, weight: LINE_WEIGHT_UNIFILAR })

    // Acoplamiento con la barra siguiente. El aparato no está cargado en el proyecto
    // (no hay dónde indicarlo todavía): va el placeholder celeste, con su leyenda.
    if (bi < barras.length - 1) {
      const sig = barras[bi + 1]
      const sx1 = columnX(sig.ini, layout) - (columnX(sig.ini, layout) === columnX(sig.fin - 1, layout) ? BARRA_UNICA_MEDIO_ANCHO : 0)
      const xm = (bx2 + sx1) / 2
      lines.push({ x1: bx2, y1: BUS_Y, x2: xm - ACOPLAMIENTO_W / 2, y2: BUS_Y, weight: LINE_WEIGHT_UNIFILAR })
      lines.push({ x1: xm + ACOPLAMIENTO_W / 2, y1: BUS_Y, x2: sx1, y2: BUS_Y, weight: LINE_WEIGHT_UNIFILAR })
      rects.push({ x: xm - ACOPLAMIENTO_W / 2, y: BUS_Y - MISSING_SYMBOL_W / 2, w: ACOPLAMIENTO_W, h: MISSING_SYMBOL_W })
      texts.push({ x: xm - 15, y: BUS_Y + ACOPLAMIENTO_TEXTO_OFFSET_Y, width: 30, align: 'center', text: 'ACOPLAMIENTO', size: TEXT_SIZE_UNIFILAR })
    }

    const centro = (xIni + xFin) / 2
    barra.entradas.forEach((entradaU, ei) => {
      const ent = entradaU.circuito
      const entryX = centro + (ei - (barra.entradas.length - 1) / 2) * ENTRADAS_SEPARACION_X
      const entradaProteccion = ent.proteccion ?? null
      const entradaFormacion = ent.formacion ?? null
      const entryLineBottom = entradaProteccion ? ENTRY_BREAKER_CENTER_Y - MISSING_SYMBOL_H / 2 : BUS_Y

      lines.push({ x1: entryX, y1: ENTRY_TOP_Y, x2: entryX, y2: entryLineBottom, weight: LINE_WEIGHT_UNIFILAR })

      if (entradaProteccion) {
        lines.push({ x1: entryX, y1: ENTRY_BREAKER_CENTER_Y + MISSING_SYMBOL_H / 2, x2: entryX, y2: BUS_Y, weight: LINE_WEIGHT_UNIFILAR })
        // Protección de entrada: el símbolo que corresponde a su tipo (se inserta por su
        // extremo superior, y mide lo mismo que el hueco reservado: MISSING_SYMBOL_H).
        // Un tipo sin símbolo propio cae al placeholder celeste.
        const defEntrada = simboloDeProteccion(entradaProteccion.familia?.tipo)
        if (defEntrada) symbols.push({ x: entryX, y: ENTRY_BREAKER_CENTER_Y - MISSING_SYMBOL_H / 2, def: defEntrada })
        else rects.push(missingSymbolRect(entryX, ENTRY_BREAKER_CENTER_Y))
        // Mismos datos que los aparatos de las salidas (antes iba solo "4P 100A").
        const abbrEntrada = INTERRUPTOR_ABBR[entradaProteccion.familia?.tipo ?? ''] ?? ''
        lineasDeProteccion([abbrEntrada, ent.circuito].filter(Boolean).join(' '), entradaProteccion).forEach((texto, li) => {
          if (texto) texts.push({ x: entryX + SIMBOLO_TEXTO_OFFSET_X, y: ENTRY_BREAKER_CENTER_Y - MISSING_SYMBOL_H / 2 + DATOS_CIRCUITO_OFFSET_Y + li * DATOS_CIRCUITO_LINE_H, text: texto, size: TEXT_SIZE_UNIFILAR })
        })
      }

      if (entradaFormacion) {
        const def = CABLE_MARK_BY_POLES[poleCount(entradaFormacion)]
        if (def) symbols.push({ x: entryX, y: ENTRY_TICK_Y, def })
        else rects.push(missingSymbolRect(entryX, ENTRY_TICK_Y))
        texts.push({ x: entryX + ENTRY_FORMACION_TEXTO_OFFSET_X, y: ENTRY_TICK_Y + ENTRY_FORMACION_TEXTO_OFFSET_Y, text: formacionResumen(entradaFormacion), size: TEXT_SIZE_UNIFILAR })
        const norma = especificacionCable(entradaFormacion)
        if (norma) texts.push({ x: entryX + ENTRY_FORMACION_TEXTO_OFFSET_X, y: ENTRY_TICK_Y + ENTRY_FORMACION_TEXTO_OFFSET_Y + ENTRY_NORMA_OFFSET_Y, text: norma, size: TEXT_SIZE_UNIFILAR })
      }

      // Encabezado de la entrada como en el esquema tipo de CTM-003: circuito, de dónde
      // viene y qué conductores trae (L1/L2/L3/N/PE).
      // Van apilados de modo que el último renglón termine justo arriba del borde del
      // gabinete (antes el tercero quedaba cruzado por esa línea).
      const encabezado = [ent.circuito, entradaU.desde ? `Desde ${entradaU.desde}` : '', entradaFormacion ? fasesDeFormacion(entradaFormacion) : ''].filter(Boolean)
      const yBase = ENTRY_TOP_Y + LIMITE_INSET_TOP - ENTRY_ENCABEZADO_MARGEN
      encabezado.forEach((texto, li) => texts.push({
        x: entryX - ENTRY_TITULO_OFFSET_X, y: yBase - (encabezado.length - li) * ENTRY_ENCABEZADO_LINE_H,
        width: ENTRY_TITULO_W, align: 'right', text: texto, size: TEXT_SIZE_UNIFILAR, bold: li === 0,
      }))
    })
  })

  const yMarcaCable = O + DIST_MARCA_CABLE
  const yCableTierra = O + DIST_CABLE_TIERRA
  const yBornera = O + DIST_BORNERA
  const yFinTramo = O + LARGO_TRAMO

  // Tramos contiguos de circuitos que comparten un mismo grupo diferencial (se asume
  // que los circuitos de un grupo son contiguos en el orden de columnas, igual que en
  // el ejemplo real: 1-5 bajo un ID, 8-15 bajo otro). Cada tramo cuelga de un ID propio
  // sobre un peine — el ID todavía no tiene bloque real digitalizado, mismo placeholder
  // celeste que el seccionador de entrada (missingSymbolRect).
  for (let gi = 0; gi < circuitos.length; gi++) {
    const grupoId = circuitos[gi].grupo_diferencial_id
    if (grupoId == null) continue
    let gj = gi
    while (gj + 1 < circuitos.length && circuitos[gj + 1].grupo_diferencial_id === grupoId) gj++

    const grupo = circuitos[gi].grupo_diferencial!
    const xIni = columnX(gi, layout)
    const xFin = columnX(gj, layout)
    const xCenter = (xIni + xFin) / 2
    const yIdCentro = (BUS_Y + yPeine) / 2

    if (gj > gi) lines.push({ x1: xIni, y1: yPeine, x2: xFin, y2: yPeine, weight: LINE_WEIGHT_UNIFILAR })
    lines.push({ x1: xCenter, y1: BUS_Y, x2: xCenter, y2: yPeine, weight: LINE_WEIGHT_UNIFILAR })
    // Mismo alto que el hueco reservado (MISSING_SYMBOL_H) e inserción por arriba.
    symbols.push({ x: xCenter, y: yIdCentro - MISSING_SYMBOL_H / 2, def: ID })

    // 4 líneas de datos a la derecha del ID, mismo criterio que el bloque de datos de
    // cada ITM (ver más abajo): tag, polos+In, sensibilidad+clase, norma — la primera
    // línea es el tag (grupo.nombre, ej. "ID-01") igual que en los ITM la primera línea
    // es su propio tag (abbr + circuito).
    const gp = grupo.proteccion
    const lineasGrupo = [
      grupo.nombre ?? '',
      gp ? [gp.polos != null ? `${gp.polos}P` : null, gp.In != null ? `${gp.In}A` : null].filter(Boolean).join(' ') : '',
      gp ? [gp.sensibilidad_mA != null ? `${gp.sensibilidad_mA}mA` : null, gp.clase_diferencial ?? null].filter(Boolean).join(' ') : '',
      gp?.familia?.norma ?? '',
    ]
    const idBoxTop = yIdCentro - MISSING_SYMBOL_H / 2
    lineasGrupo.forEach((texto, li) => {
      if (texto) texts.push({ x: xCenter + MISSING_SYMBOL_W / 2 + GRUPO_TEXTO_OFFSET_X, y: idBoxTop + DATOS_CIRCUITO_OFFSET_Y + li * DATOS_CIRCUITO_LINE_H, text: texto, size: TEXT_SIZE_UNIFILAR })
    })

    gi = gj
  }

  circuitos.forEach((c, i) => {
    const x = columnX(i, layout)
    const cableTierra = c.formacion?.cable_tierra ?? null

    // Línea principal: de la barra de potencia (o del peine de su grupo diferencial,
    // si tiene uno) al fin del tramo, siempre derecho — el conductor de tierra es un
    // conductor aparte, no una continuación de esta línea.
    //dots.push({ x, y: BUS_Y, r: 3 })
    lines.push({ x1: x, y1: c.grupo_diferencial_id != null ? yPeine : BUS_Y, x2: x, y2: O, weight: LINE_WEIGHT_UNIFILAR })
    // Protección: el símbolo de su tipo (termomagnética, diferencial…), insertado por
    // su extremo superior (ver insertX/insertY en _symbols.ts) — por eso va en y=O.
    // Celeste (no esConductor): es una marca informativa del dispositivo, no el
    // conductor. Sin protección asignada, o de un tipo sin símbolo, va el placeholder
    // celeste: antes se dibujaba una termomagnética aunque el circuito no tuviera nada.
    const defProteccion = simboloDeProteccion(c.proteccion?.familia?.tipo)
    if (defProteccion) symbols.push({ x, y: O, def: defProteccion })
    else rects.push(missingSymbolRect(x, O + PROTECCION_H / 2))
    lines.push({ x1: x, y1: O + PROTECCION_H, x2: x, y2: yFinTramo, weight: LINE_WEIGHT_UNIFILAR })

    // 4 líneas de datos a la derecha del bloque, mismo criterio que el plano de
    // referencia: tag, polos+In, curva+Icu, norma — cada una si hay dato para mostrar.
    const p = c.proteccion
    const abbr = p ? (INTERRUPTOR_ABBR[p.familia?.tipo ?? ''] ?? '') : ''
    const lineas = lineasDeProteccion([abbr, c.circuito].filter(Boolean).join(' '), p)
    lineas.forEach((texto, li) => {
      if (texto) texts.push({ x: x + SIMBOLO_TEXTO_OFFSET_X, y: O + DATOS_CIRCUITO_OFFSET_Y + li * DATOS_CIRCUITO_LINE_H, text: texto, size: TEXT_SIZE_UNIFILAR })
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
      texts.push({ x: xTierra + SIMBOLO_TEXTO_OFFSET_X, y: yCableTierra - TEXT_SIZE_UNIFILAR / 2, text: `PE ${cableTierra.nombre}`, size: TEXT_SIZE_UNIFILAR, role: 'tierra' })
      // Bornera de tierra — verde, misma marca que la de potencia, sobre la barra de
      // tierra (misma altura que esa línea horizontal, no la de la bornera de potencia).
      symbols.push({ x: xTierra, y: yBarraTierra, def: BORNE, role: 'tierra', esConductor: true })
    }
  })

  // Recuadro celeste que marca el límite físico del tablero (gabinete) — envuelve todo
  // el contenido dibujado (entrada + circuitos) con un margen fijo. No es lo mismo que
  // missingSymbolRect: ese es un placeholder de bloque faltante, este es un elemento
  // real y permanente del plano.
  // Se mide con las cajas reales (símbolos completos y textos), no solo con los puntos
  // de inserción: antes un texto o un símbolo podía quedar fuera del recuadro.
  const contenido = cajasDe({ lines, rects, dots, texts, symbols })
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const consider = (px: number, py: number) => {
    minX = Math.min(minX, px); maxX = Math.max(maxX, px)
    minY = Math.min(minY, py); maxY = Math.max(maxY, py)
  }
  // El alto del recuadro sigue saliendo de las líneas (tramos de los circuitos y
  // entradas, que lo cruzan a propósito); el ancho, de todo el contenido.
  for (const l of lines) { consider(l.x1, l.y1); consider(l.x2, l.y2) }
  for (const c of contenido) { minX = Math.min(minX, c.x1); maxX = Math.max(maxX, c.x2) }

  // Cartel de riesgo eléctrico y bloque de datos del tablero: columna propia a la
  // IZQUIERDA del contenido eléctrico (un cartel de seguridad va al costado del
  // tablero, no debajo de la planilla). El cartel va alineado por abajo con el fin del
  // contenido; el bloque de datos, arriba. La x de cada uno sale de xLibreALaIzquierda
  // (ver la regla más arriba) y después se alinean los dos por su borde izquierdo. Si
  // el tablero es tan bajo que quedarían encimados entre sí, el cartel pasa a la
  // izquierda del bloque.
  const cartelY = maxY - CARTEL_OFFSET_Y
  const cartelTop = cartelY - CARTEL_ALTURA
  let cartelX = xLibreALaIzquierda(contenido, cartelTop, cartelY, CARTEL_ANCHO, CARTEL_MARGIN, minX)

  if (datosTablero) {
    const yTitulo = ENTRY_TOP_Y + DATOS_TABLERO_OFFSET_Y
    const yLineas = yTitulo + DATOS_TABLERO_TITULO_SIZE + 2
    // Ancho real del bloque: el del renglón más largo (medido), no un ancho fijo.
    const anchoBloque = Math.max(
      textWidth(datosTablero.titulo, DATOS_TABLERO_TITULO_SIZE, true),
      ...datosTablero.lineas.map(t => textWidth(t, TEXT_SIZE_UNIFILAR)),
    )
    const yFinBloque = yLineas + datosTablero.lineas.length * DATOS_TABLERO_LINE_H
    let bloqueX = xLibreALaIzquierda(contenido, yTitulo, yFinBloque, anchoBloque, CARTEL_MARGIN, minX)
    const izquierda = Math.min(cartelX, bloqueX)
    bloqueX = izquierda
    cartelX = yFinBloque + CARTEL_MARGIN > cartelTop ? izquierda - CARTEL_MARGIN - CARTEL_ANCHO : izquierda

    texts.push({ x: bloqueX, y: yTitulo, text: datosTablero.titulo, size: DATOS_TABLERO_TITULO_SIZE, bold: true })
    datosTablero.lineas.forEach((texto, li) => texts.push({ x: bloqueX, y: yLineas + li * DATOS_TABLERO_LINE_H, text: texto, size: TEXT_SIZE_UNIFILAR }))
    // Entra en el recuadro del gabinete: en un tablero sin acometida dibujada, lo más
    // alto del resto del contenido es la barra y el bloque quedaría afuera.
    consider(bloqueX, yTitulo - LIMITE_INSET_TOP - 2)
    consider(bloqueX + anchoBloque, yFinBloque)
  }

  symbols.push({ x: cartelX, y: cartelY, def: CARTEL_RIESGO_ELECTRICO, role: 'peligro' })
  consider(cartelX, cartelTop)
  consider(cartelX + CARTEL_ANCHO, cartelY)

  const limX1 = minX - LIMITE_MARGIN, limY1 = minY + LIMITE_INSET_TOP
  const limX2 = maxX + LIMITE_MARGIN + LIMITE_MARGIN_DERECHA_EXTRA, limY2 = maxY - LIMITE_INSET_BOTTOM
  lines.push({ x1: limX1, y1: limY1, x2: limX2, y2: limY1, weight: LINE_WEIGHT_UNIFILAR, role: 'limite' })
  lines.push({ x1: limX2, y1: limY1, x2: limX2, y2: limY2, weight: LINE_WEIGHT_UNIFILAR, role: 'limite' })
  lines.push({ x1: limX2, y1: limY2, x2: limX1, y2: limY2, weight: LINE_WEIGHT_UNIFILAR, role: 'limite' })
  lines.push({ x1: limX1, y1: limY2, x2: limX1, y2: limY1, weight: LINE_WEIGHT_UNIFILAR, role: 'limite' })

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
  // El cartel ya no entra acá: está al costado (ver arriba), no debajo, así que nunca
  // empuja este valor hacia abajo.
  return { width, height: yFinTramo, lines, rects, dots, texts, symbols }
}
