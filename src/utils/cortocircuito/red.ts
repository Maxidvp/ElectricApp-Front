// Construcción del grafo de la red y reducción a Thévenin en el nodo de falla — spec §6.
//
// Estrategia (redes radiales, §6.1): la red física (transformadores + conductores)
// forma un árbol. Las fuentes (red, generadores, motores) son ramas que "cuelgan"
// de un nodo hacia una referencia común. Para hallar Z1 visto desde el nodo de
// falla se reduce el árbol recursivamente: en cada nodo, la impedancia hacia el
// resto de la red es el PARALELO de (su propia fuente, si tiene) con (para cada
// vecino: impedancia del tramo + reducción recursiva de ese vecino). Esto es
// series/paralelo aplicado de forma general a un árbol con múltiples fuentes,
// sin asumir que las fuentes no comparten tramos del camino hacia la falla.
import { C, type Complex } from './complex'
import type { Escenario } from './constantes'
import type { EntradaProyecto } from './tipos'
import {
  impedanciaRed, impedanciaTransformador, impedanciaConductor, impedanciaGenerador, impedanciaMotor,
  corrienteNominalMotor,
} from './elementos'

export type Arista = { hasta: string; Z1: Complex; Z0: Complex | null }
export type Grafo = Map<string, Arista[]>

function agregarArista(grafo: Grafo, a: string, b: string, Z1: Complex, Z0: Complex | null) {
  if (!grafo.has(a)) grafo.set(a, [])
  if (!grafo.has(b)) grafo.set(b, [])
  grafo.get(a)!.push({ hasta: b, Z1, Z0 })
  grafo.get(b)!.push({ hasta: a, Z1, Z0 })
}

// Nivel de tensión nominal de cada nodo, propagado desde la red de alimentación
// a través de transformadores (cambian de nivel) y conductores (mismo nivel).
function asignarNiveles(entrada: EntradaProyecto): Map<string, number> {
  const niveles = new Map<string, number>()
  const vecinos = new Map<string, { hasta: string; nivelHasta?: 'igual' | number }[]>()

  const link = (a: string, b: string, nivelB?: number) => {
    if (!vecinos.has(a)) vecinos.set(a, [])
    vecinos.get(a)!.push({ hasta: b, nivelHasta: nivelB ?? 'igual' })
  }
  for (const t of entrada.transformadores) {
    link(t.nodo_hv, t.nodo_lv, t.tension_secundaria)
    link(t.nodo_lv, t.nodo_hv, t.tension_primaria)
  }
  for (const cnd of entrada.conductores) {
    link(cnd.nodo_a, cnd.nodo_b)
    link(cnd.nodo_b, cnd.nodo_a)
  }

  const raiz = entrada.red_alimentacion.nodo
  niveles.set(raiz, entrada.red_alimentacion.tension_nominal)
  const cola = [raiz]
  while (cola.length > 0) {
    const nodo = cola.shift()!
    const nivelActual = niveles.get(nodo)!
    for (const v of vecinos.get(nodo) ?? []) {
      if (niveles.has(v.hasta)) continue
      niveles.set(v.hasta, v.nivelHasta === 'igual' ? nivelActual : (v.nivelHasta as number))
      cola.push(v.hasta)
    }
  }

  // Generadores y motores en nodos no alcanzados desde la red (ej. isla generadora
  // aislada en la entrada, caso atípico) toman su propio nivel nominal.
  for (const g of entrada.generadores) if (!niveles.has(g.nodo)) niveles.set(g.nodo, g.tension_nominal)
  for (const m of entrada.motores) if (!niveles.has(m.nodo)) niveles.set(m.nodo, m.tension_nominal)

  return niveles
}

function referir(Z: Complex, nivelOrigen: number, nivelDestino: number): Complex {
  if (!Number.isFinite(nivelOrigen) || nivelOrigen === 0) return Z
  return C.mulR(Z, (nivelDestino / nivelOrigen) ** 2)
}

export type ImpedanciasRed = {
  grafo: Grafo
  fuentesZ1: Map<string, Complex[]>
  fuentesZ0: Map<string, Complex[]>
  niveles: Map<string, number>
  advertencias: string[]
  motorIrTotal: number
}

// Arma el grafo completo (impedancias ya referidas al nivel de tensión de la falla)
// pero sin decidir todavía si los motores entran o no — eso se resuelve en motor.ts
// aplicando el criterio de inclusión (§5.6) sobre este mismo grafo.
export function construirImpedancias(
  entrada: EntradaProyecto, escenario: Escenario, Un_falla: number,
): ImpedanciasRed {
  const advertencias: string[] = []
  const btTolerancia10 = entrada.proyecto.bt_tolerancia_10pct ?? false
  const niveles = asignarNiveles(entrada)
  const grafo: Grafo = new Map()
  const fuentesZ1: Map<string, Complex[]> = new Map()
  const fuentesZ0: Map<string, Complex[]> = new Map()

  const addFuente = (mapa: Map<string, Complex[]>, nodo: string, Z: Complex) => {
    if (!mapa.has(nodo)) mapa.set(nodo, [])
    mapa.get(nodo)!.push(Z)
  }

  // Red de alimentación
  const red = impedanciaRed(entrada.red_alimentacion, escenario, Un_falla, btTolerancia10)
  advertencias.push(...red.advertencias)
  addFuente(fuentesZ1, entrada.red_alimentacion.nodo, referir(red.Z1, red.nivel, Un_falla))
  addFuente(fuentesZ0, entrada.red_alimentacion.nodo, referir(red.Z0, red.nivel, Un_falla))

  // Transformadores (tramo entre nodo_hv y nodo_lv)
  for (const t of entrada.transformadores) {
    const r = impedanciaTransformador(t, btTolerancia10)
    advertencias.push(...r.advertencias)
    agregarArista(grafo, t.nodo_hv, t.nodo_lv, referir(r.Z1, r.nivel, Un_falla), referir(r.Z0, r.nivel, Un_falla))
  }

  // Conductores (tramo entre nodo_a y nodo_b, al nivel del nodo donde están)
  for (const cnd of entrada.conductores) {
    const r = impedanciaConductor(cnd, escenario)
    advertencias.push(...r.advertencias)
    const nivelPropio = niveles.get(cnd.nodo_a) ?? niveles.get(cnd.nodo_b) ?? Un_falla
    agregarArista(grafo, cnd.nodo_a, cnd.nodo_b, referir(r.Z1, nivelPropio, Un_falla), referir(r.Z1, nivelPropio, Un_falla))
  }

  // Generadores síncronos: su Z1 corregida ya está referida a Un_falla (K_G la incluye).
  // No contribuyen a la red homopolar: su puesta a tierra no está modelada (§5.4/§6.1).
  for (const g of entrada.generadores) {
    const r = impedanciaGenerador(g, Un_falla, btTolerancia10)
    advertencias.push(...r.advertencias)
    addFuente(fuentesZ1, g.nodo, r.Z1)
  }

  // Motores: se calculan siempre acá; motor.ts decide si se incluyen (§5.6, y solo en MAXIMO)
  let motorIrTotal = 0
  for (const m of entrada.motores) {
    motorIrTotal += corrienteNominalMotor(m)
  }

  return { grafo, fuentesZ1, fuentesZ0, niveles, advertencias, motorIrTotal }
}

export function agregarFuentesMotores(
  impedancias: ImpedanciasRed, entrada: EntradaProyecto, Un_falla: number,
): { fuentesConMotores: Map<string, Complex[]>; contribucionMotorPorNodo: Map<string, Complex> } {
  const fuentesConMotores = new Map<string, Complex[]>()
  for (const [nodo, zs] of impedancias.fuentesZ1) fuentesConMotores.set(nodo, [...zs])
  const contribucionMotorPorNodo = new Map<string, Complex>()

  for (const m of entrada.motores) {
    const r = impedanciaMotor(m)
    const nivelPropio = impedancias.niveles.get(m.nodo) ?? m.tension_nominal
    const Z = referir(r.Z1, nivelPropio, Un_falla)
    if (!fuentesConMotores.has(m.nodo)) fuentesConMotores.set(m.nodo, [])
    fuentesConMotores.get(m.nodo)!.push(Z)
    contribucionMotorPorNodo.set(m.id, Z)
  }
  return { fuentesConMotores, contribucionMotorPorNodo }
}

// Reducción recursiva serie/paralelo del árbol, vista desde `nodoFalla`.
export function reducirEnNodo(
  grafo: Grafo, fuentes: Map<string, Complex[]>, nodoFalla: string, homopolar = false,
): Complex {
  const visitados = new Set<string>()

  function sub(nodo: string, vieneDe: string | null): Complex | null {
    visitados.add(nodo)
    const ramas: Complex[] = []

    for (const z of fuentes.get(nodo) ?? []) ramas.push(z)

    for (const arista of grafo.get(nodo) ?? []) {
      if (arista.hasta === vieneDe || visitados.has(arista.hasta)) continue
      const zTramo = homopolar ? arista.Z0 : arista.Z1
      if (zTramo === null) continue // sin continuidad homopolar por este tramo
      const zSub = sub(arista.hasta, nodo)
      if (zSub !== null) ramas.push(C.add(zTramo, zSub))
    }

    if (ramas.length === 0) return null
    return C.parallel(...ramas)
  }

  const resultado = sub(nodoFalla, null)
  if (resultado === null)
    throw new Error(`El nodo de falla "${nodoFalla}" no está conectado a ninguna fuente (grafo no conexo)`)
  return resultado
}

// Camino único (suma en serie de los tramos físicos) entre dos nodos del árbol.
// Se usa para aislar el aporte individual de cada fuente (generador/motor) a
// I"k — igual que hace la propia norma en sus ejemplos: cada máquina se trata
// como si alimentara la falla por su propio camino, sin corrección de carga
// cruzada de otras fuentes (aproximación estándar, no rigurosa por superposición).
export function caminoEntre(grafo: Grafo, desde: string, hasta: string): Complex {
  const visitados = new Set<string>([desde])
  function dfs(nodo: string, acumulado: Complex): Complex | null {
    if (nodo === hasta) return acumulado
    for (const arista of grafo.get(nodo) ?? []) {
      if (visitados.has(arista.hasta)) continue
      visitados.add(arista.hasta)
      const r = dfs(arista.hasta, C.add(acumulado, arista.Z1))
      if (r !== null) return r
    }
    return null
  }
  const resultado = dfs(desde, C.of(0, 0))
  if (resultado === null) throw new Error(`No hay camino entre "${desde}" y "${hasta}" en el grafo`)
  return resultado
}
