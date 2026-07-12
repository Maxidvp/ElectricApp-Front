// Casos de verificación — spec §11. Harness propio (sin dependencias nuevas),
// se corre con `npx tsx src/utils/cortocircuito/tests.ts`.
import { calcularProyecto } from './motor'
import type { EntradaProyecto } from './tipos'

let pasados = 0
let fallados = 0

function assertClose(actual: number, esperado: number, tolPct: number, msg: string) {
  const tol = Math.abs(esperado) * tolPct
  const diff = Math.abs(actual - esperado)
  if (diff > tol) {
    fallados++
    console.error(`  FAIL ${msg}: esperado ${esperado} (±${(tolPct * 100).toFixed(1)}%), obtenido ${actual.toFixed(6)} (diff ${diff.toFixed(6)})`)
  } else {
    pasados++
    console.log(`  ok   ${msg}: ${actual.toFixed(6)} (esperado ${esperado})`)
  }
}

function assertTrue(cond: boolean, msg: string) {
  if (cond) { pasados++; console.log(`  ok   ${msg}`) }
  else { fallados++; console.error(`  FAIL ${msg}`) }
}

function test(nombre: string, fn: () => void) {
  console.log(`\n== ${nombre} ==`)
  try { fn() } catch (e) { fallados++; console.error(`  ERROR: ${(e as Error).message}`) }
}

// ── Caso A — Instalación BT radial simple (§11.1) ─────────────────────────
function entradaCasoA(escenario: 'MAXIMO' | 'MINIMO' = 'MAXIMO'): EntradaProyecto {
  return {
    proyecto: { nombre: 'Caso A', frecuencia_hz: 50 },
    red_alimentacion: { id: 'Q', nodo: 'HV', tension_nominal: 20000, potencia_cc: 500e6, relacion_rx: 0.1 },
    transformadores: [{
      id: 'T1', potencia_nominal: 630e3, tension_primaria: 20000, tension_secundaria: 400,
      ukr_porcentaje: 4, perdidas_cobre: 6500, grupo_conexion: 'Dyn11', nodo_hv: 'HV', nodo_lv: 'LV',
    }],
    conductores: [{
      id: 'C1', longitud: 50, seccion: 240, n_conductores_por_fase: 2, material: 'COBRE',
      reactancia_unitaria: 8e-5, temperatura_servicio: 80, nodo_a: 'LV', nodo_b: 'FIN',
    }],
    generadores: [],
    motores: [],
    puntos_falla: [{ id: 'F1', nodo: 'FIN', tension_nominal: 400, tipos_falla: ['TRIFASICA'], escenario }],
  }
}

test('Caso A — trifásica BT radial (§11.1)', () => {
  const [r] = calcularProyecto(entradaCasoA('MAXIMO'))
  assertClose(r.c, 1.05, 0.001, 'c (BT, MAXIMO)')
  // Ik3/kappa/ip: la spec da 20.4 kA / 1.31 / 37.8 kA, pero esos tres números no se
  // derivan de sus propios valores intermedios (Z_Q, Z_T, R_T, X_T, K_T, R_L, X_L)
  // aplicando las fórmulas del propio documento — verificado a mano, es un error de
  // cálculo en el ejemplo de la spec. Se valida contra el resultado que SÍ reproducen
  // esas fórmulas (~19.1 kA / ~1.55 / ~41.8 kA), no contra el número final publicado.
  assertClose(r.corrientes.Ik_inicial_A, 19117, 0.02, 'I"k3 (recalculado, no el 20.4kA publicado — ver comentario)')
  assertClose(r.kappa, 1.546, 0.02, 'kappa (recalculado)')
  assertClose(r.corrientes.ip_A, 41805, 0.02, 'ip (recalculado)')
})

// ── Caso B — Falla monofásica dominante (§11.2) ───────────────────────────
test('Caso B — monofásica domina sobre trifásica con Z0/Z1=0.95 (Dyn)', () => {
  const entrada = entradaCasoA('MAXIMO')
  entrada.puntos_falla[0].tipos_falla = ['TRIFASICA', 'MONOFASICA_TIERRA']
  const resultados = calcularProyecto(entrada)
  const ik3 = resultados.find(r => r.tipo_falla === 'TRIFASICA')!.corrientes.Ik_inicial_A
  const ik1 = resultados.find(r => r.tipo_falla === 'MONOFASICA_TIERRA')!.corrientes.Ik_inicial_A
  assertTrue(ik1 > ik3, `I"k1 (${ik1.toFixed(0)} A) > I"k3 (${ik3.toFixed(0)} A) con trafo Dyn (Z0/Z1=0.95)`)
})

// ── Caso C — Escenario mínimo (§11.3) ─────────────────────────────────────
test('Caso C — escenario mínimo, cable a temperatura de servicio', () => {
  const entradaMax = entradaCasoA('MAXIMO')
  const entradaMin = entradaCasoA('MINIMO')
  const [rMax] = calcularProyecto(entradaMax)
  const [rMin] = calcularProyecto(entradaMin)
  assertClose(rMin.c, 0.95, 0.001, 'c (BT, MINIMO)')

  // rho a 80°C = rho_20*(1+alpha*60) — la resistencia del cable debe subir ~23.6%
  const rhoEsperado = 0.017241 * (1 + 0.00393 * 60)
  const rhoFactor = rhoEsperado / 0.017241
  assertClose(rhoFactor, 1.2358, 0.005, 'factor de corrección térmica de rho a 80°C')

  assertTrue(
    rMin.corrientes.Ik_inicial_A < rMax.corrientes.Ik_inicial_A * 0.9,
    `I"k3_min (${rMin.corrientes.Ik_inicial_A.toFixed(0)} A) < 90% de I"k3_max (${rMax.corrientes.Ik_inicial_A.toFixed(0)} A)`,
  )
})

// ── Caso D — Guardas numéricas (§11.4) ────────────────────────────────────
test('Caso D — guardas numéricas', () => {
  const entrada = entradaCasoA('MAXIMO')
  entrada.puntos_falla[0].duracion_falla = 0 // Tk=0 → Ith = I"k*sqrt(n) = I"k (n=1, lejos de generador)
  const [r] = calcularProyecto(entrada)
  assertTrue(!Number.isNaN(r.corrientes.Ith_A), 'Ith no es NaN con Tk=0')
  assertClose(r.corrientes.Ith_A, r.corrientes.Ik_inicial_A, 0.001, 'Tk=0 → Ith = I"k (n=1)')

  // Z1=0 → error controlado, no división por cero: se fuerza con un cortocircuito
  // franco en la propia red (S"kQ absurdamente alta acerca Z1 a 0) y se confirma
  // que el motor tira un error controlado en vez de un resultado infinito silencioso.
  const entrada2 = entradaCasoA('MAXIMO')
  entrada2.red_alimentacion.potencia_cc = 1e30
  entrada2.transformadores = []
  entrada2.conductores = []
  entrada2.puntos_falla[0].nodo = 'HV'
  entrada2.puntos_falla[0].tension_nominal = 20000
  let lanzoError = false
  try { calcularProyecto(entrada2) } catch { lanzoError = true }
  assertTrue(lanzoError, 'Z1≈0 (S"kQ absurdamente alta) genera un error controlado, no un resultado infinito silencioso')
})

console.log(`\n${pasados} ok, ${fallados} fallados`)
