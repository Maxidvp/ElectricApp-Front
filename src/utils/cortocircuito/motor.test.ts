// Tests del motor IEC 60909-0. Los valores esperados están calculados a mano con
// las fórmulas de la norma (el cálculo está en cada comentario), nunca copiados
// de la salida del motor.
import { describe, expect, it } from 'vitest'
import { calcularProyecto } from './motor'
import type { EntradaProyecto } from './tipos'

function cerca(actual: number, esperado: number, tol = 0.005) {
  expect(Math.abs(actual - esperado) / Math.abs(esperado)).toBeLessThanOrEqual(tol)
}

// Caso A — instalación BT radial: red 20 kV / 500 MVA → trafo 630 kVA Dyn11 →
// 50 m de 2×240 mm² Cu → falla en el extremo.
function casoA(escenario: 'MAXIMO' | 'MINIMO' = 'MAXIMO'): EntradaProyecto {
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

describe('Caso A — trifásica BT radial', () => {
  // Cálculo a mano, todo referido a 400 V:
  //   Red:   ZQ = cQ·UnQ²/S"kQ / t² = 1.1·20000²/500e6 / 50² = 0.352 mΩ
  //          XQ = ZQ/√(1+0.1²) = 0.3503 mΩ,  RQ = 0.1·XQ = 0.0350 mΩ
  //   Trafo: ZT = 0.04·400²/630e3 = 10.159 mΩ,  RT = 6500·400²/630e3² = 2.620 mΩ
  //          XT = √(ZT²−RT²) = 9.815 mΩ,  xT = 0.03865
  //          KT = 0.95·cmax/(1+0.6·xT) = 0.95·1.05/1.02319 = 0.97489   (§6.3.3)
  //   Cable: RL = 0.017241·50/(240·2) = 1.796 mΩ,  XL = 0.08·50/2 = 2.000 mΩ
  //   Total: R = 4.3855 mΩ,  X = 11.9188 mΩ,  Z = 12.700 mΩ
  //   I"k3 = c·Un/(√3·Z) = 1.05·400/(√3·12.700 mΩ) = 19 093 A
  //   κ (método B) = 1.15·(1.02 + 0.98·e^(−3·0.36795)) = 1.5467
  //   ip = κ·√2·I"k = 41 765 A
  // (El ejemplo de la spec publicaba 20.4 kA / 1.31 / 37.8 kA, pero esos números
  // no salen de sus propios valores intermedios.)
  const [r] = calcularProyecto(casoA('MAXIMO'))

  it('c = 1.05 (BT, máximo, tolerancia 6 %)', () => expect(r.c).toBeCloseTo(1.05, 6))
  it('I"k3 = 19 093 A', () => cerca(r.corrientes.Ik_inicial_A, 19093))
  it('κ = 1.547 (método B)', () => cerca(r.kappa, 1.5467))
  it('ip = 41 765 A', () => cerca(r.corrientes.ip_A, 41765))
})

describe('Caso B — falla monofásica con trafo Dyn', () => {
  it('I"k1 > I"k3 cuando Z0/Z1 del trafo es 0.95', () => {
    const entrada = casoA('MAXIMO')
    entrada.puntos_falla[0].tipos_falla = ['TRIFASICA', 'MONOFASICA_TIERRA']
    const res = calcularProyecto(entrada)
    const ik3 = res.find(r => r.tipo_falla === 'TRIFASICA')!.corrientes.Ik_inicial_A
    const ik1 = res.find(r => r.tipo_falla === 'MONOFASICA_TIERRA')!.corrientes.Ik_inicial_A
    expect(ik1).toBeGreaterThan(ik3)
  })
})

describe('Caso C — escenario mínimo', () => {
  const [rMax] = calcularProyecto(casoA('MAXIMO'))
  const [rMin] = calcularProyecto(casoA('MINIMO'))

  it('c = 0.95 (BT, mínimo)', () => expect(rMin.c).toBeCloseTo(0.95, 6))

  it('I"k3 mín. ≈ 17.07 kA con el cable a 80 °C', () => {
    // RL80 = 1.796 · (1 + 0.00393·60) = 2.219 mΩ → R = 4.809 mΩ, X = 11.919 mΩ
    // I"k3min = 0.95·400/(√3·12.853 mΩ) = 17 070 A. La red de MT y KT no cambian
    // entre escenarios en este caso; tolerancia 1 % por cómo se toma cQ en mínimo.
    cerca(rMin.corrientes.Ik_inicial_A, 17070, 0.01)
  })

  it('el mínimo queda por debajo del 90 % del máximo', () => {
    expect(rMin.corrientes.Ik_inicial_A).toBeLessThan(rMax.corrientes.Ik_inicial_A * 0.9)
  })
})

describe('Caso D — guardas numéricas', () => {
  it('Tk = 0 → Ith = I"k (lejos de generador, n = 1, m ≈ 0)', () => {
    const entrada = casoA('MAXIMO')
    entrada.puntos_falla[0].duracion_falla = 0
    const [r] = calcularProyecto(entrada)
    expect(Number.isNaN(r.corrientes.Ith_A)).toBe(false)
    cerca(r.corrientes.Ith_A, r.corrientes.Ik_inicial_A, 0.001)
  })

  it('Z1 ≈ 0 tira un error controlado en vez de devolver infinito', () => {
    const entrada = casoA('MAXIMO')
    entrada.red_alimentacion.potencia_cc = 1e30
    entrada.transformadores = []
    entrada.conductores = []
    entrada.puntos_falla[0].nodo = 'HV'
    entrada.puntos_falla[0].tension_nominal = 20000
    expect(() => calcularProyecto(entrada)).toThrow()
  })
})
