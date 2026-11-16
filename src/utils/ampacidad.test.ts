// Los casos son comparaciones directas (Ib ≤ In ≤ Iz) y selección de un dato de
// catálogo: el resultado esperado se lee del enunciado de cada test.
import { describe, expect, it } from 'vitest'
import { coordinarProteccion, iadmPorMetodo } from './ampacidad'

describe('iadmPorMetodo — corriente admisible según la forma de instalación', () => {
  const cable = { Iadm: 100, Iadm_canio: 80, Iadm_aire: 110, Iadm_enterrado: null }

  it('conduit → Iadm en cañería', () => {
    expect(iadmPorMetodo(cable, 'conduit_emb')).toEqual({ valor: 80, generica: false, campo: 'Iadm_canio' })
    expect(iadmPorMetodo(cable, 'conduit_sup').valor).toBe(80)
  })

  it('bandeja / aire libre → Iadm al aire', () => {
    for (const m of ['bandeja_perf', 'bandeja_esc', 'aire_libre']) expect(iadmPorMetodo(cable, m).valor).toBe(110)
  })

  it('método sin dato en el catálogo → Iadm genérica, y lo informa', () => {
    expect(iadmPorMetodo(cable, 'enterrado')).toEqual({ valor: 100, generica: true, campo: 'Iadm_enterrado' })
  })

  it('circuito sin método → Iadm genérica', () => {
    expect(iadmPorMetodo(cable, null)).toEqual({ valor: 100, generica: true, campo: null })
  })

  it('sin cable → null', () => expect(iadmPorMetodo(null, 'conduit_emb').valor).toBeNull())
})

describe('coordinarProteccion — Ib ≤ In ≤ Iz', () => {
  const itm = (In: number | null) => ({ In, rango_regulacion_min: null, rango_regulacion_max: null, familia: { tipo: 'termomagnetico' } })

  it('Ib 18 ≤ In 20 ≤ Iz 24 → ok', () => expect(coordinarProteccion(18, 24, itm(20)).estado).toBe('ok'))
  it('In = Ib e In = Iz (bordes) → ok', () => {
    expect(coordinarProteccion(20, 24, itm(20)).estado).toBe('ok')
    expect(coordinarProteccion(18, 20, itm(20)).estado).toBe('ok')
  })
  it('In 16 < Ib 18 → dispara en servicio', () => expect(coordinarProteccion(18, 24, itm(16)).estado).toBe('dispara_en_servicio'))
  it('In 25 > Iz 24 → cable desprotegido', () => expect(coordinarProteccion(18, 24, itm(25)).estado).toBe('cable_desprotegido'))
  it('Ib 30 > Iz 24 → no hay In posible', () => expect(coordinarProteccion(30, 24, itm(25)).estado).toBe('cable_desprotegido'))
  it('sin protección, sin In o sin corrientes → sin datos', () => {
    expect(coordinarProteccion(18, 24, null).estado).toBe('sin_datos')
    expect(coordinarProteccion(18, 24, itm(null)).estado).toBe('sin_datos')
    expect(coordinarProteccion(null, 24, itm(20)).estado).toBe('sin_datos')
    expect(coordinarProteccion(18, null, itm(20)).estado).toBe('sin_datos')
  })

  it('diferencial → no aplica', () => {
    const dif = { In: 40, rango_regulacion_min: null, rango_regulacion_max: null, familia: { tipo: 'diferencial' } }
    expect(coordinarProteccion(18, 24, dif).estado).toBe('no_aplica')
  })

  describe('guardamotor (rango de regulación)', () => {
    const gm = (min: number, max: number) => ({ In: null, rango_regulacion_min: min, rango_regulacion_max: max, familia: { tipo: 'guardamotor' } })

    it('rango 16–25 con Ib 18, Iz 24 → ok, regular entre 18 y 24 A', () => {
      const r = coordinarProteccion(18, 24, gm(16, 25))
      expect(r.estado).toBe('ok')
      expect(r.ajuste).toEqual([18, 24])
    })
    it('rango 10–16 con Ib 18 → no llega: dispara en servicio', () => expect(coordinarProteccion(18, 24, gm(10, 16)).estado).toBe('dispara_en_servicio'))
    it('rango 25–40 con Iz 24 → cable desprotegido', () => expect(coordinarProteccion(18, 24, gm(25, 40)).estado).toBe('cable_desprotegido'))
  })
})
