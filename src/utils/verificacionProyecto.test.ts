// El evaluador de proyecto no calcula nada propio: junta los resultados de las
// funciones ya testeadas y los traduce a hallazgos. Acá se prueba esa traducción.
import { describe, expect, it } from 'vitest'
import type { Tablero } from '@/context/types'
import { evaluarProyecto, peorNivel } from './verificacionProyecto'

const sitio = { altitud: 0, tempAmbiente: 30 }

// 2.5 mm² Cu PVC 70 °C, Iadm 21 A (dato de catálogo de ejemplo).
const cable = {
  id: 1, nombre: '1x2.5 mm²', seccion_f: '2.5', diametro: null, calibre_tipo: 'mm²', familia_id: 1, Nfases: 1, Iadm: 21,
  familia: { material: 'Cobre', temperatura: 70, aislamiento: 'PVC', norma: null },
}
const formacion = { cable, cable_neutro: null, cable_tierra: null, cond_por_fase: 1, Nfases: 1, Nneutro: 1, disposicion: null }
const itm = (In: number) => ({ id: 1, familia_id: 1, polos: 2, In, Icu: 6, curva: 'C', familia: { tipo: 'termomagnetico', marca: null, modelo: null } })

function circ(id: number, campos: object) {
  return {
    id, orden: id, circuito: `C${id}`, descripcion: null, tipo: 'TUG', tablero_id: 1, parent_id: null,
    potencia: null, FP: null, Largo: null, tipo_tension: 'mono', fase: 'R', es_acometida: false,
    formacion: null, proteccion: null, metodo_instalacion: null, fc_manual: null, ft_manual: null,
    tablero_destino_id: null, ...campos,
  }
}

function proyecto(circuitos: object[]) {
  const t = { id: 1, tag: 'TS', categoria: 'POTENCIA', tension_mono: 220, tension_bi: null, tension_tri: null, fuentes: [], circuitos }
  return evaluarProyecto([t as unknown as Tablero], [], sitio)
}

describe('evaluarProyecto', () => {
  it('circuito sobrecargado: Ib 25 A > Iz 21 A → error de Ampacidad y de Protección', () => {
    // Ib = 5500 / (220 · 1) = 25 A; Iz = 21 · FH 1 · FC 1 · FT 1 (30 °C, ref. 30 °C) = 21 A
    const r = proyecto([circ(1, { potencia: 5.5, FP: 1, Largo: 10, formacion, proteccion: itm(25) })])
    const h = r.tableros[0].circuitos[0].hallazgos
    expect(peorNivel(h, 'Ampacidad')).toBe('error')
    expect(peorNivel(h, 'Protección')).toBe('error')
  })

  it('In < Ib: 2.2 kW → 10 A con una protección de 6 A → error de Protección, Ampacidad cumple', () => {
    const r = proyecto([circ(1, { potencia: 2.2, FP: 1, Largo: 10, formacion, proteccion: itm(6), metodo_instalacion: 'conduit_emb', fc_manual: 1 })])
    const h = r.tableros[0].circuitos[0].hallazgos
    expect(h.some(x => x.area === 'Ampacidad' && x.nivel === 'error')).toBe(false)
    expect(peorNivel(h, 'Protección')).toBe('error')
  })

  it('caída: 10 A, 100 m de 2.5 mm², fp 1 → 8.06 % > 3 % → error de Caída', () => {
    // R a 70 °C = 7.41 · (1 + 0.00393·50) = 8.866 Ω/km (IEC 60228 + corrección térmica)
    // e = 2 · 10 A · 0.1 km · 8.866 Ω/km = 17.73 V (sin φ = 0, X no interviene) → 17.73/220 = 8.06 %
    const conX = { ...formacion, cable: { ...cable, diametro: 3.6 }, disposicion: 'trefoil' }
    const r = proyecto([circ(1, { potencia: 2.2, FP: 1, Largo: 100, formacion: conX, proteccion: itm(10) })])
    const e = r.tableros[0].circuitos[0]
    expect(Math.abs(e.caida.epct! - 8.06)).toBeLessThan(0.02)
    expect(peorNivel(e.hallazgos, 'Caída')).toBe('error')
  })

  it('caída sin reactancia calculable (cable sin diámetro) → falta, no un cumple', () => {
    const r = proyecto([circ(1, { potencia: 2.2, FP: 1, Largo: 100, formacion, proteccion: itm(10) })])
    expect(peorNivel(r.tableros[0].circuitos[0].hallazgos, 'Caída')).toBe('falta')
  })

  it('datos faltantes se informan como "falta", nunca como cumple', () => {
    const r = proyecto([circ(1, { potencia: 1, FP: 1 })])
    const h = r.tableros[0].circuitos[0].hallazgos
    expect(h.filter(x => x.area === 'Datos').map(x => x.nivel)).toEqual(['falta', 'falta', 'falta'])
    expect(r.resumen.circuitosOk).toBe(0)
  })

  it('tablero sin fuente ni alimentador → falta la Icc de barra, a nivel tablero', () => {
    const r = proyecto([])
    expect(r.tableros[0].hallazgos.some(h => h.nivel === 'falta' && h.area === 'Cortocircuito')).toBe(true)
  })

  it('selectividad: C16 bajo general C63 con dato manual / sin él', () => {
    // Tablero sin fuente → sin Icc de barra: el límite calculado (5·63 = 315 A) no se
    // puede clasificar → falta. Con "total" de fabricante no depende de la Icc → sin observación.
    const general = circ(1, { es_acometida: true, tipo: 'ACOMETIDA', proteccion: itm(63) })
    const salida = (extra: object) => circ(2, { potencia: 2.2, FP: 1, Largo: 10, formacion, proteccion: itm(16), ...extra })
    const sinDato = proyecto([general, salida({})]).tableros[0].circuitos[1]
    expect(sinDato.selectividad.Is_A).toBe(315)
    expect(peorNivel(sinDato.hallazgos, 'Selectividad')).toBe('falta')
    const conDato = proyecto([general, salida({ selectividad_total: true })]).tableros[0].circuitos[1]
    expect(conDato.selectividad).toMatchObject({ estado: 'total', origen: 'manual' })
    expect(peorNivel(conDato.hallazgos, 'Selectividad')).toBeNull()
  })

  it('una RESERVA vacía no se cuenta; los tableros CONTROL/DATOS tampoco', () => {
    const r = proyecto([circ(1, { tipo: 'RESERVA' })])
    expect(r.resumen.circuitos).toBe(0)
    const control = { id: 2, tag: 'TC', categoria: 'CONTROL', circuitos: [], fuentes: [] } as unknown as Tablero
    expect(evaluarProyecto([control], [], sitio).tableros).toHaveLength(0)
  })
})
