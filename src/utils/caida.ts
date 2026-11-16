// Caída de tensión de un circuito — arma los datos automáticos (R, X, N° de fases,
// conductores por fase, largo) y llama a calcDrops. Compartido por la página de
// Caídas, el panel de Verificación y la Memoria de cálculo.
import type { Circuito } from '@/context/types'
import type { CargaCircuito } from '@/utils/cargas'
import { calcDrops, calcReactancia, calcResistencia, type CaidaInput } from '@/utils/electricidad'

// Límite que ya usaba la página de Caídas para marcar en rojo (régimen permanente).
// Es un valor único para todo tipo de circuito: pendiente diferenciarlo por uso
// (iluminación / fuerza motriz) con los valores de AEA 90364-7-771.
export const LIMITE_CAIDA_PCT = 3

export const CAIDA_INPUT_VACIO: CaidaInput = { tension: '', fp: '', in_: '', cf: '', l: '', r: '', x: '', cable_id: '' }

// Cable sobre el que se calcula: el de la formación, o uno elegido a mano en la
// página de Caídas (del catálogo, que puede no traer la familia anidada).
export type CableCaida = {
  seccion_f: string
  calibre_tipo: string
  diametro: number | null
  Nfases: number
  familia?: { material: string | null; temperatura: number | null } | null
}

export type CaidaCircuito = {
  nfases:    number
  cfAuto:    number | null   // conductores por fase
  largoAuto: number | null   // m
  rAuto:     number | null   // Ω/km a la temperatura máxima de servicio del cable
  xAuto:     number | null   // Ω/km
  ev:        number | null   // V
  epct:      number | null   // %
}

export function evaluarCaida(
  c: Circuito, carga: CargaCircuito,
  cable: CableCaida | null = c.formacion?.cable ?? null,
  input: CaidaInput = CAIDA_INPUT_VACIO,
): CaidaCircuito {
  // En una formación multipolar Formacion.Nfases queda forzado a 1 ("un mazo"): el
  // N° de fases real es el del propio cable.
  const esMultipolar = (cable?.Nfases ?? 1) > 1
  const nfases = esMultipolar ? (cable?.Nfases ?? 3) : (c.formacion?.Nfases ?? 3)
  const cfAuto = c.formacion?.cond_por_fase ?? null
  const largoAuto = c.Largo ?? null

  const rAuto = cable
    ? calcResistencia(cable.seccion_f, cable.calibre_tipo, cable.familia?.material ?? null, cable.familia?.temperatura ?? null)
    : null
  const xAuto = cable
    ? calcReactancia(cable.diametro, cable.seccion_f, cable.calibre_tipo, c.formacion?.disposicion ?? null, cable.Nfases)
    : null

  const { ev, epct } = calcDrops(input, nfases, cfAuto, carga.fp, largoAuto, carga.tension, xAuto, carga.corriente, rAuto)
  return { nfases, cfAuto, largoAuto, rAuto, xAuto, ev, epct }
}
