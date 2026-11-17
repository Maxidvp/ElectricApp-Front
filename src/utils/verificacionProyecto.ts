// Evalúa TODO el proyecto de una vez: por cada tablero de potencia y cada circuito
// principal corre las mismas funciones que usan las páginas (carga, ampacidad,
// caída, cortocircuito) y junta los hallazgos. Es la fuente del panel de
// Verificación y de la Memoria de cálculo — ninguno de los dos recalcula nada.
//
// Niveles de hallazgo:
//   error — una verificación dio mal (no cumple).
//   falta — no se pudo verificar porque falta un dato; no es un "cumple".
//   aviso — cumple o no bloquea, pero el resultado tiene una salvedad.
import type { Circuito, Tablero } from '@/context/types'
import { resolverCargaCircuito, resolverParaSuma, calcCorrientesPorFase, tensionesDe, type CargaCircuito } from '@/utils/cargas'
import { evaluarAmpacidad, type AmpacidadCircuito, type ParametrosSitio } from '@/utils/ampacidad'
import { evaluarCaida, LIMITE_CAIDA_PCT, type CaidaCircuito } from '@/utils/caida'
import { calcularIccTablero, type IccTablero } from '@/utils/calcularIccTablero'
import { verificarCircuitoCC, type BarraCC, type ResultadoCircuitoCC } from '@/utils/verificacionCortocircuito'
import { selectividadCircuito, type Selectividad } from '@/utils/selectividad'

export type NivelHallazgo = 'error' | 'falta' | 'aviso'
export type AreaHallazgo = 'Datos' | 'Ampacidad' | 'Protección' | 'Caída' | 'Cortocircuito' | 'Selectividad'
export const AREAS: AreaHallazgo[] = ['Datos', 'Ampacidad', 'Protección', 'Caída', 'Cortocircuito', 'Selectividad']

export type Hallazgo = { nivel: NivelHallazgo; area: AreaHallazgo; mensaje: string }

export type CircuitoEvaluado = {
  circuito: Circuito
  carga: CargaCircuito
  ampacidad: AmpacidadCircuito
  caida: CaidaCircuito
  cc: ResultadoCircuitoCC
  selectividad: Selectividad
  hallazgos: Hallazgo[]
}

export type TableroEvaluado = {
  tablero: Tablero
  icc: IccTablero
  hallazgos: Hallazgo[]          // propios del tablero (no de un circuito)
  // Corriente por fase de las salidas (sin la acometida, que es su suma) — null sin datos
  fases: { R: number; S: number; T: number } | null
  circuitos: CircuitoEvaluado[]
}

export type ProyectoEvaluado = {
  tableros: TableroEvaluado[]
  resumen: Record<NivelHallazgo, number> & { circuitos: number; circuitosOk: number }
}

type Segmento = { tipo: string; circuitos: { id: number }[] }

export const esTableroPotencia = (t: Tablero) => t.categoria !== 'CONTROL' && t.categoria !== 'DATOS'

const A = (n: number) => `${n.toFixed(1)} A`
const kA = (n: number) => `${n.toFixed(2)} kA`

function hallazgosCircuito(
  c: Circuito, carga: CargaCircuito, amp: AmpacidadCircuito, caida: CaidaCircuito, cc: ResultadoCircuitoCC, barra: BarraCC,
  sel: Selectividad,
): Hallazgo[] {
  const h: Hallazgo[] = []
  const add = (nivel: NivelHallazgo, area: AreaHallazgo, mensaje: string) => h.push({ nivel, area, mensaje })

  // ── Datos de entrada ──
  if (!c.formacion) add('falta', 'Datos', 'Sin cable asignado (formación)')
  if (carga.corriente == null) add('falta', 'Datos', 'Sin corriente de diseño: falta potencia, FP o tipo de tensión')
  if (!c.Largo) add('falta', 'Datos', 'Sin largo cargado')
  if (!c.proteccion) add('falta', 'Datos', 'Sin protección asignada')

  // ── Ampacidad ──
  if (amp.cumple === false) add('error', 'Ampacidad', `El cable no alcanza: Iz ${A(amp.iadm_corr!)} < Ib ${A(carga.corriente!)}`)
  if (c.formacion && !amp.metodo) add('falta', 'Ampacidad', 'Sin método de instalación: no se aplicó factor de agrupamiento')
  if (amp.iadmAviso) add('aviso', 'Ampacidad', amp.iadmAviso)
  if (amp.metodo && amp.nAgrupados == null && amp.fcManual == null)
    add('aviso', 'Ampacidad', 'Circuito sin ruteo: no se pudo sugerir FC (se usó 1)')

  // ── Coordinación cable–protección ──
  if (amp.coord.estado === 'dispara_en_servicio' || amp.coord.estado === 'cable_desprotegido')
    add('error', 'Protección', amp.coord.detalle)

  // ── Caída de tensión ──
  if (caida.epct != null && caida.epct > LIMITE_CAIDA_PCT)
    add('error', 'Caída', `Caída ${caida.epct.toFixed(2)} % > ${LIMITE_CAIDA_PCT} %`)
  else if (caida.epct == null && c.formacion && c.Largo && carga.corriente != null)
    add('falta', 'Caída', caida.xAuto == null
      ? 'No se pudo calcular: falta la reactancia (disposición de la formación o diámetro del cable)'
      : 'No se pudo calcular: falta resistencia o tensión')

  // ── Cortocircuito ──
  if (cc.Icu_ok === false)
    add('error', 'Cortocircuito', `Poder de corte insuficiente: Icu ${kA(cc.Icu_kA!)} < Icc de barra ${kA(barra.Icc_max_A! / 1000)}`)
  if (cc.Im_ok === false)
    add('error', 'Cortocircuito', `No garantiza disparo magnético: Im ${A(cc.Im_A!)} > I"k mín ${A(cc.Ik_kA_min! * 1000)}`)
  if (c.proteccion && barra.Icc_max_A != null && cc.Icu_kA == null)
    add('falta', 'Cortocircuito', 'La protección no tiene Icu cargado')
  if (c.proteccion && cc.Ik_kA_min != null && cc.Im_A == null && c.proteccion.familia?.tipo !== 'diferencial')
    add('falta', 'Cortocircuito', 'La protección no tiene curva/In para verificar el disparo magnético')
  if (cc.cable_ok_002 === false || cc.cable_ok_02 === false)
    add('aviso', 'Cortocircuito', 'Sección térmica orientativa insuficiente (tiempos fijos; confirmar con el I²t del dispositivo)')

  // ── Selectividad con la protección de aguas arriba ──
  // El interruptor general y la protección del alimentador que llega al tablero están
  // en serie sobre el mismo tramo: si disparan juntos no sale de servicio nada más,
  // así que ese par se informa en las tablas pero no genera observación.
  if (!sel.aguasArriba?.mismoTramo) {
    if (sel.estado === 'no_selectiva' || sel.estado === 'parcial') add('aviso', 'Selectividad', sel.detalle)
    // Sin protección propia ya hay una observación de Datos; acá solo el caso en que
    // están las dos protecciones y no alcanza para evaluarlas.
    else if (sel.estado === 'sin_datos' && c.proteccion) add('falta', 'Selectividad', sel.detalle)
  }

  return h
}

export function evaluarProyecto(tableros: Tablero[], segmentos: Segmento[], sitio: ParametrosSitio): ProyectoEvaluado {
  const resumen = { error: 0, falta: 0, aviso: 0, circuitos: 0, circuitosOk: 0 }
  const contar = (hs: Hallazgo[]) => { for (const x of hs) resumen[x.nivel]++ }

  const evaluados = tableros.filter(esTableroPotencia).map((tablero): TableroEvaluado => {
    const icc = calcularIccTablero(tablero, tableros)
    const Un = tablero.tension_tri ?? tablero.tension_bi ?? tablero.tension_mono ?? null
    const barra: BarraCC = {
      Icc_max_A: icc.Icc_max_kA != null ? icc.Icc_max_kA * 1000 : null,
      Icc_min_A: icc.Icc_min_kA != null ? icc.Icc_min_kA * 1000 : null,
      Un, U0: tablero.tension_mono ?? (Un != null ? Un / Math.sqrt(3) : null),
      frecuencia_hz: tablero.frecuencia === 60 ? 60 : 50,
    }

    const hallazgosTablero: Hallazgo[] = []
    if (icc.Icc_max_kA == null)
      hallazgosTablero.push({ nivel: 'falta', area: 'Cortocircuito', mensaje: 'Sin Icc de barra: el tablero no tiene fuente de alimentación ni alimentador con cable y largo. No se verificó cortocircuito en sus circuitos.' })
    for (const a of icc.avisos) hallazgosTablero.push({ nivel: 'aviso', area: 'Cortocircuito', mensaje: a })
    contar(hallazgosTablero)

    const tensiones = tensionesDe(tablero)
    const principales = tablero.circuitos.filter(c => c.parent_id === null).sort((a, b) => a.orden - b.orden)

    const circuitos = principales
      .map((c, idx): CircuitoEvaluado => {
        const carga = resolverCargaCircuito(c, principales.slice(0, idx), tensiones, tableros)
        const ampacidad = evaluarAmpacidad(c, carga.corriente, segmentos, sitio)
        const caida = evaluarCaida(c, carga)
        const cc = verificarCircuitoCC(c, barra)
        const selectividad = selectividadCircuito(c, tablero, tableros, barra.Icc_max_A)
        return { circuito: c, carga, ampacidad, caida, cc, selectividad, hallazgos: hallazgosCircuito(c, carga, ampacidad, caida, cc, barra, selectividad) }
      })
      // Una reserva sin nada cargado no es un circuito a verificar.
      .filter(e => !(e.circuito.tipo === 'RESERVA' && !e.circuito.formacion && e.carga.corriente == null))

    for (const e of circuitos) {
      resumen.circuitos++
      if (e.hallazgos.length === 0) resumen.circuitosOk++
      contar(e.hallazgos)
    }
    const fases = calcCorrientesPorFase(
      resolverParaSuma(principales.filter(c => !c.es_acometida), tableros), tensiones)
    return { tablero, icc, hallazgos: hallazgosTablero, fases, circuitos }
  })

  return { tableros: evaluados, resumen }
}

// Peor nivel de un área para un circuito — null = sin hallazgos (cumple).
export function peorNivel(hallazgos: Hallazgo[], area?: AreaHallazgo): NivelHallazgo | null {
  const hs = area ? hallazgos.filter(h => h.area === area) : hallazgos
  if (hs.some(h => h.nivel === 'error')) return 'error'
  if (hs.some(h => h.nivel === 'falta')) return 'falta'
  if (hs.some(h => h.nivel === 'aviso')) return 'aviso'
  return null
}
