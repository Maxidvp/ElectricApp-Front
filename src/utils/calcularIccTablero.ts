// Deriva la Icc de barra de un tablero recorriendo su red aguas arriba, en vez de
// depender de un dato cargado a mano en el propio Tablero (Tablero.corriente_cc_max/min
// queda como campo legado, ya no se usa acá — ver nota en cortocircuitos/page.tsx).
//
// Reglas de conexión (una por tablero, evaluadas como caminos independientes — no se
// combinan en paralelo entre sí, se toma el peor caso entre todos):
//   - Fuente propia tipo RED + TRANSFORMADOR en el mismo tablero: el trafo es el último
//     elemento en serie antes de la barra, la red representa la MT vista desde su primario.
//   - Fuente propia tipo RED sola (sin trafo): alimenta la barra directamente.
//   - Fuente propia tipo GENERADOR: única fuente de ese camino.
//   - Circuito ALIMENTADOR entrante desde otro tablero: se hereda la red de ese tablero
//     (recursivamente) y se le agrega en serie el cable del propio circuito ALIMENTADOR.
//   - Nada de lo anterior: sin datos, no se puede derivar (el llamador debe mostrar "—").
//
// Limitaciones conocidas: UPS/PANEL_SOLAR no tienen fórmula de impedancia en el motor de
// cálculo (fuentes limitadas electrónicamente, no están en la spec IEC 60909-0 que
// implementa `utils/cortocircuito`) y se ignoran. Si hay más de una red cargada en un
// mismo tablero junto con transformadores, todos los trafos se emparejan con la primera.
import type { Tablero, Circuito, FuenteAlimentacion } from '@/context/types'
import {
  calcularProyecto, type EntradaProyecto, type NetworkFeeder, type Transformer, type SyncGenerator, type Conductor,
} from '@/utils/cortocircuito'
import { seccionEnMm2, calcReactancia } from '@/utils/electricidad'

type Candidato = {
  red_alimentacion: NetworkFeeder
  transformadores: Transformer[]
  generadores: SyncGenerator[]
  conductores: Conductor[]
}

export type IccTablero = { Icc_max_kA: number | null; Icc_min_kA: number | null }

const nodoTablero = (id: number) => `T${id}`
const nivelTension = (t: Tablero) => t.tension_tri ?? t.tension_bi ?? t.tension_mono ?? null

// Mismo cálculo de Conductor que usa cortocircuitos/page.tsx por circuito — factorizado
// acá para reusarlo en el tramo de cable de un circuito ALIMENTADOR entre dos tableros.
export function conductorDeCircuito(c: Circuito, nodoA: string, nodoB: string): Conductor | null {
  const cable = c.formacion?.cable
  if (!cable || !c.Largo) return null
  const S = seccionEnMm2(cable.seccion_f, cable.calibre_tipo)
  if (!S || isNaN(S)) return null
  const familia = (cable as any).familia
  const material: 'COBRE' | 'ALUMINIO' = (familia?.material ?? '').toLowerCase().includes('alu') ? 'ALUMINIO' : 'COBRE'
  const xUnit = calcReactancia(cable.diametro, cable.seccion_f, cable.calibre_tipo, c.formacion?.disposicion ?? null, cable.Nfases)
  return {
    id: String(c.id), longitud: c.Largo, seccion: S,
    n_conductores_por_fase: c.formacion?.cond_por_fase ?? 1, material,
    reactancia_unitaria: xUnit != null ? xUnit / 1000 : undefined,
    nodo_a: nodoA, nodo_b: nodoB,
  }
}

// Unidades de FuentesSection.tsx (lo que carga el usuario) → unidades del motor (SI):
// RED: kV/MVA/kA. TRANSFORMADOR: primaria en kV, secundaria ya en V, potencia en kVA.
// GENERADOR: tensión ya en V, potencia en kVA.
function redDeFuente(f: FuenteAlimentacion, nodo: string): NetworkFeeder {
  return {
    id: String(f.id), nodo,
    tension_nominal: (f.tension_nominal ?? 0) * 1000,
    potencia_cc: f.potencia_cc != null ? f.potencia_cc * 1e6 : undefined,
    corriente_cc: f.corriente_cc != null ? f.corriente_cc * 1000 : undefined,
    relacion_rx: f.relacion_rx ?? undefined,
  }
}

function trafoDeFuente(f: FuenteAlimentacion, nodoHv: string, nodoLv: string): Transformer | null {
  if (f.potencia_nominal == null || f.tension_primaria == null || f.tension_nominal == null || f.ukr_porcentaje == null) return null
  return {
    id: String(f.id),
    potencia_nominal: f.potencia_nominal * 1000,
    tension_primaria: f.tension_primaria * 1000,
    tension_secundaria: f.tension_nominal,
    ukr_porcentaje: f.ukr_porcentaje,
    perdidas_cobre: f.perdidas_cobre_w ?? undefined,
    uRr_porcentaje: f.uRr_porcentaje ?? undefined,
    grupo_conexion: f.grupo_conexion ?? undefined,
    impedancia_homopolar_ratio: f.impedancia_homopolar_ratio ?? undefined,
    nodo_hv: nodoHv, nodo_lv: nodoLv,
  }
}

function generadorDeFuente(f: FuenteAlimentacion, nodo: string): SyncGenerator | null {
  if (f.potencia_nominal == null || f.tension_nominal == null || f.xd_subtransitoria_pct == null || f.factor_potencia == null) return null
  return {
    id: String(f.id),
    potencia_nominal: f.potencia_nominal * 1000,
    tension_nominal: f.tension_nominal,
    xd_subtransitoria_pct: f.xd_subtransitoria_pct,
    factor_potencia: f.factor_potencia,
    rg_sobre_xd: f.rg_sobre_xd ?? undefined,
    nodo,
  }
}

function candidatosPropios(tablero: Tablero): Candidato[] {
  const nodo = nodoTablero(tablero.id)
  const redes = tablero.fuentes.filter(f => f.tipo === 'RED')
  const trafos = tablero.fuentes.filter(f => f.tipo === 'TRANSFORMADOR')
  const generadores = tablero.fuentes.filter(f => f.tipo === 'GENERADOR')
  const candidatos: Candidato[] = []

  if (trafos.length > 0 && redes.length > 0) {
    for (const t of trafos) {
      const trafo = trafoDeFuente(t, `${nodo}_MT`, nodo)
      if (!trafo) continue
      candidatos.push({
        red_alimentacion: redDeFuente(redes[0], `${nodo}_MT`),
        transformadores: [trafo], generadores: [], conductores: [],
      })
    }
  } else {
    for (const r of redes) {
      candidatos.push({ red_alimentacion: redDeFuente(r, nodo), transformadores: [], generadores: [], conductores: [] })
    }
  }

  for (const g of generadores) {
    const gen = generadorDeFuente(g, nodo)
    if (!gen) continue
    // La red_alimentacion es obligatoria en el modelo del motor incluso sin red real —
    // se la ubica en un nodo sin aristas para que quede fuera del grafo alcanzable desde
    // la barra, y el generador queda como única fuente efectiva de este candidato.
    candidatos.push({
      red_alimentacion: { id: '__sin_red__', nodo: `${nodo}_AISLADO`, tension_nominal: nivelTension(tablero) ?? gen.tension_nominal, corriente_cc: 1e-6 },
      transformadores: [], generadores: [gen], conductores: [],
    })
  }

  return candidatos
}

function candidatosDe(tablero: Tablero, todos: Tablero[], visitados: Set<number>): Candidato[] {
  if (visitados.has(tablero.id)) return []
  visitados.add(tablero.id)

  const candidatos = candidatosPropios(tablero)

  // El front no trae la relación inversa (circuito_entrante) en el propio tablero —
  // se busca entre todos los circuitos del proyecto el ALIMENTADOR que apunta acá.
  const entrante = todos.flatMap(t => t.circuitos).find(c => c.tipo === 'ALIMENTADOR' && c.tablero_destino_id === tablero.id)
  if (entrante) {
    const origen = todos.find(t => t.id === entrante.tablero_id)
    if (origen) {
      const conductor = conductorDeCircuito(entrante, nodoTablero(origen.id), nodoTablero(tablero.id))
      if (conductor) {
        for (const c of candidatosDe(origen, todos, visitados)) {
          candidatos.push({ ...c, conductores: [...c.conductores, conductor] })
        }
      }
    }
  }

  return candidatos
}

export function calcularIccTablero(tablero: Tablero, todosTableros: Tablero[]): IccTablero {
  const nivel = nivelTension(tablero)
  if (!nivel) return { Icc_max_kA: null, Icc_min_kA: null }

  const candidatos = candidatosDe(tablero, todosTableros, new Set())
  if (candidatos.length === 0) return { Icc_max_kA: null, Icc_min_kA: null }

  let max: number | null = null, min: number | null = null
  for (const cand of candidatos) {
    try {
      const entrada: EntradaProyecto = {
        proyecto: { nombre: 'icc-tablero', frecuencia_hz: 50 },
        red_alimentacion: cand.red_alimentacion,
        transformadores: cand.transformadores,
        generadores: cand.generadores,
        motores: [],
        conductores: cand.conductores,
        puntos_falla: [
          { id: 'MAX', nodo: nodoTablero(tablero.id), tension_nominal: nivel, tipos_falla: ['TRIFASICA'], escenario: 'MAXIMO' },
          { id: 'MIN', nodo: nodoTablero(tablero.id), tension_nominal: nivel, tipos_falla: ['TRIFASICA'], escenario: 'MINIMO' },
        ],
      }
      const [rMax, rMin] = calcularProyecto(entrada)
      const ikMax = rMax.corrientes.Ik_inicial_A / 1000
      const ikMin = rMin.corrientes.Ik_inicial_A / 1000
      max = max == null ? ikMax : Math.max(max, ikMax)
      min = min == null ? ikMin : Math.min(min, ikMin)
    } catch {
      // Candidato con datos insuficientes o inconsistentes — se ignora, no rompe a los demás.
    }
  }
  return { Icc_max_kA: max, Icc_min_kA: min }
}
