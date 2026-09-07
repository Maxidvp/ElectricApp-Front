// Modelo geométrico del unifilar — separa "qué hay que dibujar" (coordenadas, en el
// mismo sistema de unidades que los símbolos reales: 1 unidad = 1 mm, ver
// CadSymbol.tsx) de "cómo se dibuja" (Konva en UnifilarCanvas.tsx, AutoLISP en
// _export.ts). Cualquiera de los dos renderers recorre exactamente esta misma
// estructura, así no hay dos copias de la aritmética de posiciones que puedan
// desincronizarse entre lo que se ve en pantalla y lo que se exporta a AutoCAD.
import type { Circuito, Proteccion } from '@/context/types'
import { columnX, diagramWidth, type ColumnLayout } from './_layout'
import { CABLE_MARK_BY_POLES, CABLE_GND, BORNE, ITM, CARTEL_RIESGO_ELECTRICO, type SymbolDef } from './_symbols'

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
export const CARTEL_MARGIN = 0    // cartel -> resto del contenido, separación horizontal

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
  const hayGrupos = circuitos.some(c => c.grupo_diferencial_id != null)
  const O = BUS_Y + LINEA_PRINCIPAL + (hayGrupos ? EXTRA_LINEA_CON_GRUPO : 0) // tope de la protección, igual para todos los circuitos terminales
  const yBarraTierra = O + DIST_BARRA_TIERRA
  const yPeine = BUS_Y + DIST_PEINE_GRUPO

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
      texts.push({ x: entryX + ENTRY_PROTECCION_TEXTO_OFFSET_X, y: ENTRY_BREAKER_CENTER_Y + ENTRY_PROTECCION_TEXTO_OFFSET_Y, text: proteccionRating(entradaProteccion), size: TEXT_SIZE_UNIFILAR })
    }

    if (entradaFormacion) {
      const def = CABLE_MARK_BY_POLES[poleCount(entradaFormacion)]
      if (def) symbols.push({ x: entryX, y: ENTRY_TICK_Y, def })
      else rects.push(missingSymbolRect(entryX, ENTRY_TICK_Y))
      texts.push({ x: entryX + ENTRY_FORMACION_TEXTO_OFFSET_X, y: ENTRY_TICK_Y + ENTRY_FORMACION_TEXTO_OFFSET_Y, text: formacionResumen(entradaFormacion), size: TEXT_SIZE_UNIFILAR })
    }

    texts.push({ x: entryX - ENTRY_TITULO_OFFSET_X, y: ENTRY_TOP_Y + ENTRY_TITULO_OFFSET_Y, width: ENTRY_TITULO_W, align: 'right', text: entrada.circuito, size: TEXT_SIZE_UNIFILAR, bold: true })
  }

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
    rects.push(missingSymbolRect(xCenter, yIdCentro))

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
  if (entrada) consider(entryX - ENTRY_TITULO_OFFSET_X, ENTRY_TOP_Y)

  // Cartel de riesgo eléctrico: columna propia a la IZQUIERDA de todo el contenido
  // eléctrico, nunca abajo — un cartel de seguridad va al costado del tablero, no
  // debajo de la planilla. Alineado por abajo con el fin del contenido (yFinTramo).
  // Tiene que calcularse y considerarse en el bounding box ANTES de trazar el recuadro
  // límite — si no, el recuadro se dibuja con el bounding box viejo (sin el cartel) y
  // el cartel queda afuera.
  const cartelX = minX - CARTEL_MARGIN - CARTEL_ANCHO
  const cartelY = maxY - CARTEL_OFFSET_Y
  symbols.push({ x: cartelX, y: cartelY, def: CARTEL_RIESGO_ELECTRICO, role: 'peligro' })
  consider(cartelX, cartelY - CARTEL_ALTURA)
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
