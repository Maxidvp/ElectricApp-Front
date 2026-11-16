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

type CircuitoSel = Pick<Circuito, 'id' | 'circuito' | 'proteccion' | 'es_acometida' | 'parent_id' | 'tipo' | 'tablero_destino_id' | 'selectividad_Is' | 'selectividad_total'>
type TableroSel = { id: number; circuitos: CircuitoSel[] }

// Un diferencial puro no es una protección de sobrecorriente: no entra en este estudio.
const esDeSobrecorriente = (p: Proteccion | null | undefined): p is Proteccion =>
  !!p && p.familia?.tipo !== 'diferencial'

const A = (n: number) => `${Math.round(n)} A`

// Protección de sobrecorriente inmediatamente aguas arriba de un circuito:
//   1. el interruptor general del tablero (su circuito de acometida), si tiene;
//   2. si no (o si el circuito ES la acometida), la protección del circuito
//      ALIMENTADOR de otro tablero que llega a este.
// null = no hay ninguna cargada en el proyecto (ej. tablero alimentado por una fuente).
export function proteccionAguasArriba(c: CircuitoSel, tablero: TableroSel, tableros: TableroSel[]): AguasArriba | null {
  if (!c.es_acometida) {
    const general = tablero.circuitos.find(x => x.es_acometida && x.parent_id === null && x.id !== c.id && esDeSobrecorriente(x.proteccion))
    if (general) return { proteccion: general.proteccion!, circuito: general.circuito, mismoTramo: false }
  }
  const alimentador = tableros.flatMap(t => t.circuitos)
    .find(x => x.tipo === 'ALIMENTADOR' && x.tablero_destino_id === tablero.id && esDeSobrecorriente(x.proteccion))
  if (alimentador) return { proteccion: alimentador.proteccion!, circuito: alimentador.circuito, mismoTramo: c.es_acometida }
  return null
}

// `Icc_max_A`: Icc máxima de la barra donde está montada la protección de aguas abajo.
export function evaluarSelectividad(c: CircuitoSel, aguasArriba: AguasArriba | null, Icc_max_A: number | null): Selectividad {
  const base = { aguasArriba, Is_A: null, origen: null }
  const abajo = c.proteccion

  if (!abajo) return { ...base, estado: 'sin_datos', detalle: 'El circuito no tiene protección asignada' }
  if (!esDeSobrecorriente(abajo)) return { ...base, estado: 'no_aplica', detalle: 'La selectividad entre diferenciales no se evalúa' }
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
