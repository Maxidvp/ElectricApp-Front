// Medición real de texto (Canvas 2D) — para que los anchos/altos de la planilla
// puedan tratarse como mínimos que crecen si el contenido no entra (ver
// computeColumnLayout y las alturas de fila en _planilla.ts) en vez de números fijos
// a ojo. Si no hay `document` (SSR) se usa una aproximación: no afecta lo que se
// termina pintando, porque el canvas real solo se monta del lado del cliente (ver
// isClient en UnifilarCanvas.tsx) — para cuando eso pasa, esta función ya corre en
// el browser y mide de verdad.
let ctx: CanvasRenderingContext2D | null | undefined

function getCtx(): CanvasRenderingContext2D | null {
  if (ctx === undefined) {
    ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
  }
  return ctx
}

export function textWidth(text: string, size: number, bold = false): number {
  const c = getCtx()
  if (!c) return text.length * size * 0.55 // aproximación sans-serif, solo para SSR
  c.font = `${bold ? 'bold ' : ''}${size}px sans-serif`
  return c.measureText(text).width
}

// Cantidad de líneas que ocupa `text` si Konva.Text lo envuelve (word-wrap, el modo
// por default) dentro de `maxWidth` — mismo criterio de ajuste por palabra.
export function wrappedLines(text: string, size: number, maxWidth: number, bold = false): number {
  if (!text) return 1
  const words = text.split(' ')
  const spaceW = textWidth(' ', size, bold)
  let lines = 1
  let lineW = 0
  for (const word of words) {
    const w = textWidth(word, size, bold)
    if (lineW === 0) {
      lineW = w
    } else if (lineW + spaceW + w <= maxWidth) {
      lineW += spaceW + w
    } else {
      lines++
      lineW = w
    }
  }
  return lines
}
