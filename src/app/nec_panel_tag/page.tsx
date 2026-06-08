'use client'
import { useState, useEffect, useCallback } from 'react'
import { useProyectos } from '@/context/ProyectosContext'
import { renombrarCircuitosBulk } from '@/services/circuitos'
import { updateTablero } from '@/services/tableros'
import type { Circuito } from '@/context/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function polesFrom(c: Circuito): number {
  if (c.tipo_tension === 'tri') return 3
  if (c.tipo_tension === 'bi')  return 2
  return 1
}

// Positions occupied by a circuit starting at startPos (same column, +2 each step)
function occupiedPos(startPos: number, poles: number): number[] {
  return Array.from({ length: poles }, (_, i) => startPos + i * 2)
}

// Phase label cycling A/B/C per row
function phaseLabel(pos: number): string {
  return ['L1', 'L2', 'L3'][(Math.ceil(pos / 2) - 1) % 3]
}

function buildTag(panelTag: string, startPos: number, poles: number): string {
  return `${panelTag}_${occupiedPos(startPos, poles).join(',')}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PlacedCircuit = {
  circuitId: number
  startPos: number
  poles: number
  originalTag: string
  descripcion: string | null
}

// ─── Initial layout ───────────────────────────────────────────────────────────

function buildInitialLayout(circuits: Circuito[]): PlacedCircuit[] {
  const occupied = new Set<number>()
  const placed: PlacedCircuit[] = []

  for (const c of circuits) {
    const poles = polesFrom(c)
    // Find next free starting position (try odd side first, then even)
    let found: number | null = null
    for (let p = 1; p <= 200 && found === null; p++) {
      const positions = occupiedPos(p, poles)
      if (positions.every(x => !occupied.has(x))) found = p
    }
    if (found === null) continue
    occupiedPos(found, poles).forEach(p => occupied.add(p))
    placed.push({
      circuitId:   c.id,
      startPos:    found,
      poles,
      originalTag: c.circuito,
      descripcion: c.descripcion,
    })
  }

  return placed
}

function circuitAtPos(layout: PlacedCircuit[], pos: number): PlacedCircuit | null {
  return layout.find(pc => occupiedPos(pc.startPos, pc.poles).includes(pos)) ?? null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NecPanelTagPage() {
  const { tableros } = useProyectos()

  // Persist selected tablero via cookie (same pattern as other pages)
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match(/(?:^|;\s*)last_tablero_id=(\d+)/)
    return m ? Number(m[1]) : null
  })

  const [totalSlots, setTotalSlots] = useState(42)
  const [layout,     setLayout]     = useState<PlacedCircuit[]>([])
  const [moving,     setMoving]     = useState<PlacedCircuit | null>(null)
  const [hoverPos,   setHoverPos]   = useState<number | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [savedOk,    setSavedOk]    = useState(false)

  // Resolve selected tablero from context
  const idEfectivo = selectedId ?? tableros[0]?.id ?? null
  const tablero    = tableros.find(t => t.id === idEfectivo) ?? null

  // Rebuild layout and sync totalSlots when tablero changes
  useEffect(() => {
    if (tablero) {
      setLayout(buildInitialLayout(tablero.circuitos))
      setTotalSlots(tablero.modulos ?? 42)
    } else {
      setLayout([])
    }
  }, [tablero?.id])

  // ── Move logic ────────────────────────────────────────────────────────────

  const canPlace = useCallback((pos: number, forCircuit: PlacedCircuit): boolean => {
    const positions = occupiedPos(pos, forCircuit.poles)
    if (positions.some(p => p < 1 || p > totalSlots)) return false
    return positions.every(p => {
      const occupant = circuitAtPos(layout, p)
      return occupant === null || occupant.circuitId === forCircuit.circuitId
    })
  }, [layout, totalSlots])

  const handlePositionClick = useCallback((pos: number) => {
    if (!moving || !canPlace(pos, moving)) return
    setLayout(prev => prev.map(pc =>
      pc.circuitId === moving.circuitId ? { ...pc, startPos: pos } : pc
    ))
    setMoving(null)
    setHoverPos(null)
  }, [moving, canPlace])

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!tablero) return
    setSaving(true)
    try {
      const changed = layout.filter(pc =>
        buildTag(tablero.tag, pc.startPos, pc.poles) !== pc.originalTag
      )
      await renombrarCircuitosBulk(
        changed.map(pc => ({ id: pc.circuitId, circuito: buildTag(tablero.tag, pc.startPos, pc.poles) }))
      )
      // Update originalTag so pending count resets
      setLayout(prev => prev.map(pc => ({
        ...pc,
        originalTag: buildTag(tablero.tag, pc.startPos, pc.poles),
      })))
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const highlightPos: Set<number> = new Set(
    moving && hoverPos !== null && canPlace(hoverPos, moving)
      ? occupiedPos(hoverPos, moving.poles)
      : []
  )
  const invalidHoverPos: Set<number> = new Set(
    moving && hoverPos !== null && !canPlace(hoverPos, moving)
      ? occupiedPos(hoverPos, moving.poles).filter(p => p >= 1 && p <= totalSlots)
      : []
  )

  const pendingCount = tablero
    ? layout.filter(pc => buildTag(tablero.tag, pc.startPos, pc.poles) !== pc.originalTag).length
    : 0

  const rowCount = Math.ceil(totalSlots / 2)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100dvh-48px)] bg-surface-a0 text-font-a0">

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-surface-tonal-a0 border-b border-surface-tonal-a20 shrink-0 flex-wrap">
        <span className="text-[13px] font-semibold text-font-a20 tracking-wide shrink-0">NEC Panel Tag</span>
        <div className="w-px h-5 bg-surface-tonal-a20 shrink-0" />

        <select
          value={idEfectivo ?? ''}
          onChange={e => {
            const id = Number(e.target.value)
            setSelectedId(id)
            document.cookie = `last_tablero_id=${id};path=/;max-age=31536000`
          }}
          className="px-2 py-1 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 text-[13px] cursor-pointer outline-none focus:border-primary-a20"
        >
          {tableros.length === 0 && <option value="">Sin tableros en el proyecto</option>}
          {tableros.map(t => (
            <option key={t.id} value={t.id}>{t.tag}{t.nombre ? ` — ${t.nombre}` : ''}</option>
          ))}
        </select>

        <div className="w-px h-5 bg-surface-tonal-a20 shrink-0" />

        <label className="flex items-center gap-1.5 text-[12px] text-font-a20 shrink-0">
          Módulos
          <select
            value={totalSlots}
            onChange={e => {
              const n = Number(e.target.value)
              setTotalSlots(n)
              if (tablero) updateTablero(tablero.id, { ...tablero, modulos: n }).catch(console.error)
            }}
            className="px-2 py-1 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 text-[13px] cursor-pointer outline-none focus:border-primary-a20"
          >
            {[12, 16, 20, 24, 30, 32, 40, 42, 54, 60, 84].map(n => (
              <option key={n} value={n}>{n} módulos</option>
            ))}
          </select>
        </label>

        <div className="w-px h-5 bg-surface-tonal-a20 shrink-0" />

        {moving ? (
          <span className="text-[12px] text-yellow-400 animate-pulse shrink-0">
            Moviendo <strong>{moving.originalTag}</strong> — click en la posición destino · Esc para cancelar
          </span>
        ) : pendingCount > 0 ? (
          <span className="text-[12px] text-font-a30 shrink-0">
            {pendingCount} cambio{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {moving && (
            <button
              onClick={() => { setMoving(null); setHoverPos(null) }}
              className="px-3 py-1 border border-surface-tonal-a30 rounded-md text-[13px] text-font-a20 hover:bg-surface-tonal-a10 cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !tablero || pendingCount === 0}
            className="px-4 py-1.5 rounded-md text-[13px] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ background: savedOk ? '#3a7d44' : 'var(--clr-primary-a0)', color: '#fff' }}
          >
            {saving ? 'Guardando…' : savedOk ? 'Guardado ✓' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Panel grid */}
      {!tablero ? (
        <div className="flex-1 flex items-center justify-center text-font-a40 text-sm">
          Seleccioná un tablero para empezar
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <table className="border-collapse text-[13px] mx-auto" style={{ minWidth: 680 }}>
            <thead>
              <tr className="text-[11px] text-font-a30 uppercase tracking-wide">
                {/* Left column: Pos | Tag | Desc | Mover | Fase */}
                <th className="px-2 py-1.5 text-right border-b border-surface-tonal-a20 w-10">Pos</th>
                <th className="px-3 py-1.5 border-b border-surface-tonal-a20 w-52">Tag</th>
                <th className="px-3 py-1.5 border-b border-surface-tonal-a20">Descripción</th>
                <th className="px-1 py-1.5 border-b border-surface-tonal-a20 w-7" />
                <th className="px-2 py-1.5 border-b border-surface-tonal-a20 w-10 text-center">Fase</th>
                {/* center divider */}
                <th className="w-3" />
                {/* Right column — mirrored: Fase | Mover | Desc | Tag | Pos */}
                <th className="px-2 py-1.5 border-b border-surface-tonal-a20 w-10 text-center">Fase</th>
                <th className="px-1 py-1.5 border-b border-surface-tonal-a20 w-7" />
                <th className="px-3 py-1.5 border-b border-surface-tonal-a20">Descripción</th>
                <th className="px-3 py-1.5 border-b border-surface-tonal-a20 w-52">Tag</th>
                <th className="px-2 py-1.5 text-left border-b border-surface-tonal-a20 w-10">Pos</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }, (_, rowIdx) => {
                const oddPos  = rowIdx * 2 + 1
                const evenPos = rowIdx * 2 + 2

                const oddPc  = circuitAtPos(layout, oddPos)
                const evenPc = circuitAtPos(layout, evenPos)

                const oddMain  = !oddPc  || oddPc.startPos  === oddPos
                const evenMain = !evenPc || evenPc.startPos === evenPos
                const shared   = { moving, highlightPos, invalidPos: invalidHoverPos, totalSlots,
                  onStartMove: setMoving, onCancelMove: () => { setMoving(null); setHoverPos(null) },
                  onPlaceHere: handlePositionClick, onHover: (p: number | null) => setHoverPos(p) }

                return (
                  <tr key={rowIdx}>
                    <PanelCell pos={oddPos}  pc={oddPc}  panelTag={tablero.tag} isMain={oddMain}  {...shared} />
                    <td className="w-3 bg-surface-tonal-a20" />
                    <PanelCell pos={evenPos} pc={evenPc} panelTag={tablero.tag} isMain={evenMain} mirrored {...shared} />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── PanelCell ────────────────────────────────────────────────────────────────

function PanelCell({
  pos, pc, panelTag, moving, highlightPos, invalidPos, totalSlots, mirrored, isMain,
  onStartMove, onCancelMove, onPlaceHere, onHover,
}: {
  pos: number
  pc: PlacedCircuit | null
  panelTag: string
  moving: PlacedCircuit | null
  highlightPos: Set<number>
  invalidPos: Set<number>
  totalSlots: number
  mirrored?: boolean
  isMain: boolean
  onStartMove: (pc: PlacedCircuit) => void
  onCancelMove: () => void
  onPlaceHere: (pos: number) => void
  onHover: (pos: number | null) => void
}) {
  const poles    = pc?.poles ?? 1
  const newTag   = pc ? buildTag(panelTag, pc.startPos, pc.poles) : null
  const changed  = pc && newTag !== pc.originalTag
  const phase    = phaseLabel(pos)
  const isMoving = !!(moving && pc && moving.circuitId === pc.circuitId)
  const isTarget = moving && !isMoving

  const highlight = highlightPos.has(pos)
  const invalid   = invalidPos.has(pos)

  let rowBg = ''
  if (highlight) rowBg = 'bg-emerald-900/40'
  if (invalid)   rowBg = 'bg-red-900/30'
  if (isMoving)  rowBg = 'bg-yellow-900/20'

  const cellCls = `border-b border-surface-tonal-a20 px-2 py-1 align-middle ${rowBg} transition-colors`
  const cursor  = isTarget ? 'cursor-pointer' : 'default'

  const handleEnter = () => isTarget && onHover(pos)
  const handleLeave = () => isTarget && onHover(null)
  const handleClick = () => isTarget && onPlaceHere(pos)

  const sharedEvt = { onMouseEnter: handleEnter, onMouseLeave: handleLeave, onClick: handleClick, style: { cursor } }

  if (pos > totalSlots) {
    // Out of range: fill columns so table layout stays consistent
    return isMain ? <><td /><td /><td /><td /><td /></> : <><td /><td /></>
  }

  // ── Per-row cells (rowspan=1) ─────────────────────────────────────────────

  const posCell = (
    <td className={`${cellCls} ${mirrored ? 'text-left' : 'text-right'} text-font-a40 text-[11px] w-10 select-none`} {...sharedEvt}>
      {pos}
    </td>
  )

  const phaseCell = (
    <td className={`${cellCls} text-center font-medium text-[12px] w-8`} {...sharedEvt}>
      {pc && (
        <span style={{ color: phase === 'L1' ? '#E87C3A' : phase === 'L2' ? '#378ADD' : '#9B5DE5' }}>
          {phase}
        </span>
      )}
    </td>
  )

  // ── Continuation row: only pos + phase ───────────────────────────────────

  if (!isMain) {
    return mirrored
      ? <>{phaseCell}{posCell}</>
      : <>{posCell}{phaseCell}</>
  }

  // ── Main row cells (rowspan = poles) ─────────────────────────────────────

  const tagCell = (
    <td rowSpan={poles} className={`${cellCls} font-mono text-[12px] w-52`} {...sharedEvt}>
      {!pc ? (
        <span className="text-font-a40 italic">vacío</span>
      ) : changed ? (
        <span className="flex items-center gap-1 flex-wrap">
          <span className="text-font-a40 line-through">{pc.originalTag}</span>
          <span className="text-font-a30">→</span>
          <span className="text-emerald-400 font-semibold">{newTag}</span>
        </span>
      ) : (
        <span>{newTag}</span>
      )}
    </td>
  )

  const descCell = (
    <td rowSpan={poles} className={`${cellCls} text-font-a20 max-w-[180px] truncate`} {...sharedEvt}>
      {pc?.descripcion ?? <span className="text-font-a40 italic">—</span>}
    </td>
  )

  const actionCell = (
    <td rowSpan={poles} className={`${cellCls} w-7 text-center`}>
      {pc && (
        <button
          onClick={() => isMoving ? onCancelMove() : onStartMove(pc)}
          title={isMoving ? 'Cancelar' : 'Mover circuito'}
          className="p-0.5 rounded text-font-a30 hover:text-font-a0 hover:bg-surface-tonal-a20 transition-colors cursor-pointer text-[14px]"
        >
          {isMoving ? '✕' : '⇄'}
        </button>
      )}
    </td>
  )

  return mirrored
    ? <>{phaseCell}{actionCell}{descCell}{tagCell}{posCell}</>
    : <>{posCell}{tagCell}{descCell}{actionCell}{phaseCell}</>
}
