// Genera un script AutoLISP que reproduce el unifilar (y, si se pasa, la planilla de
// abajo) en AutoCAD, a partir de los mismos modelos que dibuja el canvas (_model.ts /
// _planilla.ts) — coordenadas y texto salen de ahí, no se recalculan acá.
//
// Bloques: donde el modelo trae un símbolo (ModelSymbol, ver _symbols.ts) se hace
// INSERT por nombre — ese bloque ya tiene que existir en el dibujo de destino (mismo
// nombre que el archivo .svg del símbolo). Lo que todavía no tiene bloque real (barra,
// caja del interruptor, marca de tierra, grilla de la planilla) se dibuja con
// entidades LINE/PLINE/CIRCLE/TEXT.
//
// Unidades: 1 unidad de este modelo = 1 mm — mismo criterio que CadSymbol.tsx, que ya
// asume esa equivalencia para que los símbolos entren a su tamaño real (INSERT escala
// 1.0). El eje Y se invierte respecto al canvas (que crece hacia abajo) para que el
// resultado en AutoCAD (Y crece hacia arriba) no salga espejado — la planilla, si se
// incluye, se ubica debajo del unifilar (mismo orden que en pantalla).
import type { UnifilarModel, ModelLine, ModelText } from './_model'
import { GAP_UNIFILAR_PLANILLA } from './_model'
import type { PlanillaModel } from './_planilla'

function pt(x: number, y: number, height: number): string {
  return `(list ${x.toFixed(2)} ${(height - y).toFixed(2)} 0.0)`
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function lineCmd(l: ModelLine, H: number): string {
  return `  (command "_.LINE" ${pt(l.x1, l.y1, H)} ${pt(l.x2, l.y2, H)} "")`
}

function textCmd(t: ModelText, H: number): string {
  // El export invierte Y (espejo vertical) — la rotación tiene que invertirse también
  // para que el texto se vea con la misma orientación visual que en el canvas.
  const rot = -(t.rotation ?? 0)
  return `  (command "_.TEXT" ${pt(t.x, t.y, H)} ${t.size.toFixed(2)} ${rot.toFixed(1)} "${esc(t.text)}")`
}

export function exportUnifilarLisp(unifilar: UnifilarModel, planilla: PlanillaModel | null, tableroTag: string): string {
  const dyPlanilla = unifilar.height + GAP_UNIFILAR_PLANILLA
  const H = planilla ? dyPlanilla + planilla.height : unifilar.height
  const cmds: string[] = []

  for (const l of unifilar.lines) cmds.push(lineCmd(l, H))
  for (const r of unifilar.rects) {
    const p1 = pt(r.x, r.y, H), p2 = pt(r.x + r.w, r.y, H)
    const p3 = pt(r.x + r.w, r.y + r.h, H), p4 = pt(r.x, r.y + r.h, H)
    cmds.push(`  (command "_.PLINE" ${p1} ${p2} ${p3} ${p4} "C")`)
  }
  for (const d of unifilar.dots) {
    cmds.push(`  (command "_.CIRCLE" ${pt(d.x, d.y, H)} ${d.r.toFixed(2)})`)
  }
  for (const s of unifilar.symbols) {
    cmds.push(`  (command "_.-INSERT" "${esc(s.def.name)}" ${pt(s.x, s.y, H)} 1.0 1.0 0.0)`)
  }
  for (const t of unifilar.texts) cmds.push(textCmd(t, H))

  if (planilla) {
    for (const l of planilla.lines) {
      cmds.push(lineCmd({ ...l, y1: l.y1 + dyPlanilla, y2: l.y2 + dyPlanilla }, H))
    }
    for (const t of planilla.texts) {
      cmds.push(textCmd({ ...t, y: t.y + dyPlanilla }, H))
    }
  }

  const nombreComando = `UNIFILAR_${tableroTag.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`

  return `;; Generado por ElectricApp — unifilar${planilla ? ' + planilla de cargas' : ''} de "${esc(tableroTag)}"
;; Unidades: milimetros (1 unidad = 1 mm).
;; Los simbolos se insertan por nombre de bloque (INSERT) — ese bloque ya tiene que
;; existir en el dibujo de destino (mismo nombre que el .svg del simbolo).
;;
;; Uso: cargar este archivo con APPLOAD en AutoCAD y ejecutar el comando
;; ${nombreComando}

(defun c:${nombreComando} ( / _osmode _cmdecho)
  (setq _osmode (getvar "OSMODE"))
  (setq _cmdecho (getvar "CMDECHO"))
  (setvar "OSMODE" 0)
  (setvar "CMDECHO" 0)

${cmds.join('\n')}

  (setvar "OSMODE" _osmode)
  (setvar "CMDECHO" _cmdecho)
  (princ)
)
(princ "\\nComando cargado: ${nombreComando}")
(princ)
`
}
