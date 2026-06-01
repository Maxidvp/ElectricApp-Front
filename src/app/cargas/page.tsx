'use client'
import { useState, useMemo } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import FormacionModal from '@/components/FormacionModal'
import TableroModal from '@/components/TableroModal'
import ConfirmModal from '@/components/ConfirmModal'
import { useProyectos } from '@/context/ProyectosContext'
import { generarFormacion, calcularAreaFormacion } from '@/utils/electricidad'

type CircuitoAPI = {
  id: number
  circuito: string
  descripcion: string | null
  FP: number | null
  Largo: number | null
  tipo_tension: string | null
  formacion: {
    nombre: string
    cond_por_fase: number
    Nfases: number
    Nneutro: number
    cable_id: number
    cable_neutro_id: number | null
    cable_tierra_id: number | null
    cable: { nombre: string; seccion_f: string; diametro: number | null; calibre_tipo: string; familia_id: number }
    cable_neutro: { nombre: string; diametro: number | null } | null
    cable_tierra: { nombre: string; diametro: number | null } | null
  } | null
}

type FormacionData = {
  familia_id: string
  cable_fase_id: string
  cond_por_fase: string
  Nfases: string
  cable_neutro_id: string
  Nneutro: string
  familia_tierra_id: string
  cable_tierra_id: string
}

type CircuitoRow = {
  id: number
  circuito: string
  descripcion: string | null
  FP: number | null
  Largo: number | null
  tipo_tension: string | null
  seccion: string
  formacion: string
  area: string
  formacionData: FormacionData | null
}


function CeldaEditable({ valor, onGuardar }: { valor: string; onGuardar: (v: string) => void }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(valor)

  const guardar = () => {
    setEditando(false)
    if (texto !== valor) onGuardar(texto)
  }

  if (editando) {
    return (
      <input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') guardar()
          if (e.key === 'Escape') { setTexto(valor); setEditando(false) }
        }}
        className="w-full h-7 px-1.5 text-xs border border-info-a10 rounded-sm bg-surface-a10 text-font-a0 outline-none"
      />
    )
  }

  return (
    <span onClick={() => { setTexto(valor); setEditando(true) }} className="cursor-text block w-full min-h-5">
      {valor}
    </span>
  )
}

function mapearCircuitos(data: CircuitoAPI[]): CircuitoRow[] {
  return data.map((c) => ({
    id:        c.id,
    circuito:  c.circuito,
    descripcion: c.descripcion,
    FP:        c.FP,
    Largo:     c.Largo,
    tipo_tension: c.tipo_tension,
    seccion:   c.formacion ? `${c.formacion.cable.seccion_f} ${c.formacion.cable.calibre_tipo}` : '—',
    formacion: c.formacion ? generarFormacion(c.formacion) : '—',
    area:      c.formacion ? calcularAreaFormacion(c.formacion).toFixed(2) : '—',
    formacionData: c.formacion ? {
      familia_id:        String(c.formacion.cable.familia_id),
      cable_fase_id:     String(c.formacion.cable_id),
      cond_por_fase:     String(c.formacion.cond_por_fase),
      Nfases:            String(c.formacion.Nfases),
      cable_neutro_id:   c.formacion.cable_neutro_id ? String(c.formacion.cable_neutro_id) : '',
      Nneutro:           String(c.formacion.Nneutro),
      familia_tierra_id: c.formacion.cable_tierra_id ? String(c.formacion.cable.familia_id) : '',
      cable_tierra_id:   c.formacion.cable_tierra_id ? String(c.formacion.cable_tierra_id) : '',
    } : null,
  }))
}

const columnHelper = createColumnHelper<CircuitoRow>()

export default function TablaCargas() {
  const {
    tableros, getTablero, loading, error,
    renombrarCircuito, agregarCircuito, duplicarCircuito, eliminarCircuito,
    reordenarCircuitos, actualizarDescripcion, actualizarFormacion, agregarTablero,
    actualizarFP, actualizarLargo, actualizarTipoTension,
  } = useProyectos()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const [tableroId, setTableroId]                       = useState<number | null>(() => {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match(/(?:^|;\s*)last_tablero_id=(\d+)/)
    return m ? Number(m[1]) : null
  })
  const [modalTableroAbierto, setModalTableroAbierto]   = useState(false)
  const [modalAbierto, setModalAbierto]                 = useState(false)
  const [circuitoEditando, setCircuitoEditando]         = useState<number | null>(null)
  const [formacionSeleccionada, setFormacionSeleccionada] = useState<FormacionData | null>(null)
  const [rowSeleccionada, setRowSeleccionada]           = useState<number | null>(null)
  const [draggingId,      setDraggingId]               = useState<string | null>(null)
  const [confirmEliminar, setConfirmEliminar]          = useState(false)
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

  const handleCrearTablero = async (data: any) => {
    const nuevo = await agregarTablero(data)
    cambiarTablero(nuevo.id)
    setModalTableroAbierto(false)
  }

  const contextData = useMemo(() => {
    if (!tablero) return []
    const sorted = [...tablero.circuitos].sort((a, b) => (a as any).orden - (b as any).orden)
    return mapearCircuitos(sorted as any)
  }, [tablero])

  const [displayData, setDisplayData] = useState<CircuitoRow[]>([])
  if (displayData.length !== contextData.length ||
      displayData.some((r, i) => r.id !== contextData[i]?.id || r.circuito !== contextData[i]?.circuito || r.descripcion !== contextData[i]?.descripcion || r.FP !== contextData[i]?.FP || r.Largo !== contextData[i]?.Largo || r.tipo_tension !== contextData[i]?.tipo_tension || r.formacion !== contextData[i]?.formacion || r.seccion !== contextData[i]?.seccion)) {
    setDisplayData(contextData)
  }

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
    agregarCircuito(idEfectivo)
  }

  const handleDuplicar = () => {
    if (!rowSeleccionada) return
    duplicarCircuito(rowSeleccionada)
  }

  const handleEliminar = () => {
    if (!rowSeleccionada) return
    setConfirmEliminar(true)
  }

  const columns = useMemo(() => [
    columnHelper.accessor('circuito', {
      header: 'Circuito',
      size: 120,
      cell: (info) => (
        <CeldaEditable
          valor={info.getValue()}
          onGuardar={(nuevoValor) => renombrarCircuito(info.row.original.id, nuevoValor)}
        />
      )
    }),
    columnHelper.accessor('descripcion', {
      header: 'Descripción',
      size: 200,
      cell: (info) => (
        <CeldaEditable
          valor={info.getValue() ?? ''}
          onGuardar={(v) => actualizarDescripcion(info.row.original.id, v.trim() || null)}
        />
      )
    }),
    columnHelper.display({
      id: 'tension',
      header: 'Tensión (V)',
      size: 110,
      cell: info => {
        const { id, tipo_tension } = info.row.original
        if (tensionesDisponibles.length === 0) {
          return <span className="text-surface-tonal-a40 text-xs">—</span>
        }
        if (tensionesDisponibles.length === 1) {
          return <span className="text-xs">{tensionesDisponibles[0].value}</span>
        }
        return (
          <select
            value={tipo_tension ?? ''}
            onChange={e => actualizarTipoTension(id, e.target.value || null)}
            onClick={e => e.stopPropagation()}
            className="w-full h-7 px-1 text-xs rounded-sm bg-surface-a10 text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer"
          >
            <option value="">—</option>
            {tensionesDisponibles.map(t => (
              <option key={t.tipo} value={t.tipo}>{t.value}</option>
            ))}
          </select>
        )
      },
    }),
    columnHelper.accessor('seccion', { header: 'Sección', size: 120 }),
    columnHelper.accessor('formacion', {
      header: 'Formación',
      size: 180,
      cell: (info) => {
        const fd = info.row.original.formacionData
        const openModal = (e: React.MouseEvent) => {
          e.stopPropagation()
          setCircuitoEditando(info.row.original.id)
          setFormacionSeleccionada(fd ?? {
            familia_id: '', cable_fase_id: '', cond_por_fase: '1',
            Nfases: '3', cable_neutro_id: '', Nneutro: '1', familia_tierra_id: '', cable_tierra_id: '',
          })
          setModalAbierto(true)
        }
        if (!fd) return (
          <span onClick={openModal} className="text-surface-tonal-a40 text-xs cursor-pointer">
            Sin formación
          </span>
        )
        return (
          <span className="cursor-pointer underline decoration-dotted" onClick={openModal}>
            {info.getValue()}
          </span>
        )
      }
    }),
    columnHelper.accessor('FP', {
      header: 'FP',
      size: 70,
      cell: (info) => (
        <CeldaEditable
          valor={info.getValue() !== null ? String(info.getValue()) : ''}
          onGuardar={(v) => actualizarFP(info.row.original.id, v.trim() ? Number(v) : null)}
        />
      )
    }),
    columnHelper.accessor('Largo', {
      header: 'Largo (m)',
      size: 90,
      cell: (info) => (
        <CeldaEditable
          valor={info.getValue() !== null ? String(info.getValue()) : ''}
          onGuardar={(v) => actualizarLargo(info.row.original.id, v.trim() ? Number(v) : null)}
        />
      )
    }),
    columnHelper.accessor('area', { header: 'Área (mm²)', size: 140 }),
  ], [renombrarCircuito, actualizarFP, actualizarLargo, actualizarTipoTension, tensionesDisponibles])

  const table = useReactTable({
    data: displayData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    enableColumnResizing: true,
  })

  if (loading && !tablero) return <p>Cargando...</p>
  if (error) return <p>Error: {error}</p>

  return (
    <div className="bg-surface-a10">
      <div className="flex gap-1.5 px-3 pt-3 pb-2 flex-wrap">
        {tableros.map((t) => (
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
        <button
          onClick={() => setModalTableroAbierto(true)}
          title="Agregar tablero"
          className="px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85"
        >+</button>
      </div>
      <div className="datatable-container">
        <div className="header-tools sticky top-12 z-50 bg-surface-tonal-a10">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleAgregar}
              title="Agregar circuito"
              className="flex items-center ml-2 px-3 py-[5px] border border-green-500 rounded-md bg-transparent text-green-400 text-[13px] cursor-pointer transition-[background,color] hover:bg-green-500/10"
            >
              Agregar
            </button>
            <button
              onClick={handleDuplicar}
              disabled={rowSeleccionada === null}
              title="Duplicar circuito seleccionado"
              className="flex items-center px-3 py-[5px] border border-blue-500 rounded-md bg-transparent text-blue-400 text-[13px] cursor-pointer transition-[background,color] hover:bg-blue-500/10 disabled:opacity-40"
            >
              Duplicar
            </button>
            <button
              onClick={handleEliminar}
              disabled={rowSeleccionada === null}
              title="Eliminar circuito seleccionado"
              className="flex items-center px-3 py-[5px] border border-red-500 rounded-md bg-transparent text-red-400 text-[13px] cursor-pointer transition-[background,color] hover:bg-red-500/10 disabled:opacity-40"
            >
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
          <table
            className="datatable"
            style={{
              width: table.getTotalSize(),
              tableLayout: 'fixed',
              borderCollapse: 'separate',
              borderSpacing: 0,
            }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <th style={{ width: 32 }} />
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ width: header.getSize(), position: 'relative' }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
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
                {table.getRowModel().rows.map((row) => {
                  const isSelected = row.original.id === rowSeleccionada
                  return (
                    <SortableRow
                      key={row.id}
                      id={String(row.original.id)}
                      isSelected={isSelected}
                      isAnyDragging={draggingId !== null}
                      onClick={() => { setRowSeleccionada(isSelected ? null : row.original.id) }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} style={{ width: cell.column.getSize() }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </SortableRow>
                  )
                })}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>

      {modalAbierto && formacionSeleccionada && (
        <FormacionModal
          formacionInicial={formacionSeleccionada}
          onGuardar={(data, cables) => {
            if (!circuitoEditando) return
            actualizarFormacion(circuitoEditando, {
              cable_id:        Number(data.cable_fase_id),
              cond_por_fase:   Number(data.cond_por_fase),
              Nfases:          Number(data.Nfases),
              Nneutro:         Number(data.Nneutro),
              cable_neutro_id: data.cable_neutro_id ? Number(data.cable_neutro_id) : null,
              cable_tierra_id: data.cable_tierra_id ? Number(data.cable_tierra_id) : null,
            }, cables)
            setModalAbierto(false)
          }}
          onCerrar={() => setModalAbierto(false)}
        />
      )}

      {confirmEliminar && (
        <ConfirmModal
          mensaje="¿Eliminar este circuito?"
          onConfirmar={() => {
            eliminarCircuito(rowSeleccionada!)
            setRowSeleccionada(null)
            setConfirmEliminar(false)
          }}
          onCancelar={() => setConfirmEliminar(false)}
        />
      )}
      {modalTableroAbierto && (
        <TableroModal
          onGuardar={handleCrearTablero}
          onCerrar={() => setModalTableroAbierto(false)}
        />
      )}
    </div>
  )
}

// ── Sortable row ──────────────────────────────────────────

function SortableRow({ id, isSelected, isAnyDragging, onClick, children }: {
  id: string
  isSelected: boolean
  isAnyDragging: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <tr
      ref={setNodeRef}
      onClick={onClick}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isAnyDragging && !isDragging
          ? `${transition}, background-color 500ms ease`
          : 'background-color 500ms ease',
        opacity: isDragging ? 0.4 : 1,
        cursor: 'pointer',
        outline: isSelected ? '1px solid var(--clr-info-a10)' : undefined,
        background: isSelected ? 'var(--clr-info-a0)' : undefined,
      }}
    >
      <td
        className="w-8 text-center text-surface-tonal-a40 cursor-grab select-none"
        onClick={e => e.stopPropagation()}
        {...attributes} {...listeners}
      >⠿</td>
      {children}
    </tr>
  )
}