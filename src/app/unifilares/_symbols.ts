// Símbolos tomados directo de los bloques de AutoCAD (SVG exportado del bloque real,
// no dibujados a mano) — coordenadas en el sistema local del propio SVG. El punto de
// inserción es el centro del viewBox, igual que el INSERT de un bloque en AutoCAD:
// se ancla en el centro y se posiciona con x/y (+ rotación si hiciera falta) en Konva.
export type SymbolLine = { x1: number; y1: number; x2: number; y2: number }
// `filled` en false es un círculo hueco (solo contorno) — ej. el cuerpo de una
// bornera. Sin el campo (dots existentes) se sigue rindiendo relleno, como antes.
export type SymbolDot = { x: number; y: number; r: number; filled?: boolean }
// Arco real (no aproximado con segmentos rectos) — ángulos en grados, convención de
// canvas: 0° = derecha, 90° = abajo, sentido horario de start a end (coincide con
// context.arc(), ver CadSymbol.tsx).
export type SymbolArc = { cx: number; cy: number; r: number; startAngle: number; endAngle: number }
// `name` es el nombre de archivo del SVG sin extensión, y también el nombre del
// bloque real en AutoCAD (ver CadSymbol.tsx y _export.ts) — mismo criterio en los
// dos lugares para no tener que mantener un mapeo aparte.
// `insertX`/`insertY` son el punto de inserción del bloque, en coordenadas locales
// del propio SVG — por default el centro del viewBox (como el INSERT de un bloque
// centrado en AutoCAD), pero algunos bloques se insertan desde otro punto (ej. el
// ITM, que engancha por el extremo superior del cable entrante, no por el medio).
export type SymbolDef = { name: string; viewBox: number; lines: SymbolLine[]; dots: SymbolDot[]; arcs?: SymbolArc[]; insertX?: number; insertY?: number }

// UNIF_CABLE_TETRA.svg — marca de cable tetrapolar (4 conductores en la formación).
export const CABLE_TETRA: SymbolDef = {
  name: 'UNIF_CABLE_TETRA',
  viewBox: 14.2,
  lines: [
    { x1: 5.4, y1: 5.5, x2: 8.6, y2: 7.3 },
    { x1: 5.4, y1: 4.3, x2: 8.6, y2: 6.1 },
    { x1: 5.4, y1: 7.9, x2: 8.6, y2: 9.7 },
    { x1: 5.4, y1: 6.7, x2: 8.6, y2: 8.5 },
  ],
  dots: [{ x: 5.4, y: 7.9, r: 0.2 }],
}

// UNIF_CABLE_MONO.svg — marca de cable monofásico (2 conductores: fase + neutro).
export const CABLE_MONO: SymbolDef = {
  name: 'UNIF_CABLE_MONO',
  viewBox: 14.2,
  lines: [
    { x1: 5.4, y1: 6.7, x2: 8.6, y2: 8.5 },
    { x1: 5.4, y1: 5.5, x2: 8.6, y2: 7.3 },
  ],
  dots: [{ x: 5.4, y: 6.7, r: 0.2 }],
}

// UNIF_CABLE_TRI — marca de cable de 3 conductores. NO sale de un bloque real como las
// otras dos: está dibujada con su mismo trazo y separación (1.2 mm entre conductores,
// centrada igual). Sin punto: en las marcas reales el punto está en el conductor de
// neutro (tetrapolar = 3F+N, monofásico = F+N), y la cuenta de conductores sola no dice
// si alguno de los tres es neutro.
export const CABLE_TRI: SymbolDef = {
  name: 'UNIF_CABLE_TRI',
  viewBox: 14.2,
  lines: [
    { x1: 5.4, y1: 4.9, x2: 8.6, y2: 6.7 },
    { x1: 5.4, y1: 6.1, x2: 8.6, y2: 7.9 },
    { x1: 5.4, y1: 7.3, x2: 8.6, y2: 9.1 },
  ],
  dots: [],
}

// UNIF_CABLE_GND.svg — marca del cable de tierra (derivación de PE). A diferencia de
// CABLE_MARK_BY_POLES, esta no varía según cantidad de conductores — es siempre la
// misma marca, en la derivación de tierra de cada circuito (ver _model.ts).
export const CABLE_GND: SymbolDef = {
  name: 'UNIF_CABLE_GND',
  viewBox: 14.2,
  lines: [
    { x1: 4.9, y1: 7,   x2: 5.9, y2: 5.2 },
    { x1: 5.4, y1: 6.1, x2: 8.6, y2: 7.9 },
  ],
  dots: [],
}

// UNIF_BORNE.svg — bornera de conexión (terminal). Misma marca para el lado de
// potencia y el de tierra — lo que cambia es el color, no el símbolo (ver _model.ts).
export const BORNE: SymbolDef = {
  name: 'UNIF_BORNE',
  viewBox: 14,
  lines: [
    { x1: 5.9, y1: 8.3, x2: 8.3, y2: 5.9 },
  ],
  dots: [
    { x: 7.1, y: 7.1, r: 1, filled: false },
  ],
}

// UNIF_ITM.svg — interruptor termomagnético: cuchilla diagonal (contacto abierto),
// cruz de disparo magnético arriba y zigzag de disparo térmico abajo. Punto de
// inserción en el centro superior (7,0) — el bloque engancha por ahí, no por el
// centro del viewBox como los demás símbolos.
export const ITM: SymbolDef = {
  name: 'UNIF_ITM',
  viewBox: 14,
  insertX: 7,
  insertY: 0,
  lines: [
    { x1: 7, y1: 0, x2: 7, y2: 3 },       // pata superior
    { x1: 6.5, y1: 3, x2: 7.5, y2: 3 },   // travesaño
    { x1: 6.3, y1: 2.2, x2: 7.7, y2: 0.8 }, // cruz de disparo magnético
    { x1: 6.3, y1: 0.8, x2: 7.7, y2: 2.2 },
    { x1: 6, y1: 3, x2: 7, y2: 7 },       // cuchilla (contacto abierto)
    { x1: 7, y1: 7, x2: 7, y2: 8 },       // zigzag de disparo térmico
    { x1: 7, y1: 8, x2: 8, y2: 8 },
    { x1: 8, y1: 8, x2: 8, y2: 9 },
    { x1: 8, y1: 9, x2: 7, y2: 9 },
    { x1: 7, y1: 9, x2: 7, y2: 10 },
    { x1: 7, y1: 10, x2: 7.5, y2: 10 },
    { x1: 7, y1: 11, x2: 7.5, y2: 11 },
    { x1: 7, y1: 11, x2: 7, y2: 12 },     // pata inferior
  ],
  dots: [],
  arcs: [
    // Semiarco entre el zigzag y la pata inferior (centro 7.5,10.5 r=0.5) abierto
    // hacia la izquierda — de -90° (7.5,10) a 90° (7.5,11) pasando por 0° (8,10.5).
    { cx: 7.5, cy: 10.5, r: 0.5, startAngle: -90, endAngle: 90 },
  ],
}

// UNIF_ID — interruptor diferencial. NO sale de un bloque real: está dibujado siguiendo
// el símbolo de la guía de COPAIPA ("Guía de Productos y Símbolos para Instalación
// Eléctrica", y el esquema tipo de CTM-003 hoja 2 — ver Docs COPAIPA/): misma cabeza que
// el ITM (cruz + contacto), el conductor que atraviesa el toroide, y el vínculo en "["
// que une el contacto con el toroide. Misma caja que el ITM (12 mm de alto, inserción
// por el extremo superior) para entrar en las mismas cotas. Si el dibujo de destino ya
// tiene un bloque con este nombre, la exportación usa ese.
export const ID: SymbolDef = {
  name: 'UNIF_ID',
  viewBox: 14,
  insertX: 7,
  insertY: 0,
  lines: [
    { x1: 7, y1: 0, x2: 7, y2: 3 },         // pata superior
    { x1: 6.5, y1: 3, x2: 7.5, y2: 3 },     // travesaño
    { x1: 6.3, y1: 2.2, x2: 7.7, y2: 0.8 }, // cruz
    { x1: 6.3, y1: 0.8, x2: 7.7, y2: 2.2 },
    { x1: 6, y1: 3, x2: 7, y2: 7 },         // cuchilla (contacto abierto)
    { x1: 7, y1: 7, x2: 7, y2: 12 },        // conductor, atraviesa el toroide
    { x1: 6.5, y1: 5, x2: 4.6, y2: 5 },     // vínculo contacto → toroide
    { x1: 4.6, y1: 5, x2: 4.6, y2: 9.5 },
    { x1: 4.6, y1: 9.5, x2: 5.5, y2: 9.5 },
  ],
  dots: [{ x: 7, y: 9.5, r: 1.5, filled: false }], // toroide
}

// UNIF_IS — interruptor-seccionador (IEC 60947-3). NO sale de un bloque real: sigue el
// "IS" del esquema tipo de CTM-003 hoja 2 (contacto con el travesaño de seccionador y el
// círculo de interruptor bajo carga), en la misma caja que el ITM. Si el dibujo de
// destino ya tiene un bloque con este nombre, la exportación usa ese.
export const IS: SymbolDef = {
  name: 'UNIF_IS',
  viewBox: 14,
  insertX: 7,
  insertY: 0,
  lines: [
    { x1: 7, y1: 0, x2: 7, y2: 2 },         // pata superior
    { x1: 6.2, y1: 2, x2: 7.8, y2: 2 },     // travesaño (función seccionador)
    { x1: 5.9, y1: 3.3, x2: 7, y2: 7 },     // cuchilla (contacto abierto)
    { x1: 7, y1: 7, x2: 7, y2: 12 },        // pata inferior
  ],
  dots: [{ x: 7, y: 2.5, r: 0.5, filled: false }], // círculo (maniobra bajo carga)
}

// CARTEL_RIESGO_ELECTRICO.svg — cartel normalizado de riesgo eléctrico (placa +
// triángulo de peligro + rayo), esquina inferior izquierda del tablero. El SVG fuente
// es una exportación de AutoCAD con el relleno reconstruido a base de cientos de
// parches triangulares (hatch) — la geometría acá sale de los trazos de contorno
// limpios (stroke, no fill) del mismo SVG, no del relleno. Coordenadas trasladadas
// para que el origen (0,0) sea la esquina superior izquierda de la placa exterior.
// Se inserta por su esquina inferior izquierda (insertX/insertY), no por el centro,
// para poder anclarlo directo a la esquina del tablero.
export const CARTEL_RIESGO_ELECTRICO: SymbolDef = {
  name: 'CARTEL_RIESGO_ELECTRICO',
  viewBox: 38.26,
  insertX: 0,
  insertY: 38.26,
  lines: [
    // Placa exterior.
    { x1: 0, y1: 0, x2: 27.82, y2: 0 },
    { x1: 27.82, y1: 0, x2: 27.82, y2: 38.26 },
    { x1: 27.82, y1: 38.26, x2: 0, y2: 38.26 },
    { x1: 0, y1: 38.26, x2: 0, y2: 0 },
    // Recuadro inferior (donde va el texto "ATENCION...").
    { x1: 1.27, y1: 25.65, x2: 26.69, y2: 25.65 },
    { x1: 26.69, y1: 25.65, x2: 26.69, y2: 36.89 },
    { x1: 26.69, y1: 36.89, x2: 1.27, y2: 36.89 },
    { x1: 1.27, y1: 36.89, x2: 1.27, y2: 25.65 },
    // Triángulo de peligro (esquinas redondeadas, contorno negro del SVG original).
    { x1: 25.83, y1: 21.66, x2: 14.72, y2: 2.42 },
    { x1: 14.72, y1: 2.42, x2: 14.41, y2: 2.11 },
    { x1: 14.41, y1: 2.11, x2: 13.99, y2: 2.00 },
    { x1: 13.99, y1: 2.00, x2: 13.57, y2: 2.11 },
    { x1: 13.57, y1: 2.11, x2: 13.26, y2: 2.42 },
    { x1: 13.26, y1: 2.42, x2: 2.16, y2: 21.66 },
    { x1: 2.16, y1: 21.66, x2: 2.04, y2: 22.08 },
    { x1: 2.04, y1: 22.08, x2: 2.16, y2: 22.50 },
    { x1: 2.16, y1: 22.50, x2: 2.46, y2: 22.81 },
    { x1: 2.46, y1: 22.81, x2: 2.88, y2: 22.92 },
    { x1: 2.88, y1: 22.92, x2: 25.10, y2: 22.92 },
    { x1: 25.10, y1: 22.92, x2: 25.52, y2: 22.81 },
    { x1: 25.52, y1: 22.81, x2: 25.83, y2: 22.50 },
    { x1: 25.83, y1: 22.50, x2: 25.94, y2: 22.08 },
    { x1: 25.94, y1: 22.08, x2: 25.83, y2: 21.66 },
    // Rayo dentro del triángulo. El SVG original lo rellena con 3 franjas diagonales
    // superpuestas (zigzag) + un remate en punta abajo, reconstruidas como parches
    // triangulares (hatch), no como contorno limpio — la silueta real acá sale de
    // cancelar los bordes internos compartidos entre franjas (el borde donde una
    // termina y la siguiente empieza no es parte del contorno exterior) y quedarse con
    // el resto: A-B tope, B-C baja hacia el cuerpo, C-E sale al gancho derecho, E-G baja
    // por la franja larga, G-K-H la punta de abajo, F-D vuelve por el borde izquierdo.
    { x1: 13.09, y1: 7.51, x2: 15.31, y2: 8.03 },
    { x1: 15.31, y1: 8.03, x2: 13.39, y2: 14.06 },
    { x1: 13.39, y1: 14.06, x2: 16.19, y2: 12.90 },
    { x1: 16.19, y1: 12.90, x2: 13.15, y2: 20.56 },
    { x1: 13.15, y1: 20.56, x2: 12.96, y2: 20.81 },
    { x1: 12.96, y1: 20.81, x2: 12.97, y2: 20.50 },
    { x1: 12.97, y1: 20.50, x2: 14.62, y2: 14.10 },
    { x1: 14.62, y1: 14.10, x2: 11.69, y2: 16.38 },
    { x1: 11.69, y1: 16.38, x2: 13.09, y2: 7.51 },
  ],
  dots: [],
}

// Cantidad de conductores de la formación → símbolo de marca de cable.
export const CABLE_MARK_BY_POLES: Record<number, SymbolDef> = {
  2: CABLE_MONO,
  3: CABLE_TRI,
  4: CABLE_TETRA,
}

// Tipo de protección del catálogo (FamiliaProteccion.tipo) → símbolo. El guardamotor y
// el interruptor en caja moldeada son interruptores automáticos con disparo térmico y
// magnético: mismo símbolo que el termomagnético. Un tipo sin símbolo propio devuelve
// null y el dibujo muestra el recuadro de "símbolo faltante".
export function simboloDeProteccion(tipo: string | null | undefined): SymbolDef | null {
  switch (tipo) {
    case 'termomagnetico': case 'caja_moldeada': case 'guardamotor': return ITM
    case 'diferencial': return ID
    case 'seccionador': return IS
    default: return null
  }
}

// Todos los símbolos conocidos, por nombre de bloque — usado para resolver los
// elementos manuales (ElementoUnifilar.nombre_bloque, ver _elementos.ts), donde el
// usuario elige el símbolo por nombre en vez de que salga de la cantidad de polos.
export const SYMBOLS_BY_NAME: Record<string, SymbolDef> = {
  [CABLE_TETRA.name]: CABLE_TETRA,
  [CABLE_MONO.name]: CABLE_MONO,
  [CABLE_TRI.name]: CABLE_TRI,
  [CABLE_GND.name]: CABLE_GND,
  [BORNE.name]: BORNE,
  [ITM.name]: ITM,
  [ID.name]: ID,
  [IS.name]: IS,
  [CARTEL_RIESGO_ELECTRICO.name]: CARTEL_RIESGO_ELECTRICO,
}
