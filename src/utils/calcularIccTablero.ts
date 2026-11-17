// Deriva la Icc de barra de un tablero recorriendo su red aguas arriba, en vez de
// depender de un dato cargado a mano en el propio Tablero (ese campo legado se quitó).
//
// Reglas de conexión (una por tablero, evaluadas como caminos independientes — no se
// combinan en paralelo entre sí, se toma el peor caso entre todos):
//   - Fuente propia tipo RED + TRANSFORMADOR en el mismo tablero: el trafo es el último
//     elemento en serie antes de la barra, la red representa la MT vista desde su primario.
//   - Fuente propia tipo RED sola (sin trafo): alimenta la barra directamente.
//   - Fuente propia tipo GENERADOR: única fuente de ese camino.
//   - Circuito ALIMENTADOR entrante desde otro tablero: se hereda la red de ese tablero
//     (recursivamente) y se le agrega en serie el cable del propio circuito ALIMENTADOR.
//     Un tablero puede tener varios entrantes (barra partida, normal + emergencia): cada
//     uno es un camino más.
//   - Nada de lo anterior: sin datos, no se puede derivar (el llamador debe mostrar "—").
//
// Limitaciones conocidas — cada una se devuelve como aviso en `avisos`, nunca en silencio:
//   - UPS/PANEL_SOLAR no tienen fórmula de impedancia en el motor (fuentes limitadas
//     electrónicamente, fuera de IEC 60909-0) y se ignoran.
//   - Con más de una red y transformadores en un tablero, todos los trafos se emparejan
//     con la primera red.
//   - Varias fuentes se calculan por separado y NO se suman en paralelo: si operan a la
//     vez, la Icc máxima real es mayor que la informada.
//   - No se modela el estado de interruptores ni enclavamientos.
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
  // Camino de RESPALDO: solo llega a las cargas esenciales del tablero (las que están
  // arriba de una acometida que no es la principal). Ver "Fuentes de respaldo" abajo.
  respaldo?: boolean
}

// Icc_min_principal_kA: Icc mínima considerando solo los caminos de la alimentación
// principal (sin los de respaldo). Es la que corresponde a los circuitos NO esenciales,
// que en emergencia quedan fuera de servicio. Coincide con Icc_min_kA si el tablero no
// tiene caminos de respaldo.
export type IccTablero = { Icc_max_kA: number | null; Icc_min_kA: number | null; Icc_min_principal_kA?: number | null; avisos: string[] }

// ── Fuentes de respaldo ─────────────────────────────────────────────────────────
// En un tablero con más de una acometida, la última es la principal (alimenta todo) y las
// anteriores alimentan solo lo que tienen arriba (las cargas esenciales). Se toma como
// camino de respaldo:
//   - un GENERADOR propio del tablero, y
//   - un alimentador de otro tablero vinculado a una acometida que no es la principal.
// Un camino de respaldo no llega a los circuitos no esenciales ni a los tableros que
// cuelgan de ellos: un seccional alimentado desde la barra no esencial no ve al grupo.
const acometidasDe = (t: Tablero) => t.circuitos.filter(c => c.es_acometida && c.parent_id === null).sort((a, b) => a.orden - b.orden)

// ¿El circuito es esencial? = tiene debajo una acometida que no es la principal.
export function esCircuitoEsencial(c: Pick<Circuito, 'orden' | 'es_acometida'>, tablero: Tablero): boolean {
  const acometidas = acometidasDe(tablero)
  return acometidas.slice(0, -1).some(a => a.orden > c.orden || (c.es_acometida && a.orden === c.orden))
}

const nodoTablero = (id: number) => `T${id}`
const nivelTension = (t: Tablero) => t.tension_tri ?? t.tension_bi ?? t.tension_mono ?? null

// Mismo cálculo de Conductor que usa cortocircuitos/page.tsx por circuito — factorizado
// acá para reusarlo en el tramo de cable de un circuito ALIMENTADOR entre dos tableros.
export function conductorDeCircuito(c: Circuito, nodoA: string, nodoB: string): Conductor | null {
  const cable = c.formacion?.cable
  if (!cable || !c.Largo) return null
  const S = seccionEnMm2(cable.seccion_f, cable.calibre_tipo)
  if (!S || isNaN(S)) return null
  const material: 'COBRE' | 'ALUMINIO' = (cable.familia?.material ?? '').toLowerCase().includes('alu') ? 'ALUMINIO' : 'COBRE'
  const xUnit = calcReactancia(cable.diametro, cable.seccion_f, cable.calibre_tipo, c.formacion?.disposicion ?? null, cable.Nfases)
  return {
    id: String(c.id), longitud: c.Largo, seccion: S,
    n_conductores_por_fase: c.formacion?.cond_por_fase ?? 1, material,
    reactancia_unitaria: xUnit != null ? xUnit / 1000 : undefined,
    // Para Icc mínima el motor corrige R a la temperatura máxima de servicio del cable;
    // sin este dato la calculaba a 20 °C y la Icc mínima salía sobrestimada.
    temperatura_servicio: cable.familia?.temperatura ?? undefined,
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

function candidatosPropios(tablero: Tablero, avisar: (msg: string) => void): Candidato[] {
  const nodo = nodoTablero(tablero.id)
  const tag = tablero.tag
  const ignoradas = tablero.fuentes.filter(f => f.tipo === 'UPS' || f.tipo === 'PANEL_SOLAR')
  if (ignoradas.length)
    avisar(`${tag}: ${ignoradas.map(f => f.tipo === 'UPS' ? 'UPS' : 'panel solar').join(', ')} no entra en el cálculo (fuente limitada electrónicamente, fuera de IEC 60909-0).`)
  const redes = tablero.fuentes.filter(f => f.tipo === 'RED')
  const trafos = tablero.fuentes.filter(f => f.tipo === 'TRANSFORMADOR')
  const generadores = tablero.fuentes.filter(f => f.tipo === 'GENERADOR')
  const candidatos: Candidato[] = []

  if (trafos.length > 0 && redes.length > 0) {
    if (redes.length > 1 && trafos.length > 1)
      avisar(`${tag}: hay ${redes.length} redes y ${trafos.length} transformadores; todos los transformadores se calcularon colgando de la primera red.`)
    for (const t of trafos) {
      const trafo = trafoDeFuente(t, `${nodo}_MT`, nodo)
      if (!trafo) { avisar(`${tag}: un transformador con datos incompletos quedó afuera del cálculo.`); continue }
      candidatos.push({
        red_alimentacion: redDeFuente(redes[0], `${nodo}_MT`),
        transformadores: [trafo], generadores: [], conductores: [],
      })
    }
  } else {
    if (trafos.length > 0)
      avisar(`${tag}: hay transformador pero ninguna red cargada aguas arriba; el transformador no entra en el cálculo.`)
    for (const r of redes) {
      candidatos.push({ red_alimentacion: redDeFuente(r, nodo), transformadores: [], generadores: [], conductores: [] })
    }
  }

  for (const g of generadores) {
    const gen = generadorDeFuente(g, nodo)
    if (!gen) { avisar(`${tag}: un generador con datos incompletos quedó afuera del cálculo.`); continue }
    // La red_alimentacion es obligatoria en el modelo del motor incluso sin red real —
    // se la ubica en un nodo sin aristas para que quede fuera del grafo alcanzable desde
    // la barra, y el generador queda como única fuente efectiva de este candidato.
    candidatos.push({
      red_alimentacion: { id: '__sin_red__', nodo: `${nodo}_AISLADO`, tension_nominal: nivelTension(tablero) ?? gen.tension_nominal, corriente_cc: 1e-6 },
      transformadores: [], generadores: [gen], conductores: [],
      // Con una sola acometida el generador alimenta todo el tablero: no es "respaldo".
      respaldo: acometidasDe(tablero).length > 1,
    })
  }

  return candidatos
}

function candidatosDe(tablero: Tablero, todos: Tablero[], visitados: Set<number>, avisar: (msg: string) => void): Candidato[] {
  if (visitados.has(tablero.id)) return []
  // Copia por rama: `visitados` solo corta ciclos dentro de UN camino. Si fuera
  // compartido, dos alimentadores que vienen del mismo tablero darían un solo camino.
  const enCamino = new Set(visitados).add(tablero.id)

  const candidatos = candidatosPropios(tablero, avisar)

  // El front no trae la relación inversa (circuito_entrante) en el propio tablero —
  // se busca entre todos los circuitos del proyecto el ALIMENTADOR que apunta acá.
  const entrantes = todos.flatMap(t => t.circuitos).filter(c => c.tipo === 'ALIMENTADOR' && c.tablero_destino_id === tablero.id)
  for (const entrante of entrantes) {
    const origen = todos.find(t => t.id === entrante.tablero_id)
    if (!origen) continue
    const conductor = conductorDeCircuito(entrante, nodoTablero(origen.id), nodoTablero(tablero.id))
    if (conductor) {
      // Los caminos de respaldo del origen solo siguen por este alimentador si sale de
      // su barra esencial. Para este tablero, lo que llega es respaldo si el alimentador
      // está vinculado a una acometida que no es la principal.
      const esencialEnOrigen = esCircuitoEsencial(entrante, origen)
      const principal = acometidasDe(tablero).slice(-1)[0]
      const respaldo = entrante.acometida_destino_id != null && principal != null && entrante.acometida_destino_id !== principal.id
        && acometidasDe(tablero).some(a => a.id === entrante.acometida_destino_id)
      for (const c of candidatosDe(origen, todos, enCamino, avisar)) {
        if (c.respaldo && !esencialEnOrigen) continue
        candidatos.push({ ...c, conductores: [...c.conductores, conductor], respaldo })
      }
    } else {
      avisar(`${tablero.tag}: el alimentador ${entrante.circuito} desde ${origen.tag} no tiene cable o largo cargado; lo que viene por él no entra en el cálculo.`)
    }
  }

  return candidatos
}

export function calcularIccTablero(tablero: Tablero, todosTableros: Tablero[]): IccTablero {
  const avisos: string[] = []
  const avisar = (msg: string) => { if (!avisos.includes(msg)) avisos.push(msg) }

  const nivel = nivelTension(tablero)
  if (!nivel) return { Icc_max_kA: null, Icc_min_kA: null, avisos: ['El tablero no tiene tensión cargada.'] }

  const candidatos = candidatosDe(tablero, todosTableros, new Set(), avisar)
  if (candidatos.length === 0) return { Icc_max_kA: null, Icc_min_kA: null, avisos }
  if (candidatos.length > 1)
    avisar(`Hay ${candidatos.length} fuentes posibles; se calculó cada una por separado, sin sumarlas en paralelo ni considerar el estado de los interruptores. Si operan a la vez, la Icc máxima real es mayor que la informada.`)

  let max: number | null = null, min: number | null = null, minPrincipal: number | null = null
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
      // La red ficticia de un camino con generador solo existe para el motor de cálculo: sus avisos no dicen nada del proyecto.
      for (const a of [...rMax.advertencias, ...rMin.advertencias]) if (!a.includes('__sin_red__')) avisar(a)
      const ikMax = rMax.corrientes.Ik_inicial_A / 1000
      const ikMin = rMin.corrientes.Ik_inicial_A / 1000
      max = max == null ? ikMax : Math.max(max, ikMax)
      min = min == null ? ikMin : Math.min(min, ikMin)
      if (!cand.respaldo) minPrincipal = minPrincipal == null ? ikMin : Math.min(minPrincipal, ikMin)
    } catch (e) {
      // Candidato con datos insuficientes o inconsistentes — no rompe a los demás, pero se avisa.
      avisar(`Una fuente quedó afuera por datos inconsistentes: ${(e as Error).message}`)
    }
  }
  return { Icc_max_kA: max, Icc_min_kA: min, Icc_min_principal_kA: minPrincipal ?? min, avisos }
}
