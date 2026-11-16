'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import ConfirmModal from '@/components/ConfirmModal'
import CableSimpleModal, { type CableSimpleResult } from '@/components/CableSimpleModal'
import { useProyectos } from '@/context/ProyectosContext'
import type { LazoInstrumentacion } from '@/context/ProyectosContext'

import SortableRow from './SortableRow'
import { useColumnas } from './useColumnas'
import type { ColMeta } from './types'
import { useTableroSeleccionado } from '@/hooks/useTableroSeleccionado'

export default function TablaInstrumentos() {
  const {
    tableros, getTablero, loading, error,
    agregarLazoVacio, duplicarLazo, eliminarLazo, actualizarLazo, reordenarLazos,
  } = useProyectos()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const tablerosControl = tableros.filter(t => t.categoria === 'CONTROL')

  const [rowSeleccionada, setRowSeleccionada] = useState<number | null>(null)
  const [draggingId,      setDraggingId]      = useState<string | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [guardando,       setGuardando]       = useState(false)
  const [newLazoIds,      setNewLazoIds]      = useState<Set<number>>(new Set())
  const [lazoCableModal,  setLazoCableModal]  = useState<LazoInstrumentacion | null>(null)
  const prevIdsRef = useRef<Set<number>>(new Set())

  const { tablero, idEfectivo, seleccionarTablero } = useTableroSeleccionado(tablerosControl)

  const cambiarTablero = (id: number) => {
    seleccionarTablero(id)
    setRowSeleccionada(null)
  }

  // Memoizado: useReactTable necesita una referencia estable de `data` — si se
  // recrea en cada render (aunque el contenido sea igual), entra en un loop de
  // reset/recálculo interno con columnResizeMode que puede colgar la pestaña.
  const displayData = useMemo(
    () => [...(tablero?.lazos ?? [])].sort((a, b) => a.orden - b.orden),
    [tablero?.lazos]
  )

  // Resalta filas nuevas (recién creadas) con una animación breve
  useEffect(() => {
    const prev    = prevIdsRef.current
    const current = new Set(displayData.map(r => r.id))
    if (prev.size > 0) {
      const added = [...current].filter(id => !prev.has(id))
      if (added.length > 0) {
        setNewLazoIds(s => new Set([...s, ...added]))
        added.forEach(id =>
          setTimeout(() => setNewLazoIds(s => { const n = new Set(s); n.delete(id); return n }), 3000)
        )
      }
    }
    prevIdsRef.current = current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablero?.lazos])

  const actualizarCampo = useCallback((id: number, campo: keyof LazoInstrumentacion, valor: string | number | null) => {
    const lazo = tablero?.lazos.find(l => l.id === id)
    if (!lazo) return
    const { id: _id, tablero_id: _tid, ...rest } = lazo
    actualizarLazo(id, { ...rest, [campo]: valor } as any)
  }, [tablero, actualizarLazo])

  const handleGuardarCable = async (data: CableSimpleResult) => {
    if (!lazoCableModal) return
    const { id: _id, tablero_id: _tid, ...rest } = lazoCableModal
    await actualizarLazo(lazoCableModal.id, { ...rest, ...data })
    setLazoCableModal(null)
  }

  const handleAgregar = async () => {
    if (!idEfectivo) return
    setGuardando(true)
    try { await agregarLazoVacio(idEfectivo) } finally { setGuardando(false) }
  }

  const handleDuplicar = async () => {
    if (rowSeleccionada == null) return
    setGuardando(true)
    try { await duplicarLazo(rowSeleccionada) } finally { setGuardando(false) }
  }

  const handleEliminar = () => { if (rowSeleccionada != null) setConfirmEliminar(true) }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !idEfectivo) return
    const oldIndex = displayData.findIndex(r => String(r.id) === active.id)
    const newIndex = displayData.findIndex(r => String(r.id) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(displayData, oldIndex, newIndex)
    reordenarLazos(idEfectivo, newOrder.map(r => r.id))
    setRowSeleccionada(Number(active.id))
  }

  const columns = useColumnas({ actualizarCampo, abrirCableModal: setLazoCableModal })

  const [colSizing, setColSizing] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('ea_col_instrumentos') ?? '{}') } catch { return {} }
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
      localStorage.setItem('ea_col_instrumentos', JSON.stringify(next))
    },
  })

  if (loading && !tablero) return <p>Cargando...</p>
  if (error) return <p>Error: {error}</p>

  return (
    <div className="bg-surface-a10 w-full">
      {/* Selector de tablero — solo los de categoría Control / instrumentación */}
      <div className="flex gap-1.5 px-3 pt-3 pb-2 flex-wrap">
        {tablerosControl.map(t => (
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

      {tablerosControl.length === 0 ? (
        <p className="p-6 text-surface-tonal-a40 text-sm">
          No hay tableros de categoría Control / instrumentación. Creá uno desde la sección Tableros.
        </p>
      ) : (
        <div className="datatable-container">
          <div className="header-tools sticky top-12 z-50 bg-surface-tonal-a10">
            <div className="flex items-center gap-1.5">
              <button onClick={handleAgregar} disabled={guardando} title="Agregar lazo"
                className="flex items-center ml-2 px-3 py-[5px] border border-green-500 rounded-md bg-transparent text-green-400 text-[13px] cursor-pointer transition-[background,color] hover:bg-green-500/10 disabled:opacity-40">
                Agregar
              </button>
              <button onClick={handleDuplicar} disabled={rowSeleccionada === null || guardando} title="Duplicar lazo seleccionado"
                className="flex items-center px-3 py-[5px] border border-blue-500 rounded-md bg-transparent text-blue-400 text-[13px] cursor-pointer transition-[background,color] hover:bg-blue-500/10 disabled:opacity-40">
                Duplicar
              </button>
              <button onClick={handleEliminar} disabled={rowSeleccionada === null} title="Eliminar lazo seleccionado"
                className="flex items-center px-3 py-[5px] border border-red-500 rounded-md bg-transparent text-red-400 text-[13px] cursor-pointer transition-[background,color] hover:bg-red-500/10 disabled:opacity-40">
                Eliminar
              </button>
            </div>
          </div>

          <div className="flex justify-center">
          <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
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
                        isNew={newLazoIds.has(row.original.id)}
                        isAnyDragging={draggingId !== null}
                        onClick={() => setRowSeleccionada(isSelected ? null : row.original.id)}
                      >
                        {row.getVisibleCells().map(cell => {
                          const colType = (cell.column.columnDef.meta as ColMeta | undefined)?.colType
                          return (
                            <td key={cell.id} style={{
                              width: cell.column.getSize(),
                              background: colType === 'editable' ? 'color-mix(in srgb, #4A8FD4 4%, transparent)' : undefined,
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
          </div>
          </div>
        </div>
      )}

      {confirmEliminar && (
        <ConfirmModal
          mensaje="¿Eliminar este lazo de instrumentación?"
          onConfirmar={() => { eliminarLazo(rowSeleccionada!); setRowSeleccionada(null); setConfirmEliminar(false) }}
          onCancelar={() => setConfirmEliminar(false)}
        />
      )}

      {lazoCableModal && (
        <CableSimpleModal
          valorInicial={{ cable_id: lazoCableModal.cable_id, cantidad_cables: lazoCableModal.cantidad_cables, cable: lazoCableModal.cable }}
          onGuardar={handleGuardarCable}
          onCerrar={() => setLazoCableModal(null)}
        />
      )}
    </div>
  )
}
