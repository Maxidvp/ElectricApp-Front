// Genera un script AutoLISP que reproduce el unifilar (y, si se pasa, la planilla de
// abajo) en AutoCAD, a partir de los mismos modelos que dibuja el canvas (_model.ts /
// _planilla.ts) — coordenadas y texto salen de ahí, no se recalculan acá.
//
// Bloques: donde el modelo trae un símbolo (ModelSymbol, ver _symbols.ts) se hace
// INSERT por nombre. El script trae la definición de cada bloque que usa
// (definicionBloque) y la crea SOLO si el dibujo de destino no tiene ya uno con ese
// nombre: en un dibujo vacío funciona sin preparar nada, y en uno con la biblioteca
// propia se respetan los bloques que ya están. El resto (barra, placeholders, grilla
// de la planilla) se dibuja con entidades LINE/PLINE/CIRCLE/TEXT.
//
// Unidades: 1 unidad de este modelo = 1 mm — mismo criterio que CadSymbol.tsx, que ya
// asume esa equivalencia para que los símbolos entren a su tamaño real (INSERT escala
// 1.0). El eje Y se invierte respecto al canvas (que crece hacia abajo) para que el
// resultado en AutoCAD (Y crece hacia arriba) no salga espejado — la planilla, si se
// incluye, se ubica debajo del unifilar (mismo orden que en pantalla).
import type { UnifilarModel, ModelLine, ModelText } from './_model'
import type { SymbolDef } from './_symbols'
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

// Definición de un bloque con la misma geometría que dibuja CadSymbol en pantalla.
// Coordenadas relativas al punto de inserción, con Y invertida (AutoCAD crece hacia
// arriba). Todo en la capa "0" para que el bloque tome las propiedades de su INSERT.
export function definicionBloque(def: SymbolDef): string {
  const ix = def.insertX ?? def.viewBox / 2
  const iy = def.insertY ?? def.viewBox / 2
  const n = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(4)
  const X = (x: number) => n(x - ix)
  const Y = (y: number) => n(iy - y)
  const rad = (grados: number) => n((((grados % 360) + 360) % 360) * Math.PI / 180)
  const ent: string[] = []
  for (const l of def.lines)
    ent.push(`(entmake '((0 . "LINE") (8 . "0") (10 ${X(l.x1)} ${Y(l.y1)} 0.0) (11 ${X(l.x2)} ${Y(l.y2)} 0.0)))`)
  for (const d of def.dots) {
    if (d.filled === false) {
      ent.push(`(entmake '((0 . "CIRCLE") (8 . "0") (10 ${X(d.x)} ${Y(d.y)} 0.0) (40 . ${n(d.r)})))`)
    } else {
      // Punto relleno: polilínea cerrada de dos arcos con ancho = radio (una "dona" sin agujero).
      ent.push(`(entmake '((0 . "LWPOLYLINE") (100 . "AcDbEntity") (8 . "0") (100 . "AcDbPolyline") (90 . 2) (70 . 1) (43 . ${n(d.r)}) (10 ${n(d.x - ix - d.r / 2)} ${Y(d.y)}) (42 . 1.0) (10 ${n(d.x - ix + d.r / 2)} ${Y(d.y)}) (42 . 1.0)))`)
    }
  }
  // El canvas recorre el arco en sentido horario con Y hacia abajo; al invertir Y el
  // mismo arco queda antihorario (como los ARC de AutoCAD) entre −fin y −inicio.
  for (const a of def.arcs ?? [])
    ent.push(`(entmake '((0 . "ARC") (8 . "0") (10 ${X(a.cx)} ${Y(a.cy)} 0.0) (40 . ${n(a.r)}) (50 . ${rad(-a.endAngle)}) (51 . ${rad(-a.startAngle)})))`)
  return `  (if (not (tblsearch "BLOCK" "${esc(def.name)}"))
    (progn
      (entmake '((0 . "BLOCK") (2 . "${esc(def.name)}") (70 . 0) (10 0.0 0.0 0.0)))
      ${ent.join('\n      ')}
      (entmake '((0 . "ENDBLK")))))`
}

export function exportUnifilarLisp(unifilar: UnifilarModel, planilla: PlanillaModel | null, tableroTag: string): string {
  const dyPlanilla = unifilar.height + GAP_UNIFILAR_PLANILLA
  const H = planilla ? dyPlanilla + planilla.height : unifilar.height
  const cmds: string[] = []

  const bloques = new Map<string, SymbolDef>()
  for (const s of unifilar.symbols) bloques.set(s.def.name, s.def)
  for (const def of bloques.values()) cmds.push(definicionBloque(def))

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
;; Los simbolos se insertan por nombre de bloque (INSERT). Este script define cada
;; bloque que usa, pero solo si el dibujo no tiene ya uno con ese nombre: los bloques
;; propios que ya esten en el dibujo se respetan.
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
