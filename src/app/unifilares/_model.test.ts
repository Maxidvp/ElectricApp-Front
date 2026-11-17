// Regla de ubicación del cartel de riesgo eléctrico y del bloque de datos del tablero:
// no pueden tocar NINGÚN otro elemento del unifilar, sea cual sea la forma del tablero.
// Acá se arma el modelo para muchas combinaciones (cantidad de circuitos, acometidas,
// grupos diferenciales, textos largos, con y sin datos) y se comprueba caja por caja.
import { describe, expect, it } from 'vitest'
import type { Circuito, Proteccion } from '@/context/types'
import { buildUnifilarModel, separarEntradas, cajasDe, seTocan, CARTEL_ANCHO, CARTEL_ALTURA, CARTEL_MARGIN, type Caja, type UnifilarModel } from './_model'
import { CARTEL_RIESGO_ELECTRICO } from './_symbols'

const layout = { groupColW: 20, labelColW: 40 }

const prot = (tipo: string): Proteccion => ({
  id: 1, familia_id: 1, polos: 4, In: 32, Icu: 15, curva: 'C', sensibilidad_mA: 30, clase_diferencial: 'AC',
  rango_regulacion_min: 4, rango_regulacion_max: 6.3,
  familia: { id: 1, tipo, marca: null, modelo: null, catalogo: null, norma: 'IEC 60947-2 / IEC 60898-1' },
})

const cable = { id: 1, nombre: '1x2.5', seccion_f: '2.5', diametro: 6, calibre_tipo: 'mm²', familia_id: 1, Nfases: 1, Iadm: 20,
  familia: { material: 'Cobre', aislamiento: 'PVC', temperatura: 70, norma: 'IRAM 2178-1 – IEC 60502-1' } }
const formacion = { id: 1, cable_id: 1, cond_por_fase: 1, Nfases: 3, Nneutro: 1, cable_neutro_id: null, cable_tierra_id: 1, disposicion: 'trefoil', cable, cable_neutro: null, cable_tierra: cable }

function circuito(id: number, extra: Partial<Circuito> = {}): Circuito {
  return {
    id, orden: id, circuito: `C${id}`, descripcion: null, tipo: 'TUG', tablero_id: 1, formacion_id: 1, formacion,
    proteccion_id: 1, proteccion: prot('termomagnetico'), grupo_diferencial_id: null, grupo_diferencial: null,
    FP: 0.9, Largo: 10, tipo_tension: 'tri', fase: 'RST', es_acometida: false, potencia: 1, metodo_instalacion: null,
    fc_manual: null, ft_manual: null, role: null, parent_id: null, tablero_destino_id: null, tablero_destino: null, ...extra,
  } as Circuito
}

type Caso = { n: number; acometidas: number[]; grupoHasta?: number; datos?: number; nombreLargo?: boolean }

// `acometidas`: después de cuántos circuitos va cada una (la última es la principal).
function armar({ n, acometidas, grupoHasta = 0, datos, nombreLargo }: Caso): UnifilarModel {
  const grupo = { id: 9, tablero_id: 1, nombre: 'ID-01', proteccion_id: 1, proteccion: prot('diferencial') }
  const principales: Circuito[] = []
  let orden = 0
  for (let i = 0; i < n; i++) {
    for (const a of acometidas) if (a === i) principales.push(circuito(100 + i, { orden: orden++, es_acometida: true, tipo: 'ACOMETIDA', circuito: nombreLargo ? 'ACOMETIDA-DE-EMERGENCIA-DESDE-GRUPO' : `ACOM${i}` }))
    principales.push(circuito(i + 1, { orden: orden++, ...(i < grupoHasta ? { grupo_diferencial_id: 9, grupo_diferencial: grupo } : {}) }))
  }
  for (const a of acometidas) if (a >= n) principales.push(circuito(100 + a, { orden: orden++, es_acometida: true, tipo: 'ACOMETIDA', circuito: 'TGBT' }))
  const { entradas, circuitos } = separarEntradas(principales)
  entradas.forEach(e => { e.desde = nombreLargo ? 'TABLERO GENERAL DE BAJA TENSIÓN / GRUPO ELECTRÓGENO' : 'TP-GENERAL' })
  const datosTablero = datos == null ? undefined : {
    titulo: nombreLargo ? 'TP-GENERAL — Tablero General de Baja Tensión del Edificio Principal' : 'TS-01',
    lineas: Array.from({ length: datos }, (_, i) => nombreLargo ? `Los conductores en el interior son Cu/PVC IRAM NM 247-3 — renglón ${i}` : `Dato ${i}`),
  }
  return buildUnifilarModel(circuitos, entradas[0]?.circuito ?? null, layout, entradas, datosTablero)
}

// Todo lo del modelo menos el cartel (su símbolo y sus tres textos) y el recuadro del gabinete.
function resto(m: UnifilarModel): Caja[] {
  return cajasDe({
    lines: m.lines.filter(l => l.role !== 'limite'), rects: m.rects, dots: m.dots,
    texts: m.texts.filter(t => t.role !== 'peligro'), symbols: m.symbols.filter(s => s.def !== CARTEL_RIESGO_ELECTRICO),
  })
}

const casos: Caso[] = []
for (const n of [1, 2, 3, 4, 6, 9, 14])
  for (const acometidas of [[], [n], [1, n], [Math.ceil(n / 2), n]])
    for (const grupoHasta of [0, Math.min(2, n)])
      for (const datos of [undefined, 3, 16, 40])
        for (const nombreLargo of [false, true])
          casos.push({ n, acometidas, grupoHasta, datos, nombreLargo })

describe('unifilar — cartel de riesgo y bloque de datos', () => {
  it(`el cartel no toca ningún otro elemento (${casos.length} configuraciones)`, () => {
    for (const caso of casos) {
      const m = armar(caso)
      const cartel = m.symbols.find(s => s.def === CARTEL_RIESGO_ELECTRICO)!
      const caja: Caja = { x1: cartel.x, y1: cartel.y - CARTEL_ALTURA, x2: cartel.x + CARTEL_ANCHO, y2: cartel.y }
      // Con una tolerancia mínima bajo el margen exigido, por redondeo de la medición de texto.
      const choca = resto(m).find(c => seTocan(caja, c, CARTEL_MARGIN - 0.01))
      expect(choca, `choca en ${JSON.stringify(caso)} con ${JSON.stringify(choca)}`).toBeUndefined()
    }
  })

  it('el bloque de datos no toca el dibujo eléctrico', () => {
    for (const caso of casos.filter(c => c.datos != null)) {
      const m = armar(caso)
      const esBloque = (t: UnifilarModel['texts'][number]) => t.text.startsWith('Dato ') || t.text.includes('renglón ') || t.text === 'TS-01' || t.text.startsWith('TP-GENERAL —')
      const bloque = cajasDe({ lines: [], rects: [], dots: [], symbols: [], texts: m.texts.filter(esBloque) })
      const otros = cajasDe({
        lines: m.lines.filter(l => l.role !== 'limite'), rects: m.rects, dots: m.dots,
        texts: m.texts.filter(t => !esBloque(t) && t.role !== 'peligro'), symbols: m.symbols.filter(s => s.def !== CARTEL_RIESGO_ELECTRICO),
      })
      const choque = bloque.find(b => otros.some(o => seTocan(b, o, CARTEL_MARGIN - 0.01)))
      expect(choque, `bloque encimado en ${JSON.stringify(caso)}`).toBeUndefined()
    }
  })

  it('el cartel y el bloque de datos quedan dentro del recuadro del gabinete', () => {
    for (const caso of casos) {
      const m = armar(caso)
      const borde = m.lines.filter(l => l.role === 'limite')
      const x1 = Math.min(...borde.map(l => Math.min(l.x1, l.x2))), x2 = Math.max(...borde.map(l => Math.max(l.x1, l.x2)))
      const y1 = Math.min(...borde.map(l => Math.min(l.y1, l.y2))), y2 = Math.max(...borde.map(l => Math.max(l.y1, l.y2)))
      const cartel = m.symbols.find(s => s.def === CARTEL_RIESGO_ELECTRICO)!
      expect(cartel.x, JSON.stringify(caso)).toBeGreaterThanOrEqual(x1)
      expect(cartel.x + CARTEL_ANCHO).toBeLessThanOrEqual(x2)
      expect(cartel.y - CARTEL_ALTURA).toBeGreaterThanOrEqual(y1)
      expect(cartel.y).toBeLessThanOrEqual(y2 + 0.001)
    }
  })
})
