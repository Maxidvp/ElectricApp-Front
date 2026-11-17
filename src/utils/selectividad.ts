// Selectividad entre la protección de un circuito (aguas abajo) y la que tiene
// inmediatamente aguas arriba. Función pura, con tests calculados a mano.
//
// Alcance — solo lo que se puede afirmar con las curvas normalizadas:
//   - Zona de cortocircuito. La protección de aguas arriba no dispara por su
//     magnético mientras la falla no llegue al extremo INFERIOR de su banda
//     (ej. curva C: 5·In, ver CURVA_MULTIPLICADOR). Ese es el límite de
//     selectividad calculado: Is = mult_mín(curva arriba) · In arriba.
//     Es conservador: el límite real suele ser mayor (depende de la energía que
//     deja pasar cada aparato) y solo sale de las tablas del fabricante.
//   - Zona de sobrecarga. Solo se exige la condición necesaria In arriba > In abajo.
//     No se comparan las curvas térmicas punto a punto.
//
// Fuera de alcance (por ahora): protecciones sin curva normalizada cargada (caja
// moldeada con relé regulable, guardamotores, fusibles) y la selectividad entre
// diferenciales. Para las primeras se carga a mano el límite del fabricante en el
// circuito de aguas abajo (`selectividad_Is` en A, o `selectividad_total`): si está
// cargado, pisa al calculado. Sin curva ni dato manual el resultado es 'sin_datos',
// nunca un cumple.
//
// Contra qué se compara: la falla más severa que ve la protección de aguas abajo es
// la de sus propios bornes, o sea la Icc máxima de la barra donde está montada.
//   Is ≥ Icc máx de barra → selectividad total; si no → parcial hasta Is.
import type { Circuito, Proteccion, Tablero } from '@/context/types'
import { CURVA_MULTIPLICADOR } from '@/utils/protecciones'

export type EstadoSelectividad = 'total' | 'parcial' | 'no_selectiva' | 'sin_datos' | 'no_aplica'

export type AguasArriba = {
  proteccion: Proteccion
  circuito: string            // nombre del circuito que lleva esa protección
  // true = las dos protecciones están en serie sobre el mismo tramo (interruptor
  // general del tablero y la protección del alimentador que llega a él): si disparan
  // juntas no queda fuera de servicio nada más que ese tablero.
  mismoTramo: boolean
}

export type Selectividad = {
  estado: EstadoSelectividad
  aguasArriba: AguasArriba | null
  Is_A: number | null                     // límite de selectividad
  origen: 'calculado' | 'manual' | null
  detalle: string
}

type CircuitoSel = Pick<Circuito, 'id' | 'orden' | 'circuito' | 'acometida_destino_id' | 'proteccion' | 'es_acometida' | 'parent_id' | 'tipo' | 'tablero_destino_id' | 'selectividad_Is' | 'selectividad_total'>
type TableroSel = { id: number; circuitos: CircuitoSel[] }

// Un diferencial puro o un interruptor-seccionador no son protecciones de sobrecorriente:
// no entran en este estudio.
const esDeSobrecorriente = (p: Proteccion | null | undefined): p is Proteccion =>
  !!p && p.familia?.tipo !== 'diferencial' && p.familia?.tipo !== 'seccionador'

const A = (n: number) => `${Math.round(n)} A`

// Protecciones de sobrecorriente inmediatamente aguas arriba de un circuito:
//   1. las acometidas del tablero que lo alimentan: TODAS las que están debajo de él
//      en el orden del tablero. Una acometida alimenta todo lo que tiene arriba, así
//      que con dos (emergencia primero, principal al final) las cargas esenciales
//      —arriba de la de emergencia— dependen de las dos, y las no esenciales —entre
//      ambas— solo de la principal;
//   2. si no hay ninguna (o si el circuito ES una acometida), la protección de cada
//      circuito ALIMENTADOR de otro tablero que llega a este. Para una acometida, solo
//      los que llegan a ELLA: los vinculados a ella, más los que no indican acometida
//      si es la principal (la última del tablero).
// La selectividad tiene que darse con todas: ver selectividadCircuito.
// Vacío = no hay ninguna cargada en el proyecto (ej. tablero alimentado por una fuente).
export function proteccionesAguasArriba(c: CircuitoSel, tablero: TableroSel, tableros: TableroSel[]): AguasArriba[] {
  if (!c.es_acometida) {
    const generales = tablero.circuitos
      .filter(x => x.es_acometida && x.parent_id === null && x.orden > c.orden && esDeSobrecorriente(x.proteccion))
      .sort((a, b) => a.orden - b.orden)
    if (generales.length > 0) return generales.map(g => ({ proteccion: g.proteccion!, circuito: g.circuito, mismoTramo: false }))
  }
  const acometidas = tablero.circuitos.filter(x => x.es_acometida && x.parent_id === null)
  const esPrincipal = c.es_acometida && acometidas.every(a => a.orden <= c.orden)
  const llegaAca = (x: CircuitoSel) => {
    if (!c.es_acometida) return true
    const vinculada = x.acometida_destino_id != null && acometidas.some(a => a.id === x.acometida_destino_id)
    return vinculada ? x.acometida_destino_id === c.id : esPrincipal
  }
  return tableros.flatMap(t => t.circuitos)
    .filter(x => x.tipo === 'ALIMENTADOR' && x.tablero_destino_id === tablero.id && esDeSobrecorriente(x.proteccion) && llegaAca(x))
    .map(x => ({ proteccion: x.proteccion!, circuito: x.circuito, mismoTramo: c.es_acometida }))
}

export const proteccionAguasArriba = (c: CircuitoSel, tablero: TableroSel, tableros: TableroSel[]): AguasArriba | null =>
  proteccionesAguasArriba(c, tablero, tableros)[0] ?? null

// De peor a mejor. Entre dos parciales, la de menor límite.
const GRAVEDAD: Record<EstadoSelectividad, number> = { no_selectiva: 0, sin_datos: 1, parcial: 2, total: 3, no_aplica: 4 }

// Selectividad de un circuito contra TODAS sus protecciones de aguas arriba: se informa
// el peor caso. El límite manual del circuito, si está cargado, vale para todas.
export function selectividadCircuito(c: CircuitoSel, tablero: TableroSel, tableros: TableroSel[], Icc_max_A: number | null): Selectividad {
  const arriba = proteccionesAguasArriba(c, tablero, tableros)
  if (arriba.length === 0) return evaluarSelectividad(c, null, Icc_max_A)
  return arriba.map(a => evaluarSelectividad(c, a, Icc_max_A)).reduce((peor, s) => {
    if (GRAVEDAD[s.estado] !== GRAVEDAD[peor.estado]) return GRAVEDAD[s.estado] < GRAVEDAD[peor.estado] ? s : peor
    return s.estado === 'parcial' && (s.Is_A ?? Infinity) < (peor.Is_A ?? Infinity) ? s : peor
  })
}

// `Icc_max_A`: Icc máxima de la barra donde está montada la protección de aguas abajo.
export function evaluarSelectividad(c: CircuitoSel, aguasArriba: AguasArriba | null, Icc_max_A: number | null): Selectividad {
  const base = { aguasArriba, Is_A: null, origen: null }
  const abajo = c.proteccion

  if (!abajo) return { ...base, estado: 'sin_datos', detalle: 'El circuito no tiene protección asignada' }
  if (!esDeSobrecorriente(abajo)) return { ...base, estado: 'no_aplica', detalle: 'El aparato de este circuito no es una protección de sobrecorriente (diferencial o seccionador)' }
  if (!aguasArriba) return { ...base, estado: 'no_aplica', detalle: 'No hay una protección aguas arriba cargada en el proyecto' }

  const contra = `con ${aguasArriba.circuito}`
  const clasificar = (Is: number, origen: 'calculado' | 'manual'): Selectividad => {
    const fuente = origen === 'manual' ? 'dato de fabricante' : 'calculado'
    if (Icc_max_A == null)
      return { aguasArriba, Is_A: Is, origen, estado: 'sin_datos', detalle: `Límite ${A(Is)} (${fuente}) ${contra}, pero falta la Icc de barra para clasificarla` }
    return Is >= Icc_max_A
      ? { aguasArriba, Is_A: Is, origen, estado: 'total', detalle: `Total ${contra}: límite ${A(Is)} (${fuente}) ≥ Icc de barra ${A(Icc_max_A)}` }
      : { aguasArriba, Is_A: Is, origen, estado: 'parcial', detalle: `Parcial ${contra}: asegurada hasta ${A(Is)} (${fuente}); Icc de barra ${A(Icc_max_A)}` }
  }

  // Dato de fabricante cargado a mano: pisa al calculado.
  if (c.selectividad_total)
    return { aguasArriba, Is_A: null, origen: 'manual', estado: 'total', detalle: `Total ${contra} (dato de fabricante)` }
  if (c.selectividad_Is != null) return clasificar(c.selectividad_Is, 'manual')

  const arriba = aguasArriba.proteccion
  const bandaArriba = arriba.curva ? CURVA_MULTIPLICADOR[arriba.curva] : null
  const bandaAbajo = abajo.curva ? CURVA_MULTIPLICADOR[abajo.curva] : null
  if (!bandaArriba || !bandaAbajo || arriba.In == null || abajo.In == null)
    return { ...base, estado: 'sin_datos', detalle: `Sin curva normalizada (B/C/D/K/Z) e In en las dos protecciones: cargar a mano el límite de selectividad del fabricante ${contra}` }

  if (arriba.In <= abajo.In)
    return { ...base, estado: 'no_selectiva', detalle: `No selectiva ${contra}: su In (${arriba.In} A) no supera la de este circuito (${abajo.In} A)` }

  return clasificar(bandaArriba[0] * arriba.In, 'calculado')
}
