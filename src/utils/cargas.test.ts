// Carga efectiva por circuito. Los valores esperados están calculados a mano con
// I = P / (k · V · FP) (k = √3 trifásico, 1 mono/bifásico); el cálculo está en cada
// comentario, nunca copiado de la salida de la app.
import { describe, expect, it } from 'vitest'
import { desequilibrioFases } from './cargas'

describe('dos alimentadores al mismo tablero (barra partida)', () => {
  // Destino: 4 kW trifásicos FP 1. Origen: una carga propia de 2 kW + DOS alimentadores
  // hacia ese destino. Cada alimentador se dimensiona para los 4 kW completos
  // (I = 4000 / (√3 · 400) = 5.77 A), pero la acometida del origen suma 2 + 4 = 6 kW,
  // no 2 + 4 + 4 = 10 kW.
  const base = { tipo: null, potencia: null, FP: null, tipo_tension: 'tri', fase: 'RST', es_acometida: false, tablero_destino_id: null }
  const destino = { id: 2, categoria: 'POTENCIA', tension_mono: 230, tension_bi: null, tension_tri: 400, potencia_inst: null, factor_potencia: null,
    circuitos: [{ ...base, potencia: 4, FP: 1 }] }
  const a1 = { ...base, tipo: 'ALIMENTADOR', tablero_destino_id: 2 }
  const a2 = { ...base, tipo: 'ALIMENTADOR', tablero_destino_id: 2 }
  const propia = { ...base, potencia: 2, FP: 1 }
  const origen = { id: 1, categoria: 'POTENCIA', tension_mono: 230, tension_bi: null, tension_tri: 400, potencia_inst: null, factor_potencia: null,
    circuitos: [propia, a1, a2] }
  const tableros = [origen, destino]
  const tensiones = { mono: 230, bi: null, tri: 400 }

  it('cada alimentador lleva toda la demanda del destino', () => {
    for (const a of [a1, a2]) {
      const r = resolverCargaCircuito(a, [], tensiones, tableros)
      expect(r.potencia).toBe(4)
      expect(r.corriente).toBeCloseTo(5.774, 2)
    }
  })
  it('la acometida del origen cuenta el destino una sola vez: 6 kW', () => {
    const acometida = { ...base, es_acometida: true }
    expect(resolverCargaCircuito(acometida, [propia, a1, a2], tensiones, tableros).potencia).toBe(6)
  })
})

describe('alimentador vinculado a una acometida del destino (emergencia / principal)', () => {
  // Destino, en orden: ESENCIAL 1 kW · acometida EMERGENCIA · NO ESENCIAL 3 kW · acometida GENERAL.
  // Una acometida alimenta lo que tiene arriba: EMERGENCIA → 1 kW; GENERAL → 1 + 3 = 4 kW.
  const base = { tipo: null, potencia: null, FP: null, tipo_tension: 'tri', fase: 'RST', es_acometida: false, tablero_destino_id: null, parent_id: null }
  const destino = { id: 2, categoria: 'POTENCIA', tension_mono: 230, tension_bi: null, tension_tri: 400, potencia_inst: null, factor_potencia: null,
    circuitos: [
      { ...base, id: 20, orden: 0, potencia: 1, FP: 1 },
      { ...base, id: 21, orden: 1, es_acometida: true },
      { ...base, id: 22, orden: 2, potencia: 3, FP: 1 },
      { ...base, id: 23, orden: 3, es_acometida: true },
    ] }
  const aEmergencia = { ...base, id: 10, orden: 0, tipo: 'ALIMENTADOR', tablero_destino_id: 2, acometida_destino_id: 21 }
  const aPrincipal  = { ...base, id: 11, orden: 1, tipo: 'ALIMENTADOR', tablero_destino_id: 2 }
  const origen = { id: 1, categoria: 'POTENCIA', tension_mono: 230, tension_bi: null, tension_tri: 400, potencia_inst: null, factor_potencia: null,
    circuitos: [aEmergencia, aPrincipal] }
  const tableros = [origen, destino]
  const tensiones = { mono: 230, bi: null, tri: 400 }

  it('el de emergencia toma solo las esenciales (1 kW); el principal, todo (4 kW)', () => {
    expect(resolverCargaCircuito(aEmergencia, [], tensiones, tableros).potencia).toBe(1)
    expect(resolverCargaCircuito(aPrincipal, [], tensiones, tableros).potencia).toBe(4)
  })
  it('vínculo a una acometida que ya no existe → toma todo el tablero', () => {
    expect(resolverCargaCircuito({ ...aEmergencia, acometida_destino_id: 999 }, [], tensiones, tableros).potencia).toBe(4)
  })
  it('si los dos salen del mismo tablero, su acometida cuenta el destino una vez, con la mayor: 4 kW (no 5)', () => {
    const acometida = { ...base, es_acometida: true }
    expect(resolverCargaCircuito(acometida, [aEmergencia, aPrincipal], tensiones, tableros).potencia).toBe(4)
  })
})

describe('desequilibrioFases', () => {
  it('30 / 20 / 10 A → promedio 20 A, (30 − 10) / 20 = 100 %', () => {
    expect(desequilibrioFases({ R: 30, S: 20, T: 10 })).toBeCloseTo(100, 6)
  })
  it('fases iguales → 0 %; sin corriente → null', () => {
    expect(desequilibrioFases({ R: 12, S: 12, T: 12 })).toBe(0)
    expect(desequilibrioFases({ R: 0, S: 0, T: 0 })).toBeNull()
  })
})
import { resolverCargaCircuito, tensionesDe, type CircuitoCarga, type TableroCarga } from './cargas'

function cerca(actual: number | null, esperado: number, tol = 0.001) {
  expect(actual).not.toBeNull()
  expect(Math.abs(actual! - esperado) / Math.abs(esperado)).toBeLessThanOrEqual(tol)
}

function circ(campos: Partial<CircuitoCarga>): CircuitoCarga {
  return { tipo: null, potencia: null, FP: null, tipo_tension: null, fase: null, es_acometida: false, tablero_destino_id: null, ...campos }
}

function tablero(id: number, circuitos: CircuitoCarga[], campos: Partial<TableroCarga> = {}): TableroCarga {
  return { id, categoria: 'POTENCIA', potencia_inst: null, factor_potencia: null, tension_mono: 220, tension_bi: null, tension_tri: 380, circuitos, ...campos }
}

// T2 (seccional): 5 kW fp 0.80 + 3 kW fp 0.90, ambos trifásicos.
//   P = 8 kW,  FP = (0.80·5 + 0.90·3) / 8 = 6.7 / 8 = 0.8375
const t2 = tablero(2, [
  circ({ potencia: 5, FP: 0.8, tipo_tension: 'tri', fase: 'RST' }),
  circ({ potencia: 3, FP: 0.9, tipo_tension: 'tri', fase: 'RST' }),
])

// TG: C1 trifásico 10 kW fp 0.85, C2 monofásico fase R 2.2 kW fp 1, alimentador a T2
// (potencia null en la DB: no se carga a mano) y la acometida al final.
const c1 = circ({ potencia: 10, FP: 0.85, tipo_tension: 'tri', fase: 'RST' })
const c2 = circ({ potencia: 2.2, FP: 1, tipo_tension: 'mono', fase: 'R' })
const alim = circ({ tipo: 'ALIMENTADOR', tipo_tension: 'tri', fase: 'RST', tablero_destino_id: 2 })
const acom = circ({ tipo: 'ACOMETIDA', es_acometida: true })
const tg = tablero(1, [c1, c2, alim, acom])
const tableros = [tg, t2]
const tens = tensionesDe(tg)

describe('resolverCargaCircuito — circuito común', () => {
  it('trifásico 10 kW, 380 V, fp 0.85 → 17.87 A', () => {
    // I = 10000 / (√3 · 380 · 0.85) = 10000 / 559.45 = 17.875 A
    const r = resolverCargaCircuito(c1, [], tens, tableros)
    cerca(r.corriente, 17.875)
    expect(r.tension).toBe(380)
  })

  it('monofásico 2.2 kW, 220 V, fp 1 → 10 A', () => {
    const r = resolverCargaCircuito(c2, [c1], tens, tableros)
    cerca(r.corriente, 10)
    expect(r.tension).toBe(220)
  })

  it('sin tipo de tensión en un tablero con dos tensiones → no adivina', () => {
    const r = resolverCargaCircuito(circ({ potencia: 5, FP: 0.9 }), [], tens, tableros)
    expect(r.tipo).toBeNull()
    expect(r.corriente).toBeNull()
  })

  it('sin tipo de tensión en un tablero con una sola tensión → usa esa', () => {
    // I = 2200 / (220 · 1) = 10 A
    const soloMono = { mono: 220, bi: null, tri: null }
    cerca(resolverCargaCircuito(circ({ potencia: 2.2, FP: 1 }), [], soloMono, []).corriente, 10)
  })
})

describe('resolverCargaCircuito — ALIMENTADOR vinculado', () => {
  it('toma la demanda del tablero destino: 8 kW, fp 0.8375 → 14.51 A', () => {
    // I = 8000 / (√3 · 380 · 0.8375) = 8000 / 551.22 = 14.513 A
    const r = resolverCargaCircuito(alim, [c1, c2], tens, tableros)
    cerca(r.potencia, 8)
    cerca(r.fp, 0.8375)
    cerca(r.corriente, 14.513)
  })

  it('destino CONTROL/DATOS: carga simple potencia_inst / factor_potencia', () => {
    // I = 1500 / (220 · 0.9) = 7.576 A
    const control = tablero(3, [], { categoria: 'CONTROL', potencia_inst: 1.5, factor_potencia: 0.9 })
    const a = circ({ tipo: 'ALIMENTADOR', tipo_tension: 'mono', fase: 'S', tablero_destino_id: 3 })
    cerca(resolverCargaCircuito(a, [], tens, [tg, control]).corriente, 7.576)
  })

  it('un ciclo de alimentadores (A→B→A) no cuelga el cálculo', () => {
    const a = tablero(10, [circ({ tipo: 'ALIMENTADOR', tipo_tension: 'tri', tablero_destino_id: 11 })])
    const b = tablero(11, [circ({ tipo: 'ALIMENTADOR', tipo_tension: 'tri', tablero_destino_id: 10 }), circ({ potencia: 4, FP: 1, tipo_tension: 'tri' })])
    // B demanda sus 4 kW; el alimentador de vuelta hacia A se corta y no suma.
    cerca(resolverCargaCircuito(a.circuitos[0], [], tensionesDe(a), [a, b]).potencia, 4)
  })
})

describe('resolverCargaCircuito — acometida', () => {
  // P  = 10 + 2.2 + 8 = 20.2 kW
  // FP = (0.85·10 + 1·2.2 + 0.8375·8) / 20.2 = 17.4 / 20.2 = 0.86139
  // I  = 20200 / (√3 · 380 · 0.86139) = 20200 / 566.95 = 35.63 A
  const r = resolverCargaCircuito(acom, [c1, c2, alim], tens, tableros)

  it('suma los circuitos de arriba, incluido el alimentador: 20.2 kW', () => cerca(r.potencia, 20.2))
  it('FP ponderado por potencia = 0.8614', () => cerca(r.fp, 0.86139))
  it('corriente = 35.63 A a la tensión trifásica del tablero', () => {
    cerca(r.corriente, 35.63)
    expect(r.tipo).toBe('tri')
    expect(r.tension).toBe(380)
  })
  it('corriente por fase: R = 17.875 + 10 + 14.513 = 42.39 A; S = T = 32.39 A', () => {
    cerca(r.corrientesFase!.R, 42.388)
    cerca(r.corrientesFase!.S, 32.388)
    cerca(r.corrientesFase!.T, 32.388)
  })
})
