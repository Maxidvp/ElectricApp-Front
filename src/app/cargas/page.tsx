'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { InlineMath } from 'react-katex'
import FormacionModal from '@/components/FormacionModal'
import ConfirmModal   from '@/components/ConfirmModal'
import { useProyectos } from '@/context/ProyectosContext'

import SortableRow  from './SortableRow'
import { useColumnas } from './useColumnas'
import { mapearCircuitos } from './utils'
import type { CircuitoRow, ColMeta, FormacionData, Tensiones } from './types'

export default function TablaCargas() {
  const {
    tableros, getTablero, loading, error,
    renombrarCircuito, agregarCircuito, duplicarCircuito, eliminarCircuito,
    reordenarCircuitos, actualizarDescripcion, actualizarTipo, actualizarFormacion,
    actualizarFP, actualizarLargo, actualizarTipoTension, actualizarFase, actualizarPotencia,
  } = useProyectos()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const [tableroId,             setTableroId]             = useState<number | null>(() => {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match(/(?:^|;\s*)last_tablero_id=(\d+)/)
    return m ? Number(m[1]) : null
  })
  const [modalAbierto,          setModalAbierto]          = useState(false)
  const [circuitoEditando,      setCircuitoEditando]      = useState<number | null>(null)
  const [formacionSeleccionada, setFormacionSeleccionada] = useState<FormacionData | null>(null)
  const [rowSeleccionada,       setRowSeleccionada]       = useState<number | null>(null)
  const [draggingId,            setDraggingId]            = useState<string | null>(null)
  const [confirmEliminar,       setConfirmEliminar]       = useState(false)
  const [pendingTipo,           setPendingTipo]           = useState<{ id: number; nuevoTipo: string | null } | null>(null)
  const [newCircuitIds,         setNewCircuitIds]         = useState<Set<number>>(new Set())
  const prevDisplayIdsRef = useRef<Set<number>>(new Set())

  const idEfectivo = tableroId ?? tableros[0]?.id ?? null
  const tablero    = idEfectivo !== null ? getTablero(idEfectivo) : undefined

  const tensionesDisponibles = useMemo(() => {
    if (!tablero) return []
    const opts: { tipo: string; value: number }[] = []
    if (tablero.tension_mono != null) opts.push({ tipo: 'mono', value: tablero.tension_mono })
    if (tablero.tension_bi   != null) opts.push({ tipo: 'bi',   value: tablero.tension_bi   })
    if (tablero.tension_tri  != null) opts.push({ tipo: 'tri',  value: tablero.tension_tri  })
    return opts
  }, [tablero])

  const cambiarTablero = (id: number) => {
    document.cookie = `last_tablero_id=${id};path=/;max-age=31536000`
    setTableroId(id)
    setRowSeleccionada(null)
  }

  // ── Datos ─────────────────────────────────────────────────────

  const contextData = useMemo(() => {
    if (!tablero) return []
    const sorted = [...tablero.circuitos].sort((a, b) => (a as any).orden - (b as any).orden)
    const tensiones: Tensiones = { mono: tablero.tension_mono, bi: tablero.tension_bi, tri: tablero.tension_tri }
    return mapearCircuitos(sorted as any, tensiones)
  }, [tablero])

  const [displayData, setDisplayData] = useState<CircuitoRow[]>([])

  // Detecta circuitos nuevos (temp→real) para animar la fila
  useEffect(() => {
    const prev    = prevDisplayIdsRef.current
    const current = new Set(displayData.map(r => r.id))
    if (prev.size > 0) {
      const added      = [...current].filter(id => !prev.has(id))
      const removed    = [...prev].filter(id => !current.has(id))
      const removedNeg = removed.filter(id => id < 0)
      if (removedNeg.length > 0) {
        const toAnimate = added.filter(id => id > 0).slice(0, removedNeg.length)
        if (toAnimate.length > 0) {
          setNewCircuitIds(s => new Set([...s, ...toAnimate]))
          toAnimate.forEach(id =>
            setTimeout(() => setNewCircuitIds(s => { const n = new Set(s); n.delete(id); return n }), 3000)
          )
        }
      }
    }
    prevDisplayIdsRef.current = current
  }, [displayData])

  // Sincroniza displayData con contextData de forma incremental
  // (preserva el orden del display, actualiza datos in-place, maneja temp→real)
  useEffect(() => {
    setDisplayData(prev => {
      if (prev.length === 0) return contextData

      const ctxById = new Map(contextData.map(r => [r.id, r]))
      const prevIds  = new Set(prev.map(r => r.id))

      const lostNegs   = prev.filter(r => r.id < 0 && !ctxById.has(r.id))
      const gainedPos  = contextData.filter(r => r.id > 0 && !prevIds.has(r.id))
      const tempToReal = new Map<number, CircuitoRow>()
      lostNegs.forEach((neg, i) => { if (gainedPos[i]) tempToReal.set(neg.id, gainedPos[i]) })
      const handledPos = new Set(gainedPos.slice(0, lostNegs.length).map(r => r.id))

      const updated = prev
        .map(r => tempToReal.get(r.id) ?? ctxById.get(r.id) ?? null)
        .filter((r): r is CircuitoRow => r !== null)
      const newRows = contextData.filter(r => !prevIds.has(r.id) && !handledPos.has(r.id))

      return [...updated, ...newRows]
    })
  }, [contextData])

  // ── Handlers ──────────────────────────────────────────────────

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !idEfectivo) return
    const oldIndex = displayData.findIndex(r => String(r.id) === active.id)
    const newIndex  = displayData.findIndex(r => String(r.id) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(displayData, oldIndex, newIndex)
    setDisplayData(newOrder)
    reordenarCircuitos(idEfectivo, newOrder.map(r => r.id))
    setRowSeleccionada(Number(active.id))
  }

  const handleAgregar = () => {
    if (!idEfectivo) return
    const lastFeederIdx = displayData.reduceRight((found, r, i) => found === -1 && r.es_alimentador ? i : found, -1)
    agregarCircuito(idEfectivo, lastFeederIdx >= 0 ? lastFeederIdx : undefined)
  }

  const handleDuplicar = () => { if (rowSeleccionada) duplicarCircuito(rowSeleccionada) }
  const handleEliminar = () => { if (rowSeleccionada) setConfirmEliminar(true) }

  // ── Columnas ──────────────────────────────────────────────────

  const columns = useColumnas(tensionesDisponibles, {
    renombrarCircuito, actualizarDescripcion, actualizarTipo,
    actualizarTipoTension, actualizarFase, actualizarPotencia, actualizarFP, actualizarLargo,
    setPendingTipo, setCircuitoEditando, setFormacionSeleccionada, setModalAbierto,
  })

  const [colSizing, setColSizing] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('ea_col_cargas') ?? '{}') } catch { return {} }
  })

  const table = useReactTable({
    data: displayData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    enableColumnResizing: true,
    state: { columnSizing: colSizing },
    onColumnSizingChange: upd => {
      const next = typeof upd === 'function' ? upd(colSizing) : upd
      setColSizing(next)
      localStorage.setItem('ea_col_cargas', JSON.stringify(next))
    },
  })

  if (loading && !tablero) return <p>Cargando...</p>
  if (error) return <p>Error: {error}</p>

  return (
    <div className="bg-surface-a10">
      {/* Selector de tablero */}
      <div className="flex gap-1.5 px-3 pt-3 pb-2 flex-wrap">
        {tableros.map(t => (
          <button
            key={t.id}
            onClick={() => cambiarTablero(t.id)}
            className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
              idEfectivo === t.id
                ? 'bg-info-a0 border-info-a10 opacity-100 font-medium'
                : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
            }`}
          >
            {t.nombre || t.tag}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="datatable-container">
        <div className="header-tools sticky top-12 z-50 bg-surface-tonal-a10">
          <div className="flex items-center gap-1.5">
            <button onClick={handleAgregar} title="Agregar circuito"
              className="flex items-center ml-2 px-3 py-[5px] border border-green-500 rounded-md bg-transparent text-green-400 text-[13px] cursor-pointer transition-[background,color] hover:bg-green-500/10">
              Agregar
            </button>
            <button onClick={handleDuplicar} disabled={rowSeleccionada === null} title="Duplicar circuito seleccionado"
              className="flex items-center px-3 py-[5px] border border-blue-500 rounded-md bg-transparent text-blue-400 text-[13px] cursor-pointer transition-[background,color] hover:bg-blue-500/10 disabled:opacity-40">
              Duplicar
            </button>
            <button onClick={handleEliminar} disabled={rowSeleccionada === null} title="Eliminar circuito seleccionado"
              className="flex items-center px-3 py-[5px] border border-red-500 rounded-md bg-transparent text-red-400 text-[13px] cursor-pointer transition-[background,color] hover:bg-red-500/10 disabled:opacity-40">
              Eliminar
            </button>
          </div>
          <div className="search ml-auto">
            <input type="search" className="search-input" placeholder="Buscar..." />
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={e => setDraggingId(String(e.active.id))}
          onDragEnd={e => { setDraggingId(null); handleDragEnd(e) }}
          onDragCancel={() => setDraggingId(null)}
        >
          <table className="datatable" style={{ width: table.getTotalSize(), tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  <th style={{ width: 32 }} />
                  {headerGroup.headers.map(header => (
                    <th key={header.id} colSpan={header.colSpan}
                      style={{ width: header.getSize(), position: 'relative', textAlign: 'center' }}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <SortableContext items={displayData.map(r => String(r.id))} strategy={verticalListSortingStrategy}>
              <tbody>
                {table.getRowModel().rows.map(row => {
                  const isSelected = row.original.id === rowSeleccionada
                  return (
                    <SortableRow
                      key={row.id}
                      id={String(row.original.id)}
                      isSelected={isSelected}
                      isNew={newCircuitIds.has(row.original.id)}
                      isAnyDragging={draggingId !== null}
                      onClick={() => setRowSeleccionada(isSelected ? null : row.original.id)}
                    >
                      {row.getVisibleCells().map(cell => {
                        const colType  = (cell.column.columnDef.meta as ColMeta | undefined)?.colType
                        const isFeeder = row.original.es_alimentador
                        return (
                          <td key={cell.id} style={{
                            width: cell.column.getSize(),
                            background: isFeeder
                              ? 'color-mix(in srgb, #E0A040 10%, transparent)'
                              : colType === 'editable' ? 'color-mix(in srgb, #4A8FD4 4%, transparent)'
                              : colType === 'result'   ? 'color-mix(in srgb, #6aab6a 6%, transparent)'
                              : undefined,
                            borderTop: isFeeder ? '1px solid color-mix(in srgb, #E0A040 40%, transparent)' : undefined,
                          }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )
                      })}
                    </SortableRow>
                  )
                })}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>

          <div className="px-3.5 py-3 border-t border-[var(--dt-border-color)] text-[11px] text-surface-tonal-a40 flex flex-col gap-1.5">
            <span>• <b>Corriente monofásica</b> — <InlineMath math="V_{FN}" /> tensión fase-neutro:{' '}
              <InlineMath math="I = \dfrac{P}{V_{FN} \cdot FP}" />
            </span>
            <span>• <b>Corriente bifásica</b> — <InlineMath math="V_{FF}" /> tensión fase-fase:{' '}
              <InlineMath math="I = \dfrac{P}{V_{FF} \cdot FP}" />
            </span>
            <span>• <b>Corriente trifásica</b> — <InlineMath math="V_{FF}" /> tensión de línea:{' '}
              <InlineMath math="I = \dfrac{P}{\sqrt{3} \cdot V_{FF} \cdot FP}" />
            </span>
            <span>• P en kW, I en A, tensiones en V. FP = factor de potencia.</span>
            <span>• <b>Verificación capacidad de corriente</b> (AEA 90364):{' '}
              <InlineMath math="1{,}25 \cdot I_N \leq I_{CABLE} \cdot F_H \cdot F_C \cdot F_T" />
              {' '}— <InlineMath math="F_H" /> altura · <InlineMath math="F_C" /> canalización · <InlineMath math="F_T" /> temperatura.
            </span>
          </div>
      </div>

      {/* Modales */}
      {modalAbierto && formacionSeleccionada && (
        <FormacionModal
          formacionInicial={formacionSeleccionada}
          tipoTension={displayData.find(r => r.id === circuitoEditando)?.tipo_tension}
          onGuardar={(data, cables) => {
            if (!circuitoEditando) return
            actualizarFormacion(circuitoEditando, {
              cable_id:        Number(data.cable_fase_id),
              cond_por_fase:   Number(data.cond_por_fase),
              Nfases:          Number(data.Nfases),
              Nneutro:         Number(data.Nneutro),
              cable_neutro_id: data.cable_neutro_id ? Number(data.cable_neutro_id) : null,
              cable_tierra_id: data.cable_tierra_id ? Number(data.cable_tierra_id) : null,
              disposicion:     data.disposicion || null,
            }, cables)
            setModalAbierto(false)
          }}
          onCerrar={() => setModalAbierto(false)}
        />
      )}

      {pendingTipo && (
        <ConfirmModal
          mensaje={pendingTipo.nuevoTipo === 'ALIMENTADOR'
            ? 'Convertir este circuito en ALIMENTADOR cambiará su comportamiento de cálculo. Se pueden perder datos ingresados manualmente. ¿Continuar?'
            : 'Quitar el tipo ALIMENTADOR puede afectar los cálculos del tablero. Se pueden perder datos. ¿Continuar?'}
          labelConfirmar="Continuar"
          onConfirmar={() => { actualizarTipo(pendingTipo.id, pendingTipo.nuevoTipo); setPendingTipo(null) }}
          onCancelar={() => setPendingTipo(null)}
        />
      )}

      {confirmEliminar && (
        <ConfirmModal
          mensaje="¿Eliminar este circuito?"
          onConfirmar={() => { eliminarCircuito(rowSeleccionada!); setRowSeleccionada(null); setConfirmEliminar(false) }}
          onCancelar={() => setConfirmEliminar(false)}
        />
      )}
    </div>
  )
}
