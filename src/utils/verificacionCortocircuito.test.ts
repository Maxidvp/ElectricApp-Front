// Verificación de cortocircuito por circuito. Valores esperados calculados a mano
// (el cálculo está en cada comentario), nunca copiados de la salida de la app.
//
// Datos comunes de los cálculos:
//   ρ20 Cu = 0.017241 Ω·mm²/m, α = 0.00393 /K  (constantes del motor, IEC 60909-0)
//   X por defecto = 0.08 mΩ/m (cable sin diámetro cargado)
//   c_máx = 1.05, c_mín = 0.95 (IEC 60909-0 Tabla 1, BT)
//   Barra: Un = 400 V, U0 = 400/√3 = 230.94 V, R/X de la red equivalente = 0.1
import { describe, expect, it } from 'vitest'
import type { Circuito } from '@/context/types'
import { verificarCircuitoCC, type BarraCC } from './verificacionCortocircuito'

function cerca(actual: number | null, esperado: number, tol = 0.005) {
  expect(actual).not.toBeNull()
  expect(Math.abs(actual! - esperado) / Math.abs(esperado)).toBeLessThanOrEqual(tol)
}

const barra: BarraCC = { Icc_max_A: 6000, Icc_min_A: 5000, Un: 400, U0: null, frecuencia_hz: 50 }

function cable(seccion: string, temperatura: number, aislamiento: string) {
  return {
    id: 1, nombre: `1x${seccion} mm²`, seccion_f: seccion, diametro: null, calibre_tipo: 'mm²',
    familia_id: 1, Nfases: 1, Iadm: 0,
    familia: { material: 'Cobre', temperatura, aislamiento, norma: null },
  }
}

function circuito(campos: {
  largo: number; fase: ReturnType<typeof cable>; neutro?: ReturnType<typeof cable> | null; Nneutro: number
  proteccion?: { In: number; Icu: number; curva: string }
}): Circuito {
  return {
    id: 1, circuito: 'C1', Largo: campos.largo,
    formacion: {
      cable: campos.fase, cable_neutro: campos.neutro ?? null, cable_tierra: null,
      cond_por_fase: 1, Nfases: 1, Nneutro: campos.Nneutro, disposicion: null,
    },
    proteccion: campos.proteccion ? { id: 1, familia_id: 1, polos: 1, ...campos.proteccion, familia: { tipo: 'termomagnetico' } } : null,
  } as unknown as Circuito
}

const pvc25 = cable('2.5', 70, 'PVC')

describe('I"k mínima — fase-neutro en el extremo, cable caliente', () => {
  // 2.5 mm² Cu PVC (70 °C), 30 m, fase + neutro de la misma sección.
  //   Barra (Icc mín 5 kA): Zs = 0.95·400 / (√3·5000) = 43.879 mΩ
  //                         Xs = Zs/√1.01 = 43.661 mΩ,  Rs = 0.1·Xs = 4.366 mΩ
  //   Cable a 70 °C: ρ = 0.017241·(1 + 0.00393·50) = 0.020629
  //                  R = 0.020629·30/2.5 = 247.55 mΩ,  X = 0.08·30 = 2.40 mΩ
  //   Lazo: R = 4.366 + 2·247.55 = 499.46 mΩ,  X = 43.661 + 2·2.40 = 48.46 mΩ
  //         |Z| = 501.80 mΩ
  //   I"k1 = 0.95 · 230.94 / 0.50180 = 437.2 A
  const r = verificarCircuitoCC(circuito({ largo: 30, fase: pvc25, Nneutro: 1 }), barra)

  it('I"k1 = 437 A', () => cerca(r.Ik_kA_min, 0.4372))
  it('informa que usó falla fase-neutro', () => expect(r.tipoFallaMin).toBe('FASE_NEUTRO'))
})

describe('I"k mínima — neutro de sección reducida', () => {
  // Fase 35 mm², neutro 16 mm², Cu XLPE (90 °C), 50 m.
  //   ρ a 90 °C = 0.017241·(1 + 0.00393·70) = 0.021984
  //   R_fase = 0.021984·50/35 = 31.41 mΩ,  R_neutro = 0.021984·50/16 = 68.70 mΩ
  //   X = 0.08·50 = 4.00 mΩ cada conductor
  //   Lazo: R = 4.366 + 31.41 + 68.70 = 104.47 mΩ,  X = 43.661 + 8.00 = 51.66 mΩ
  //         |Z| = 116.55 mΩ
  //   I"k1 = 0.95 · 230.94 / 0.11655 = 1882 A
  const r = verificarCircuitoCC(circuito({ largo: 50, fase: cable('35', 90, 'XLPE'), neutro: cable('16', 90, 'XLPE'), Nneutro: 1 }), barra)
  it('I"k1 = 1882 A (el neutro chico manda)', () => cerca(r.Ik_kA_min, 1.882))
})

describe('I"k mínima — circuito sin neutro: bifásica', () => {
  // Mismo cable de 2.5 mm² / 30 m, sin neutro.
  //   Z1: R = 4.366 + 247.55 = 251.91 mΩ,  X = 43.661 + 2.40 = 46.06 mΩ,  |Z1| = 256.09 mΩ
  //   I"k2 = 0.95 · 400 / (2 · 0.25609) = 741.9 A
  const r = verificarCircuitoCC(circuito({ largo: 30, fase: pvc25, Nneutro: 0 }), barra)
  it('I"k2 = 742 A', () => cerca(r.Ik_kA_min, 0.7419))
  it('informa que usó falla bifásica', () => expect(r.tipoFallaMin).toBe('BIFASICA'))
})

describe('I"k máxima — trifásica en el extremo, cable a 20 °C', () => {
  //   Barra (Icc máx 6 kA): Zs = 1.05·400 / (√3·6000) = 40.415 mΩ → Xs = 40.214, Rs = 4.021 mΩ
  //   Cable a 20 °C: R = 0.017241·30/2.5 = 206.89 mΩ,  X = 2.40 mΩ
  //   Z1: R = 210.91 mΩ,  X = 42.61 mΩ,  |Z1| = 215.18 mΩ
  //   I"k3 = 1.05 · 400 / (√3 · 0.21518) = 1127 A
  const r = verificarCircuitoCC(circuito({ largo: 30, fase: pvc25, Nneutro: 1 }), barra)
  it('I"k3 = 1127 A', () => cerca(r.Ik_kA_max, 1.1269))
  it('R del cable = 206.9 mΩ', () => cerca(r.R_cable_mOhm, 206.89))
})

describe('Protección', () => {
  // Mismo circuito: I"k mín = 437 A en el extremo, Icc máx de barra = 6 kA.
  const con = (proteccion: { In: number; Icu: number; curva: string }) =>
    verificarCircuitoCC(circuito({ largo: 30, fase: pvc25, Nneutro: 1, proteccion }), barra)

  it('Im usa el extremo superior de la banda: curva C 16 A → 10·16 = 160 A ≤ 437 A ✓', () => {
    const r = con({ In: 16, Icu: 6, curva: 'C' })
    expect(r.Im_A).toBe(160)
    expect(r.Im_ok).toBe(true)
  })

  it('curva C 50 A → 500 A > 437 A: no garantiza disparo (con 5·In = 250 A daba ✓)', () => {
    const r = con({ In: 50, Icu: 6, curva: 'C' })
    expect(r.Im_A).toBe(500)
    expect(r.Im_ok).toBe(false)
  })

  it('Icu se compara contra la Icc de BARRA: 4.5 kA < 6 kA ✗, aunque en el extremo haya 1.1 kA', () => {
    const r = con({ In: 16, Icu: 4.5, curva: 'C' })
    expect(r.Ik_kA_max!).toBeLessThan(4.5)
    expect(r.Icu_ok).toBe(false)
  })

  it('Icu = Icc de barra → cumple', () => expect(con({ In: 16, Icu: 6, curva: 'C' }).Icu_ok).toBe(true))

  it('sin curva cargada → sin datos, no se inventa un resultado', () => {
    const r = con({ In: 16, Icu: 6, curva: '' })
    expect(r.Im_A).toBeNull()
    expect(r.Im_ok).toBeNull()
  })
})

describe('Datos faltantes', () => {
  it('sin Icc de barra no hay corrientes ni veredicto', () => {
    const r = verificarCircuitoCC(
      circuito({ largo: 30, fase: pvc25, Nneutro: 1, proteccion: { In: 16, Icu: 6, curva: 'C' } }),
      { ...barra, Icc_max_A: null, Icc_min_A: null },
    )
    expect(r.Ik_kA_max).toBeNull()
    expect(r.Ik_kA_min).toBeNull()
    expect(r.Icu_ok).toBeNull()
    expect(r.Im_ok).toBeNull()
  })
})
