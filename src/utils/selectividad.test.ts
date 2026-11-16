// Los límites esperados salen de las bandas de disparo magnético ya cargadas en
// CURVA_MULTIPLICADOR (IEC 60898: B 3–5·In, C 5–10·In, D 10–20·In), calculados a
// mano en cada caso: Is = extremo inferior de la banda de la protección de arriba.
import { describe, expect, it } from 'vitest'
import type { Proteccion } from '@/context/types'
import { evaluarSelectividad, proteccionAguasArriba, type AguasArriba } from './selectividad'

const prot = (tipo: string, In: number | null, curva: string | null): Proteccion => ({
  id: 1, familia_id: 1, polos: 2, In, Icu: 6, curva, sensibilidad_mA: null, clase_diferencial: null,
  rango_regulacion_min: null, rango_regulacion_max: null,
  familia: { id: 1, tipo, marca: null, modelo: null, catalogo: null, norma: null },
})
const itm = (In: number, curva = 'C') => prot('termomagnetico', In, curva)

const circ = (campos: object = {}) => ({
  id: 1, circuito: 'C1', proteccion: itm(16) as Proteccion | null, es_acometida: false, parent_id: null,
  tipo: 'TUG' as string | null, tablero_destino_id: null as number | null, ...campos,
})
const arriba = (proteccion: Proteccion, mismoTramo = false): AguasArriba => ({ proteccion, circuito: 'GENERAL', mismoTramo })

describe('evaluarSelectividad — calculada con curvas normalizadas', () => {
  it('C16 bajo C63, Icc de barra 6 kA → parcial hasta 5·63 = 315 A', () => {
    const r = evaluarSelectividad(circ(), arriba(itm(63)), 6000)
    expect(r.estado).toBe('parcial')
    expect(r.Is_A).toBe(315)
    expect(r.origen).toBe('calculado')
  })

  it('B10 bajo D100, Icc de barra 800 A → total (límite 10·100 = 1000 A ≥ 800 A)', () => {
    const r = evaluarSelectividad(circ({ proteccion: itm(10, 'B') }), arriba(itm(100, 'D')), 800)
    expect(r.estado).toBe('total')
    expect(r.Is_A).toBe(1000)
  })

  it('el límite es el extremo INFERIOR de la banda de arriba: B63 → 3·63 = 189 A', () => {
    expect(evaluarSelectividad(circ(), arriba(itm(63, 'B')), 6000).Is_A).toBe(189)
  })

  it('misma In arriba y abajo (C32 bajo C32) → no selectiva', () => {
    const r = evaluarSelectividad(circ({ proteccion: itm(32) }), arriba(itm(32)), 6000)
    expect(r.estado).toBe('no_selectiva')
    expect(r.Is_A).toBeNull()
  })

  it('sin Icc de barra: informa el límite pero no la clasifica (sin_datos, no un cumple)', () => {
    const r = evaluarSelectividad(circ(), arriba(itm(63)), null)
    expect(r.estado).toBe('sin_datos')
    expect(r.Is_A).toBe(315)
  })
})

describe('evaluarSelectividad — fuera del alcance del cálculo', () => {
  const cajaMoldeada = prot('caja_moldeada', 250, null)

  it('aguas arriba sin curva normalizada y sin dato manual → sin_datos', () => {
    expect(evaluarSelectividad(circ(), arriba(cajaMoldeada), 6000).estado).toBe('sin_datos')
  })

  it('límite manual 4000 A con Icc 3000 A → total; con Icc 6000 A → parcial hasta 4000 A', () => {
    const c = circ({ selectividad_Is: 4000 })
    expect(evaluarSelectividad(c, arriba(cajaMoldeada), 3000)).toMatchObject({ estado: 'total', origen: 'manual', Is_A: 4000 })
    expect(evaluarSelectividad(c, arriba(cajaMoldeada), 6000)).toMatchObject({ estado: 'parcial', origen: 'manual', Is_A: 4000 })
  })

  it('el dato manual pisa al calculado (C16 bajo C63 daría 315 A)', () => {
    expect(evaluarSelectividad(circ({ selectividad_Is: 2500 }), arriba(itm(63)), 6000).Is_A).toBe(2500)
  })

  it('"total" manual no depende de la Icc de barra', () => {
    const r = evaluarSelectividad(circ({ selectividad_total: true }), arriba(cajaMoldeada), null)
    expect(r).toMatchObject({ estado: 'total', origen: 'manual' })
  })

  it('diferencial aguas abajo → no aplica; sin protección aguas arriba → no aplica', () => {
    expect(evaluarSelectividad(circ({ proteccion: prot('diferencial', 40, null) }), arriba(itm(63)), 6000).estado).toBe('no_aplica')
    expect(evaluarSelectividad(circ(), null, 6000).estado).toBe('no_aplica')
  })

  it('circuito sin protección → sin_datos', () => {
    expect(evaluarSelectividad(circ({ proteccion: null }), arriba(itm(63)), 6000).estado).toBe('sin_datos')
  })
})

describe('proteccionAguasArriba', () => {
  const general = circ({ id: 10, circuito: 'GENERAL', es_acometida: true, proteccion: itm(63) })
  const salida = circ({ id: 11, circuito: 'TOMAS' })
  const alimentador = circ({ id: 20, circuito: 'ALIM-TS', tipo: 'ALIMENTADOR', tablero_destino_id: 2, proteccion: itm(80) })
  const principal = { id: 1, circuitos: [alimentador] }

  it('una salida toma el interruptor general de su tablero', () => {
    const seccional = { id: 2, circuitos: [general, salida] }
    expect(proteccionAguasArriba(salida, seccional, [principal, seccional])).toMatchObject({ circuito: 'GENERAL', mismoTramo: false })
  })

  it('sin interruptor general, toma la protección del alimentador que llega al tablero', () => {
    const seccional = { id: 2, circuitos: [salida] }
    expect(proteccionAguasArriba(salida, seccional, [principal, seccional])).toMatchObject({ circuito: 'ALIM-TS', mismoTramo: false })
  })

  it('el interruptor general se compara con el alimentador (mismo tramo)', () => {
    const seccional = { id: 2, circuitos: [general, salida] }
    expect(proteccionAguasArriba(general, seccional, [principal, seccional])).toMatchObject({ circuito: 'ALIM-TS', mismoTramo: true })
  })

  it('un diferencial como general no cuenta: se sigue hasta el alimentador', () => {
    const generalDif = { ...general, proteccion: prot('diferencial', 63, null) }
    const seccional = { id: 2, circuitos: [generalDif, salida] }
    expect(proteccionAguasArriba(salida, seccional, [principal, seccional])?.circuito).toBe('ALIM-TS')
  })

  it('tablero sin general ni alimentador → null', () => {
    const solo = { id: 3, circuitos: [salida] }
    expect(proteccionAguasArriba(salida, solo, [principal, solo])).toBeNull()
  })
})
