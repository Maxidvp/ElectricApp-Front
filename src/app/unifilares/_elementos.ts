// Fusiona los ElementoUnifilar (agregados a mano, persistidos — ver ElementoUnifilar
// en prisma/schema.prisma del Back) con el UnifilarModel ya calculado por
// buildUnifilarModel (100% derivado de Circuito/Formacion/Proteccion, nunca editable
// a mano). El merge resuelve cada elemento (ancla + offset) a coordenadas absolutas y
// lo agrega como una línea/texto/símbolo más — UnifilarCanvas y _export.ts no
// necesitan saber si un elemento es automático o manual, consumen el mismo modelo.
import type { Circuito, ElementoUnifilar } from '@/context/types'
import type { UnifilarModel } from './_model'
import { BUS_Y, TEXT_SIZE_UNIFILAR, LINE_WEIGHT_UNIFILAR, missingSymbolRect } from './_model'
import { columnX, entryX, type ColumnLayout } from './_layout'
import { SYMBOLS_BY_NAME } from './_symbols'

// Punto de ancla de un elemento: la columna del circuito al que está pegado (o la de
// la entrada), o el origen del tablero (0,0) si no está pegado a ningún circuito.
function resolverAncla(
  circuitoId: number | null,
  circuitos: Circuito[],
  entrada: Circuito | null,
  layout: ColumnLayout,
): { x: number; y: number } {
  if (circuitoId == null) return { x: 0, y: 0 }
  if (entrada && entrada.id === circuitoId) return { x: entryX(circuitos.length, layout), y: BUS_Y }
  const idx = circuitos.findIndex(c => c.id === circuitoId)
  if (idx === -1) return { x: 0, y: 0 } // el circuito no está en este dibujo (ej. filtrado o borrado)
  return { x: columnX(idx, layout), y: BUS_Y }
}

export function mergeElementosManuales(
  model: UnifilarModel,
  elementos: ElementoUnifilar[],
  circuitos: Circuito[],
  entrada: Circuito | null,
  layout: ColumnLayout,
): UnifilarModel {
  if (elementos.length === 0) return model

  const lines = [...model.lines]
  const texts = [...model.texts]
  const symbols = [...model.symbols]
  const rects = [...model.rects]

  for (const el of elementos) {
    const ancla = resolverAncla(el.circuito_id, circuitos, entrada, layout)
    const x = ancla.x + el.x1
    const y = ancla.y + el.y1

    if (el.tipo === 'linea' && el.x2 != null && el.y2 != null) {
      lines.push({
        x1: x, y1: y,
        x2: ancla.x + el.x2, y2: ancla.y + el.y2,
        weight: el.grosor ?? LINE_WEIGHT_UNIFILAR,
        // El linetype (el.tipo_linea) todavía no lo modela ModelLine — Konva lo
        // podría mostrar con `dash`, pendiente de sumarlo cuando haga falta.
      })
    } else if (el.tipo === 'texto' && el.texto) {
      texts.push({
        x, y, text: el.texto,
        size: el.tamano ?? TEXT_SIZE_UNIFILAR,
        bold: el.negrita ?? false,
        align: (el.alineacion as 'left' | 'center' | 'right' | null) ?? 'left',
        rotation: el.rotacion ?? 0,
      })
    } else if (el.tipo === 'simbolo' && el.nombre_bloque) {
      const def = SYMBOLS_BY_NAME[el.nombre_bloque]
      if (def) {
        symbols.push({ x, y, def })
        // Posición de cada atributo dentro del símbolo: pendiente de que los bloques
        // reales definan esos offsets (ver conversación de diseño). Mientras tanto se
        // apilan como líneas de texto debajo del símbolo, un placeholder honesto en
        // vez de inventar una posición "real" que no tenemos.
        el.atributos.forEach((a, i) => {
          texts.push({ x: x + 10, y: y + 10 + i * 2.2, text: `${a.clave}: ${a.valor}`, size: TEXT_SIZE_UNIFILAR })
        })
      } else {
        // nombre_bloque no matchea ningún símbolo del catálogo (bloque real todavía no
        // digitalizado, o typo) — mismo placeholder celeste que usa buildUnifilarModel
        // en vez de dejar el elemento invisible.
        rects.push(missingSymbolRect(x, y))
      }
    }
  }

  return { ...model, lines, texts, symbols, rects }
}
