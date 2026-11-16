// Algoritmo principal — spec §9. Núcleo puro: entrada = objeto, salida = objeto,
// sin I/O (spec §12.5). La integración con los datos reales (Tablero/Circuito/
// FuenteAlimentacion, ya cargados en ProyectosContext) es una capa aparte que
// todavía no existe — este módulo no sabe nada de la app, solo del modelo abstracto.
import { C, type Complex } from './complex'
import { obtenerC, type Escenario } from './constantes'
import type { EntradaProyecto, FaultPoint, ResultadoFalla, TipoFalla, SyncGenerator, AsyncMotor } from './tipos'
import { impedanciaRed, impedanciaGenerador, impedanciaMotor, corrienteNominalGenerador } from './elementos'
import { construirImpedancias, agregarFuentesMotores, reducirEnNodo, caminoEntre, type Grafo } from './red'
import { calcularKappa, calcularIp, calcularMu, calcularQMotor, calcularM, calcularN } from './derivadas'
import { validarEntrada } from './validaciones'

// §6.2 — Corriente inicial simétrica de cortocircuito, según tipo de falla
function corrienteInicial(tipo: TipoFalla, c: number, Un: number, Z1: Complex, Z2: Complex, Z0: Complex | null): number {
  switch (tipo) {
    case 'TRIFASICA':
      return (c * Un) / (Math.sqrt(3) * C.abs(Z1))
    case 'BIFASICA':
      return (c * Un) / C.abs(C.add(Z1, Z2))
    case 'BIFASICA_TIERRA': {
      if (!Z0) throw new Error('Falla BIFASICA_TIERRA requiere Z0')
      const denom = C.add(C.add(C.mul(Z1, Z2), C.mul(Z1, Z0)), C.mul(Z2, Z0))
      return (Math.sqrt(3) * c * Un * C.abs(Z0)) / C.abs(denom)
    }
    case 'MONOFASICA_TIERRA': {
      if (!Z0) throw new Error('Falla MONOFASICA_TIERRA requiere Z0')
      return (Math.sqrt(3) * c * Un) / C.abs(C.add(C.add(Z1, Z2), Z0))
    }
  }
}

export function calcularProyecto(entrada: EntradaProyecto): ResultadoFalla[] {
  validarEntrada(entrada)
  const resultados: ResultadoFalla[] = []
  const f = entrada.proyecto.frecuencia_hz
  const btTolerancia10 = entrada.proyecto.bt_tolerancia_10pct ?? false

  for (const punto of entrada.puntos_falla) {
    const escenarios: Escenario[] = punto.escenario === 'AMBOS' ? ['MAXIMO', 'MINIMO'] : [punto.escenario]
    for (const esc of escenarios) resultados.push(...calcularPuntoEscenario(entrada, punto, esc, f, btTolerancia10))
  }
  return resultados
}

// Impedancia "propia" (ya referida a Un) de cada fuente, usada para aislar el
// aporte individual de cada una — red.ts solo guarda el total combinado por nodo.
function impedanciaPropiaRed(entrada: EntradaProyecto, esc: Escenario, Un: number, btTolerancia10: boolean): Complex {
  return impedanciaRed(entrada.red_alimentacion, esc, Un, btTolerancia10).Z1
}

type AporteGenerador = { fraccion: number; IkG: number; IrG: number }
type AporteMotor = { fraccion: number; mPorPolo: number }

type Fracciones = {
  fraccionRed: number
  generadores: AporteGenerador[]
  motores: AporteMotor[]
  fraccionMotoresTotal: number
}

// Descompone I"k trifásica en el aporte fraccional de cada fuente (red, cada
// generador, cada motor), tratando el camino propio de cada una en aislamiento
// (aproximación estándar de la norma para separar aportes por fuente — no es
// superposición rigurosa con carga cruzada; ver comentario en red.ts:caminoEntre).
// Estas fracciones se reusan para Ib en cualquier tipo de falla, asumiendo que el
// comportamiento de decaimiento de cada fuente no depende del tipo de falla.
function calcularFraccionesFuente(
  entrada: EntradaProyecto, grafo: Grafo, nodoFalla: string,
  c: number, Un: number, Ik3_total: number, incluyeMotores: boolean, esc: Escenario, btTolerancia10: boolean,
): Fracciones {
  const red = entrada.red_alimentacion
  const ZbranchRed = C.add(impedanciaPropiaRed(entrada, esc, Un, btTolerancia10), caminoEntre(grafo, red.nodo, nodoFalla))
  const IkRed = (c * Un) / (Math.sqrt(3) * C.abs(ZbranchRed))

  const generadores: AporteGenerador[] = entrada.generadores.map((g: SyncGenerator) => {
    const Zbranch = C.add(impedanciaGenerador(g, Un, btTolerancia10).Z1, caminoEntre(grafo, g.nodo, nodoFalla))
    const IkG = (c * Un) / (Math.sqrt(3) * C.abs(Zbranch))
    return { fraccion: IkG / Ik3_total, IkG, IrG: corrienteNominalGenerador(g) }
  })

  const motores: AporteMotor[] = incluyeMotores
    ? entrada.motores.map((m: AsyncMotor) => {
        const Zbranch = C.add(impedanciaMotor(m).Z1, caminoEntre(grafo, m.nodo, nodoFalla))
        const IkM = (c * Un) / (Math.sqrt(3) * C.abs(Zbranch))
        const mPorPolo = m.potencia_nominal / 1e6 / (m.pares_de_polos ?? 1)
        return { fraccion: IkM / Ik3_total, mPorPolo }
      })
    : []

  const fraccionMotoresTotal = motores.reduce((s, m) => s + m.fraccion, 0)
  return { fraccionRed: IkRed / Ik3_total, generadores, motores, fraccionMotoresTotal }
}

function calcularIb(fracciones: Fracciones, Ik_ini: number, tMin: number): { Ib: number; cercaDeGenerador: boolean } {
  let Ib = fracciones.fraccionRed * Ik_ini // red: lejos de generador, sin decaimiento
  let cercaDeGenerador = false
  const mus: number[] = []

  for (const gen of fracciones.generadores) {
    const q = gen.IkG / gen.IrG
    const mu = calcularMu(tMin, q)
    mus.push(mu)
    if (gen.IkG > 2 * gen.IrG) cercaDeGenerador = true
    Ib += mu * gen.fraccion * Ik_ini
  }

  // §8.3: la fórmula de Ib_M reusa "mu", pero no queda definido cuál si no hay
  // generador — se usa el promedio de los mu de generadores si existen, y 1 si no.
  const muParaMotores = mus.length > 0 ? mus.reduce((s, m) => s + m, 0) / mus.length : 1
  for (const mot of fracciones.motores) {
    const q = calcularQMotor(tMin, mot.mPorPolo)
    Ib += muParaMotores * q * mot.fraccion * Ik_ini
  }

  return { Ib, cercaDeGenerador }
}

function calcularPuntoEscenario(
  entrada: EntradaProyecto, punto: FaultPoint, esc: Escenario, f: number, btTolerancia10: boolean,
): ResultadoFalla[] {
  const advertenciasComunes: string[] = []
  const c = obtenerC(punto.tension_nominal, esc, btTolerancia10)
  const Un = punto.tension_nominal

  // Las advertencias sobre Z0 solo importan si se pidió alguna falla a tierra:
  // en una trifásica son ruido y tapan los avisos que sí cambian el resultado.
  const necesitaZ0 = punto.tipos_falla.some(t => t === 'BIFASICA_TIERRA' || t === 'MONOFASICA_TIERRA')
  const impedancias = construirImpedancias(entrada, esc, Un)
  advertenciasComunes.push(...impedancias.advertencias.filter(a => necesitaZ0 || !a.includes('Z0')))

  // 1) Z1 sin motores, para evaluar el criterio de inclusión §5.6
  const Z1_sin_motores = reducirEnNodo(impedancias.grafo, impedancias.fuentesZ1, punto.nodo, false)
  if (C.abs(Z1_sin_motores) < 1e-9)
    throw new Error(`Punto de falla "${punto.id}": impedancia nula, corriente infinita`)
  const Ik3_sin_motores = (c * Un) / (Math.sqrt(3) * C.abs(Z1_sin_motores))

  let fuentesZ1 = impedancias.fuentesZ1
  let incluyeMotores = false
  if (esc === 'MAXIMO' && entrada.motores.length > 0 && impedancias.motorIrTotal > 0.01 * Ik3_sin_motores) {
    fuentesZ1 = agregarFuentesMotores(impedancias, entrada, Un).fuentesConMotores
    incluyeMotores = true
  } else if (entrada.motores.length > 0) {
    advertenciasComunes.push('Motores excluidos: no superan el 1% de I"k sin motores, o escenario MINIMO (§5.6/§9.1)')
  }

  // 2) Z1 final (con motores si corresponde) — spec §6.1: Z2 ≈ Z1
  const Z1 = reducirEnNodo(impedancias.grafo, fuentesZ1, punto.nodo, false)
  if (C.abs(Z1) < 1e-9) throw new Error(`Punto de falla "${punto.id}": impedancia nula, corriente infinita`)
  const Z2 = Z1

  // 3) Z0 (solo si hace falta para alguna falla a tierra pedida)
  const Z0 = necesitaZ0 ? reducirEnNodo(impedancias.grafo, impedancias.fuentesZ0, punto.nodo, true) : null

  const rx = Z1.im !== 0 ? Z1.re / Z1.im : 0
  const kappa = calcularKappa(rx, Un)

  // I"k trifásica de referencia: la usan Sk/Ib/Ik_permanente/Ith como base de las
  // proporciones red/generador/motor, sea o no TRIFASICA uno de los tipos pedidos.
  const Ik3_total = (c * Un) / (Math.sqrt(3) * C.abs(Z1))
  const fracciones = calcularFraccionesFuente(entrada, impedancias.grafo, punto.nodo, c, Un, Ik3_total, incluyeMotores, esc, btTolerancia10)

  const resultados: ResultadoFalla[] = []
  for (const tipo of punto.tipos_falla) {
    const advertencias = [...advertenciasComunes]
    const Ik_ini = corrienteInicial(tipo, c, Un, Z1, Z2, Z0)
    const Sk = Math.sqrt(3) * Un * Ik_ini
    const ip = calcularIp(kappa, Ik_ini)
    const Tk = punto.duracion_falla ?? 1.0
    const tMin = punto.tiempo_minimo_apertura ?? 0.1

    const { Ib, cercaDeGenerador } = calcularIb(fracciones, Ik_ini, tMin)
    const Ik_permanente = Ik_ini * (1 - fracciones.fraccionMotoresTotal)
    if (cercaDeGenerador)
      advertencias.push('Ik permanente cerca de generador: no se implementan las curvas λ (fig. 18/19, no provistas por la especificación); se aproximó con I"k')

    const m = calcularM(kappa, f, Tk)
    const n = calcularN(cercaDeGenerador)
    if (cercaDeGenerador)
      advertencias.push('Factor térmico n cerca de generador: no se implementan las curvas de la fig. 22 (no provistas); se usó n=1 (conservador)')
    const Ith = Ik_ini * Math.sqrt(m + n)

    resultados.push({
      punto_falla_id: punto.id,
      escenario: esc,
      tipo_falla: tipo,
      c,
      Z1, Z2, Z0,
      rx_ratio: rx,
      kappa,
      corrientes: {
        Ik_inicial_A: Ik_ini,
        Sk_VA: Sk,
        ip_A: ip,
        Ib_A: Ib,
        Ik_permanente_A: Ik_permanente,
        Ith_A: Ith,
      },
      advertencias,
    })
  }
  return resultados
}
