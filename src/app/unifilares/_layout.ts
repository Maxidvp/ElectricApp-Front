// Geometría de columnas compartida entre UnifilarCanvas y PlanillaLayer — mismo
// ancho de columna en los dos dibujos para que la barra/interruptores del unifilar
// queden centrados sobre la columna de su circuito correspondiente en la planilla.
export const COL_W = 40 // mm entre circuitos (centro a centro)

// groupColW (columna del tag del tablero) y labelColW (columna de etiquetas de fila)
// son mínimos que crecen según el contenido — los calcula computeColumnLayout en
// _planilla.ts, una sola vez por tablero, y de ahí se pasan como parámetro acá para
// que el unifilar y la planilla usen exactamente el mismo ancho.
export interface ColumnLayout {
  groupColW: number
  labelColW: number
}

export function columnX(i: number, layout: ColumnLayout): number {
  return layout.groupColW + layout.labelColW + i * COL_W + COL_W / 2
}

export function diagramWidth(n: number, layout: ColumnLayout): number {
  return layout.groupColW + layout.labelColW + COL_W * Math.max(n, 1)
}

// X de la entrada — centrada entre el primer y el último circuito terminal, mismo
// cálculo que usa buildUnifilarModel (_model.ts). Se expone acá para que _elementos.ts
// pueda resolver el ancla de un elemento manual pegado a la entrada sin duplicar la
// cuenta de columnX(0)/columnX(n-1).
export function entryX(n: number, layout: ColumnLayout): number {
  return (columnX(0, layout) + columnX(Math.max(n - 1, 0), layout)) / 2
}
