import { describe, expect, it } from 'vitest'
import type { FuenteAlimentacion, Tablero } from '@/context/types'
import { calcularIccTablero } from './calcularIccTablero'

// Fuente con todos los campos en null salvo los que se pasan (unidades de la UI:
// RED en kV/MVA, TRANSFORMADOR primaria en kV, secundaria en V, potencia en kVA).
function fuente(id: number, campos: Partial<FuenteAlimentacion>): FuenteAlimentacion {
  return {
    id, tipo: 'RED', nombre: null, tablero_id: 1, tension_nominal: null, potencia_nominal: null,
    potencia_cc: null, corriente_cc: null, relacion_rx: null, xd_subtransitoria_pct: null,
    factor_potencia: null, rg_sobre_xd: null, corriente_limitada_pu: null, tension_primaria: null,
    ukr_porcentaje: null, perdidas_cobre_w: null, uRr_porcentaje: null, grupo_conexion: null,
    impedancia_homopolar_ratio: null, ...campos,
  }
}

const red = fuente(1, { tipo: 'RED', tension_nominal: 20, potencia_cc: 500, relacion_rx: 0.1 })
const trafo = fuente(2, {
  tipo: 'TRANSFORMADOR', tension_primaria: 20, tension_nominal: 400, potencia_nominal: 630,
  ukr_porcentaje: 4, perdidas_cobre_w: 6500, grupo_conexion: 'Dyn11',
})

function tablero(fuentes: FuenteAlimentacion[]): Tablero {
  return { id: 1, tag: 'TG', tension_tri: 400, fuentes, circuitos: [] } as unknown as Tablero
}

describe('calcularIccTablero', () => {
  it('red 20 kV / 500 MVA + trafo 630 kVA → I"k3 en barra = 23.65 kA', () => {
    // A mano (referido a 400 V): RQ = 0.0350, XQ = 0.3503 mΩ; KT = 0.97489;
    // KT·RT = 2.5545, KT·XT = 9.5685 mΩ → R = 2.5895, X = 9.9188 mΩ, Z = 10.251 mΩ
    // I"k3 = 1.05·400 / (√3 · 10.251 mΩ) = 23 654 A
    // Prueba de paso la conversión de unidades de la UI (kV, MVA, kVA) a SI.
    const t = tablero([red, trafo])
    const r = calcularIccTablero(t, [t])
    expect(Math.abs(r.Icc_max_kA! - 23.654) / 23.654).toBeLessThanOrEqual(0.005)
    expect(r.avisos).toEqual([])
  })

  it('avisa cuando hay una UPS que no entra en el cálculo', () => {
    const t = tablero([red, trafo, fuente(3, { tipo: 'UPS' })])
    const r = calcularIccTablero(t, [t])
    expect(r.Icc_max_kA).not.toBeNull()
    expect(r.avisos.some(a => a.includes('UPS'))).toBe(true)
  })

  it('avisa que varias fuentes no se suman en paralelo', () => {
    const gen = fuente(4, { tipo: 'GENERADOR', tension_nominal: 400, potencia_nominal: 500, xd_subtransitoria_pct: 12, factor_potencia: 0.8 })
    const t = tablero([red, trafo, gen])
    const r = calcularIccTablero(t, [t])
    expect(r.avisos.some(a => a.includes('sin sumarlas en paralelo'))).toBe(true)
  })

  it('tablero aguas abajo de un alimentador: Icc mín con el cable caliente = 17.10 kA', () => {
    // TG (red + trafo del primer test) → 50 m de 2×240 mm² Cu XLPE (90 °C) → T2.
    // Todo referido a 400 V, X del cable por defecto 0.08 mΩ/m (sin diámetro cargado):
    //   KT·RT = 2.5545, KT·XT = 9.5685 mΩ (del primer test)
    //   XL = 0.08·50/2 = 2.000 mΩ
    // Mínima (c = 0.95, cable a 90 °C):
    //   ZQ = 0.95·400²/500e6 = 0.304 mΩ → XQ = 0.3025, RQ = 0.0302 mΩ
    //   RL = 0.017241·(1 + 0.00393·70)·50/480 = 2.290 mΩ
    //   R = 4.875, X = 11.871, Z = 12.833 mΩ → I"k = 0.95·400/(√3·12.833 mΩ) = 17 096 A
    //   (a 20 °C daría 17 338 A: sobrestimada un 1.4 %)
    // Máxima (c = 1.05, cable a 20 °C):
    //   RL = 0.017241·50/480 = 1.796 mΩ → R = 4.384, X = 11.903, Z = 12.685 mΩ
    //   I"k = 1.05·400/(√3·12.685 mΩ) = 19 117 A
    const xlpe240 = {
      id: 1, nombre: '1x240 mm²', seccion_f: '240', diametro: null, calibre_tipo: 'mm²', familia_id: 1, Nfases: 1, Iadm: 0,
      familia: { material: 'Cobre', temperatura: 90, aislamiento: 'XLPE', norma: null },
    }
    const alimentador = {
      id: 9, tipo: 'ALIMENTADOR', tablero_id: 1, tablero_destino_id: 2, Largo: 50,
      formacion: { cable: xlpe240, cond_por_fase: 2, Nfases: 3, Nneutro: 0, disposicion: null },
    }
    const tg = { id: 1, tag: 'TG', tension_tri: 400, fuentes: [red, trafo], circuitos: [alimentador] } as unknown as Tablero
    const t2 = { id: 2, tag: 'T2', tension_tri: 400, fuentes: [], circuitos: [] } as unknown as Tablero
    const r = calcularIccTablero(t2, [tg, t2])
    expect(Math.abs(r.Icc_min_kA! - 17.096) / 17.096).toBeLessThanOrEqual(0.005)
    expect(Math.abs(r.Icc_max_kA! - 19.117) / 19.117).toBeLessThanOrEqual(0.005)
  })

  it('sin fuentes → null, sin inventar un número', () => {
    const t = tablero([])
    const r = calcularIccTablero(t, [t])
    expect(r.Icc_max_kA).toBeNull()
  })
})
