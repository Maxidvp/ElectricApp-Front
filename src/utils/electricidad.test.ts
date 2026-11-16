// Tests de validación de cálculos. Regla: los valores esperados salen de la norma
// citada o de un cálculo a mano escrito en el comentario, NUNCA de la salida de la
// propia app. Si un test falla, primero revisar el cálculo a mano y la tabla; recién
// después el código.
import { describe, expect, it } from 'vitest'
import { calcCorriente, calcDrops, calcFC, calcFH, calcFT, calcIccExtremo, calcResistencia, calcSminCable, type CaidaInput } from './electricidad'

// Error relativo ≤ tol
function cerca(actual: number | null, esperado: number, tol = 0.005) {
  expect(actual).not.toBeNull()
  expect(Math.abs(actual! - esperado) / Math.abs(esperado)).toBeLessThanOrEqual(tol)
}

describe('calcResistencia — IEC 60228 clase 2, R máx. a 20 °C (Ω/km)', () => {
  // Valores de la tabla 2 de IEC 60228 (conductores clase 2, recocidos).
  // Ojo con 50 y 70 mm²: ρ/A con ρ constante da −5 % y −2 % (bug que tuvo la app).
  const cobre: [string, number][] = [
    ['1.5', 12.1], ['2.5', 7.41], ['4', 4.61], ['6', 3.08], ['10', 1.83], ['16', 1.15],
    ['25', 0.727], ['35', 0.524], ['50', 0.387], ['70', 0.268], ['95', 0.193],
    ['120', 0.153], ['150', 0.124], ['185', 0.0991], ['240', 0.0754],
  ]
  it.each(cobre)('Cu %s mm²', (s, r) => cerca(calcResistencia(s, 'mm²', 'Cobre', 20), r))

  const aluminio: [string, number][] = [['16', 1.91], ['25', 1.20], ['50', 0.641], ['95', 0.320], ['240', 0.125]]
  it.each(aluminio)('Al %s mm²', (s, r) => cerca(calcResistencia(s, 'mm²', 'Aluminio', 20), r))

  it('sección fuera de tabla → ρ20/A (5.5 mm² Cu = 18.34/5.5 = 3.3345)', () => {
    cerca(calcResistencia('5.5', 'mm²', 'Cobre', 20), 3.3345)
  })

  it('corrige por temperatura: R90 = R20 · (1 + 0.00393 · 70)', () => {
    // 95 mm² Cu: 0.193 Ω/km a 20 °C × 1.2751 = 0.24609 Ω/km a 90 °C
    cerca(calcResistencia('95', 'mm²', 'Cobre', 90), 0.24609)
  })

  it('kcmil: 250 kcmil = 126.7 mm²', () => cerca(calcResistencia('250', 'kcmil', 'Cobre', 20), 18.34 / 126.675))
  it('calibre desconocido → null', () => expect(calcResistencia('10', 'xyz', 'Cobre', 20)).toBeNull())
})

describe('calcCorriente', () => {
  // Tri: I = P / (√3 · U · cosφ) = 10000 / (1.7321 · 380 · 0.85) = 17.875 A
  it('trifásico 10 kW, 380 V, fp 0.85', () => cerca(calcCorriente(10, 'tri', 380, 0.85), 17.875))
  // Mono: I = P / (U · cosφ) = 2200 / 220 = 10 A
  it('monofásico 2.2 kW, 220 V, fp 1', () => cerca(calcCorriente(2.2, 'mono', 220, 1), 10))
  it('fp 0 → null', () => expect(calcCorriente(10, 'tri', 380, 0)).toBeNull())
})

describe('calcDrops — ΔU = k · (I/n) · L · (R cosφ + X sinφ)', () => {
  const vacio: CaidaInput = { tension: '', fp: '', in_: '', cf: '', l: '', r: '', x: '', cable_id: '' }

  it('trifásico: 100 A, 100 m, R 0.247, X 0.08 Ω/km, fp 0.85, 400 V', () => {
    // sinφ = √(1−0.85²) = 0.52678
    // ΔU = √3 · 100 · 0.1 · (0.247·0.85 + 0.08·0.52678) = 17.3205 · 0.25209 = 4.366 V
    // %  = 4.366 / 400 = 1.092 %
    const { ev, epct } = calcDrops({ ...vacio, tension: '400', fp: '0.85', in_: '100', cf: '1', l: '100', r: '0.247', x: '0.08' }, 3, null, null, null, null)
    cerca(ev, 4.366)
    cerca(epct, 1.0916)
  })

  it('monofásico: 16 A, 30 m, R 8.87, fp 1, 220 V', () => {
    // ΔU = 2 · 16 · 0.03 · 8.87 = 8.515 V → 3.871 %
    const { ev, epct } = calcDrops({ ...vacio, tension: '220', fp: '1', in_: '16', cf: '1', l: '30', r: '8.87', x: '0.1' }, 1, null, null, null, null)
    cerca(ev, 8.515)
    cerca(epct, 3.8705)
  })

  it('dos conductores por fase reparten la corriente', () => {
    // 400 A en 2 cond/fase → 200 A c/u; 50 m, R 0.0991, X 0.075, fp 0.9 (sinφ 0.43589)
    // ΔU = √3 · 200 · 0.05 · (0.08919 + 0.03269) = 2.111 V → 0.5555 % de 380 V
    const { ev, epct } = calcDrops({ ...vacio, tension: '380', fp: '0.9', in_: '400', cf: '2', l: '50', r: '0.0991', x: '0.075' }, 3, null, null, null, null)
    cerca(ev, 2.111)
    cerca(epct, 0.5555)
  })

  it('usa los valores automáticos cuando el campo manual está vacío', () => {
    const { ev } = calcDrops(vacio, 3, 1, 0.85, 100, 400, 0.08, 100, 0.247)
    cerca(ev, 4.366)
  })

  it('sin datos → null', () => expect(calcDrops(vacio, 3, null, null, null, null).ev).toBeNull())
})

describe('calcIccExtremo — Icc mín. fase-neutro, 0.8·U0 / (2·R·L)', () => {
  // 0.8 · 220 / (2 · 8.87 · 0.030) = 176 / 0.5322 = 330.7 A
  it('2.5 mm² (R 8.87 Ω/km), 30 m', () => cerca(calcIccExtremo(220, 8.87, 30), 330.7))
})

describe('calcSminCable — S = I·√t / k, k de IEC 60364-4-43 Tabla 43A', () => {
  // 10 kA, 0.1 s → I·√t = 3162.3 A·s½
  it('Cu/PVC k=115 → 27.50 mm²', () => cerca(calcSminCable(10000, 0.1, 'Cobre', 'PVC'), 27.498))
  it('Cu/XLPE k=143 → 22.11 mm²', () => cerca(calcSminCable(10000, 0.1, 'Cobre', 'XLPE'), 22.114))
  it('Al/PVC k=76 → 41.61 mm²', () => cerca(calcSminCable(10000, 0.1, 'Aluminio', 'PVC'), 41.609))
  it('Al/XLPE k=94 → 33.64 mm²', () => cerca(calcSminCable(10000, 0.1, 'Aluminio', 'XLPE'), 33.641))
})

describe('calcFT — IEC 60364-5-52 Tablas B.52.14 (aire, ref. 30 °C) y B.52.15 (enterrado, ref. 20 °C)', () => {
  // La tabla publica dos decimales: tolerancia 0.01 absoluta.
  const casos: [string, number, number, string, number][] = [
    ['PVC 70 °C, aire 40 °C', 40, 70, 'conduit_sup', 0.87],
    ['PVC 70 °C, aire 50 °C', 50, 70, 'conduit_sup', 0.71],
    ['XLPE 90 °C, aire 40 °C', 40, 90, 'conduit_sup', 0.91],
    ['XLPE 90 °C, aire 25 °C', 25, 90, 'conduit_sup', 1.04],
    ['PVC 70 °C, suelo 30 °C', 30, 70, 'enterrado', 0.89],
    ['XLPE 90 °C, suelo 30 °C', 30, 90, 'enterrado', 0.93],
  ]
  it.each(casos)('%s', (_n, amb, max, metodo, esperado) => {
    expect(Math.abs(calcFT(amb, max, metodo)! - esperado)).toBeLessThanOrEqual(0.01)
  })
  it('ambiente ≥ temperatura máxima → null', () => expect(calcFT(70, 70, 'conduit_sup')).toBeNull())
})

describe('calcFC — agrupamiento', () => {
  // IEC 60364-5-52 Tabla B.52.17, ítem 1 (agrupados en aire, sobre superficie, embutidos o en caño)
  const agrupados: [number, number][] = [[1, 1.0], [2, 0.80], [3, 0.70], [4, 0.65], [5, 0.60], [6, 0.57], [9, 0.50], [12, 0.45], [16, 0.41], [20, 0.38]]
  it.each(agrupados)('en caño, %i circuitos', (n, f) => expect(calcFC('conduit_emb', n)).toBe(f))

  // IEC 60364-5-52 Tabla B.52.18 (cables enterrados directo, tocándose)
  const enterrados: [number, number][] = [[2, 0.75], [3, 0.65], [4, 0.60], [5, 0.55], [6, 0.50]]
  it.each(enterrados)('enterrado, %i circuitos', (n, f) => expect(calcFC('enterrado', n)).toBe(f))

  // AEA 90364-7-771, agrupamiento en aire, una sola capa (= IEC B.52.17 ítems 4 y 5).
  // Fuente transcripta: hoja técnica de CEARCA "Coeficientes de corrección de las
  // corrientes admisibles", que reproduce la tabla del reglamento de la AEA.
  const perforada: [number, number][] = [[1, 1.0], [2, 0.88], [3, 0.82], [4, 0.77], [5, 0.75], [6, 0.73], [7, 0.73], [8, 0.72], [9, 0.72], [12, 0.72]]
  it.each(perforada)('bandeja perforada, %i circuitos', (n, f) => expect(calcFC('bandeja_perf', n)).toBe(f))

  const escalera: [number, number][] = [[1, 1.0], [2, 0.87], [3, 0.82], [4, 0.80], [5, 0.80], [6, 0.79], [7, 0.79], [8, 0.78], [9, 0.78], [20, 0.78]]
  it.each(escalera)('bandeja escalera, %i circuitos', (n, f) => expect(calcFC('bandeja_esc', n)).toBe(f))

  it('método desconocido → null', () => expect(calcFC('xyz', 3)).toBeNull())
})

describe('calcFH — FH = min(1, 1.02 − 0.00002·h), criterio lineal de proyecto (fuente normativa pendiente)', () => {
  // Un factor de reducción nunca puede aumentar la corriente admisible.
  it('nivel del mar → 1 (antes daba 1.02)', () => expect(calcFH(0)).toBe(1))
  it('1000 m → 1.02 − 0.02 = 1', () => expect(calcFH(1000)).toBeCloseTo(1, 9))
  it('2000 m → 1.02 − 0.04 = 0.98', () => expect(calcFH(2000)).toBeCloseTo(0.98, 9))
  it('3500 m → 1.02 − 0.07 = 0.95', () => expect(calcFH(3500)).toBeCloseTo(0.95, 9))
})
