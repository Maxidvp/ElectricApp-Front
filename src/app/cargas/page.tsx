'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import FormacionModal from '@/components/FormacionModal'
import ConfirmModal from '@/components/ConfirmModal'
import { useProyectos } from '@/context/ProyectosContext'
import { generarFormacion, calcCorriente } from '@/utils/electricidad'

const TIPOS_CIRCUITO = ['ACU', 'MOTOR', 'VDF', 'IUG', 'TUG', 'IUE', 'TUE', 'APM', 'RESERVA', 'ALIMENTADOR'] as const

type CircuitoAPI = {
  id: number
  circuito: string
  descripcion: string | null
  tipo: string | null
  FP: number | null
  Largo: number | null
  tipo_tension: string | null
  fase: string | null
  es_alimentador: boolean
  potencia: number | null
  formacion: {
    nombre: string
    cond_por_fase: number
    Nfases: number
    Nneutro: number
    cable_id: number
    cable_neutro_id: number | null
    cable_tierra_id: number | null
    disposicion: string | null
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
  disposicion: string
}

type ColMeta = { colType: 'editable' | 'result' | 'display' }

type CircuitoRow = {
  id: number
  circuito: string
  descripcion: string | null
  tipo: string | null
  FP: number | null
  Largo: number | null
  tipo_tension: string | null
  fase: string | null
  es_alimentador: boolean
  potencia: number | null
  corriente: number | null
  formacion: string
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
    <span onClick={() => { setTexto(valor); setEditando(true) }} className={`cursor-text block w-full min-h-5 ${!valor ? 'text-surface-tonal-a40' : ''}`}>
      {valor || '—'}
    </span>
  )
}

type Tensiones = { mono: number | null; bi: number | null; tri: number | null }

function formacionData(c: CircuitoAPI): FormacionData | null {
  if (!c.formacion) return null
  return {
    familia_id:        String(c.formacion.cable.familia_id),
    cable_fase_id:     String(c.formacion.cable_id),
    cond_por_fase:     String(c.formacion.cond_por_fase),
    Nfases:            String(c.formacion.Nfases),
    cable_neutro_id:   c.formacion.cable_neutro_id ? String(c.formacion.cable_neutro_id) : '',
    Nneutro:           String(c.formacion.Nneutro),
    familia_tierra_id: c.formacion.cable_tierra_id ? String(c.formacion.cable.familia_id) : '',
    cable_tierra_id:   c.formacion.cable_tierra_id ? String(c.formacion.cable_tierra_id) : '',
    disposicion:       c.formacion.disposicion ?? '',
  }
}

function mapearCircuitos(data: CircuitoAPI[], tensiones: Tensiones): CircuitoRow[] {
  // Tipo predominante del tablero para alimentadores: tri > bi > mono
  const tipoTablero = tensiones.tri != null ? 'tri' : tensiones.bi != null ? 'bi' : tensiones.mono != null ? 'mono' : null

  return data.map((c, idx) => {
    if (c.es_alimentador) {
      const above = data.slice(0, idx).filter(x => !x.es_alimentador)
      const potencia = above.reduce((s, x) => s + (x.potencia ?? 0), 0) || null
      const conFP = above.filter(x => x.FP != null && (x.potencia ?? 0) > 0)
      const sumPot = conFP.reduce((s, x) => s + x.potencia!, 0)
      const fp = sumPot > 0 ? conFP.reduce((s, x) => s + x.FP! * x.potencia!, 0) / sumPot : null
      const tension_v = tipoTablero === 'tri' ? tensiones.tri : tipoTablero === 'bi' ? tensiones.bi : tensiones.mono
      return {
        id: c.id, circuito: c.circuito, descripcion: c.descripcion, tipo: c.tipo,
        FP: fp ?? null, Largo: c.Largo, tipo_tension: tipoTablero, fase: c.fase,
        es_alimentador: true,
        potencia,
        corriente: calcCorriente(potencia, tipoTablero, tension_v, fp ?? null),
        formacion: c.formacion ? generarFormacion(c.formacion) : '—',
        formacionData: formacionData(c),
      }
    }

    const tension_v = c.tipo_tension === 'mono' ? tensiones.mono
                    : c.tipo_tension === 'bi'   ? tensiones.bi
                    : c.tipo_tension === 'tri'  ? tensiones.tri
                    : null
    return {
      id: c.id, circuito: c.circuito, descripcion: c.descripcion, tipo: c.tipo,
      FP: c.FP, Largo: c.Largo, tipo_tension: c.tipo_tension, fase: c.fase,
      es_alimentador: false,
      potencia: c.potencia ?? null,
      corriente: calcCorriente(c.potencia ?? null, c.tipo_tension, tension_v, c.FP),
      formacion: c.formacion ? generarFormacion(c.formacion) : '—',
      formacionData: formacionData(c),
    }
  })
}


const columnHelper = createColumnHelper<CircuitoRow>()

export default function TablaCargas() {
  const {
    tableros, getTablero, loading, error,
    renombrarCircuito, agregarCircuito, duplicarCircuito, eliminarCircuito,
    reordenarCircuitos, actualizarDescripcion, actualizarTipo, actualizarFormacion,
    actualizarFP, actualizarLargo, actualizarTipoTension, actualizarFase, actualizarPotencia,
  } = useProyectos()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const [tableroId, setTableroId]                       = useState<number | null>(() => {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match(/(?:^|;\s*)last_tablero_id=(\d+)/)
    return m ? Number(m[1]) : null
  })
  const [modalAbierto, setModalAbierto]                 = useState(false)
  const [circuitoEditando, setCircuitoEditando]         = useState<number | null>(null)
  const [formacionSeleccionada, setFormacionSeleccionada] = useState<FormacionData | null>(null)
  const [rowSeleccionada, setRowSeleccionada]           = useState<number | null>(null)
  const [draggingId,      setDraggingId]               = useState<string | null>(null)
  const [confirmEliminar,  setConfirmEliminar]  = useState(false)
  const [pendingTipo,      setPendingTipo]      = useState<{ id: number; nuevoTipo: string | null } | null>(null)
  const [newCircuitIds,    setNewCircuitIds]    = useState<Set<number>>(new Set())
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


  const contextData = useMemo(() => {
    if (!tablero) return []
    const sorted = [...tablero.circuitos].sort((a, b) => (a as any).orden - (b as any).orden)
    const tensiones: Tensiones = { mono: tablero.tension_mono, bi: tablero.tension_bi, tri: tablero.tension_tri }
    return mapearCircuitos(sorted as any, tensiones)
  }, [tablero])

  const [displayData, setDisplayData] = useState<CircuitoRow[]>([])

  useEffect(() => {
    const prev = prevDisplayIdsRef.current
    const current = new Set(displayData.map(r => r.id))
    if (prev.size > 0) {
      const added      = [...current].filter(id => !prev.has(id))
      const removed    = [...prev].filter(id => !current.has(id))
      const removedNeg = removed.filter(id => id < 0)
      // Solo animar cuando el back confirma (ID real reemplaza al temporal)
      // No animar el temp, así evitamos el doble flash al remontar el row
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

  useEffect(() => {
    setDisplayData(prev => {
      // Carga inicial
      if (prev.length === 0) return contextData

      const ctxById = new Map(contextData.map(r => [r.id, r]))
      const prevIds  = new Set(prev.map(r => r.id))

      // Detectar sustituciones temp (ID neg) → real (ID pos)
      const lostNegs   = prev.filter(r => r.id < 0 && !ctxById.has(r.id))
      const gainedPos  = contextData.filter(r => r.id > 0 && !prevIds.has(r.id))
      const tempToReal = new Map<number, CircuitoRow>()
      lostNegs.forEach((neg, i) => { if (gainedPos[i]) tempToReal.set(neg.id, gainedPos[i]) })
      const handledPos = new Set(gainedPos.slice(0, lostNegs.length).map(r => r.id))

      // Actualizar datos in-place preservando el orden del display
      const updated = prev
        .map(r => tempToReal.get(r.id) ?? ctxById.get(r.id) ?? null)
        .filter((r): r is CircuitoRow => r !== null)

      // Agregar circuitos genuinamente nuevos al final
      const newRows = contextData.filter(r => !prevIds.has(r.id) && !handledPos.has(r.id))

      return [...updated, ...newRows]
    })
  }, [contextData])

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
    // Insertar antes del último alimentador para que entre en su cálculo
    const lastFeederIdx = displayData.reduceRight((found, r, i) => found === -1 && r.es_alimentador ? i : found, -1)
    agregarCircuito(idEfectivo, lastFeederIdx >= 0 ? lastFeederIdx : undefined)
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
      meta: { colType: 'editable' } as ColMeta,
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
      meta: { colType: 'editable' } as ColMeta,
      cell: (info) => (
        <CeldaEditable
          valor={info.getValue() ?? ''}
          onGuardar={(v) => actualizarDescripcion(info.row.original.id, v.trim() || null)}
        />
      )
    }),
    columnHelper.accessor('tipo', {
      header: 'Tipo',
      size: 110,
      meta: { colType: 'editable' } as ColMeta,
      cell: (info) => {
        const { id, tipo } = info.row.original
        return (
          <select
            value={tipo ?? ''}
            onChange={e => {
              const nuevo = e.target.value || null
              if (nuevo === 'ALIMENTADOR' || tipo === 'ALIMENTADOR')
                setPendingTipo({ id, nuevoTipo: nuevo })
              else
                actualizarTipo(id, nuevo)
            }}
            onClick={e => e.stopPropagation()}
            className="w-full h-7 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer"
            style={{ background: 'var(--clr-surface-a10)' }}
          >
            <option value="">—</option>
            {TIPOS_CIRCUITO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )
      }
    }),
    columnHelper.display({
      id: 'tension',
      header: 'Tensión (V)',
      size: 110,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, tipo_tension, es_alimentador } = info.row.original
        if (es_alimentador) {
          const v = tensionesDisponibles.find(t => t.tipo === tipo_tension)?.value
          return <span className="text-xs text-font-a20 block text-right pr-1">{v ?? '—'}</span>
        }
        if (tensionesDisponibles.length === 0) return <span className="text-surface-tonal-a40 text-xs">—</span>
        if (tensionesDisponibles.length === 1) return <span className="text-xs">{tensionesDisponibles[0].value}</span>
        return (
          <select
            value={tipo_tension ?? ''}
            onChange={e => actualizarTipoTension(id, e.target.value || null)}
            onClick={e => e.stopPropagation()}
            className="w-full h-7 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer" style={{ background: 'var(--clr-surface-a10)' }}
          >
            <option value="">—</option>
            {tensionesDisponibles.map(t => (
              <option key={t.tipo} value={t.tipo}>{t.value}</option>
            ))}
          </select>
        )
      },
    }),
    columnHelper.display({
      id: 'fase',
      header: 'Fase',
      size: 80,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, tipo_tension, fase, es_alimentador } = info.row.original
        if (es_alimentador) return <span className="text-xs text-font-a20 block text-center">—</span>
        if (!tipo_tension) return <span className="text-surface-tonal-a40 text-xs">—</span>
        if (tipo_tension === 'tri') return <span className="text-xs text-font-a20">RST</span>
        const opciones = tipo_tension === 'mono' ? ['R', 'S', 'T'] : ['RS', 'ST', 'TR']
        return (
          <select
            value={fase ?? ''}
            onChange={e => actualizarFase(id, e.target.value || null)}
            onClick={e => e.stopPropagation()}
            className="w-full h-7 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer" style={{ background: 'var(--clr-surface-a10)' }}
          >
            <option value="">—</option>
            {opciones.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )
      },
    }),
    columnHelper.accessor('potencia', {
      header: 'Potencia (kW)',
      size: 110,
      meta: { colType: 'editable' } as ColMeta,
      cell: (info) => {
        if (info.row.original.es_alimentador) {
          const v = info.getValue()
          return <span className="text-xs text-font-a20 block text-right pr-1">{v != null ? v.toFixed(2) : '—'}</span>
        }
        return (
          <CeldaEditable
            valor={info.getValue() !== null ? String(info.getValue()) : ''}
            onGuardar={(v) => {
              const s = v.trim()
              if (!s) return actualizarPotencia(info.row.original.id, null)
              const isHp = /hp$/i.test(s)
              const num = Number(s.replace(/hp$/i, '').trim())
              actualizarPotencia(info.row.original.id, isNaN(num) ? null : isHp ? num * 0.7457 : num)
            }}
          />
        )
      }
    }),
    columnHelper.accessor('FP', {
      header: 'FP',
      size: 70,
      meta: { colType: 'editable' } as ColMeta,
      cell: (info) => {
        if (info.row.original.es_alimentador) {
          const v = info.getValue()
          return <span className="text-xs text-font-a20 block text-right pr-1">{v != null ? v.toFixed(2) : '—'}</span>
        }
        return (
          <CeldaEditable
            valor={info.getValue() !== null ? String(info.getValue()) : ''}
            onGuardar={(v) => actualizarFP(info.row.original.id, v.trim() ? Number(v) : null)}
          />
        )
      }
    }),
    columnHelper.accessor('corriente', {
      header: 'Corriente (A)',
      size: 110,
      meta: { colType: 'result' } as ColMeta,
      cell: (info) => {
        const v = info.getValue()
        if (v === null) return <span className="text-surface-tonal-a40 text-xs">—</span>
        return <span className="text-xs">{v.toFixed(2)}</span>
      }
    }),
    columnHelper.accessor('formacion', {
      header: 'Formación',
      size: 180,
      meta: { colType: 'editable' } as ColMeta,
      cell: (info) => {
        const fd = info.row.original.formacionData
        const openModal = (e: React.MouseEvent) => {
          e.stopPropagation()
          setCircuitoEditando(info.row.original.id)
          setFormacionSeleccionada(fd ?? {
            familia_id: '', cable_fase_id: '', cond_por_fase: '1',
            Nfases: '3', cable_neutro_id: '', Nneutro: '1', familia_tierra_id: '', cable_tierra_id: '', disposicion: '',
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
    columnHelper.accessor('Largo', {
      header: 'Largo (m)',
      size: 90,
      meta: { colType: 'editable' } as ColMeta,
      cell: (info) => (
        <CeldaEditable
          valor={info.getValue() !== null ? String(info.getValue()) : ''}
          onGuardar={(v) => actualizarLargo(info.row.original.id, v.trim() ? Number(v) : null)}
        />
      )
    }),
  ], [renombrarCircuito, actualizarFP, actualizarLargo, actualizarTipoTension, actualizarFase, actualizarPotencia, tensionesDisponibles])

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
                      style={{ width: header.getSize(), position: 'relative', textAlign: 'center' }}
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
                      isNew={newCircuitIds.has(row.original.id)}
                      isAnyDragging={draggingId !== null}
                      onClick={() => { setRowSeleccionada(isSelected ? null : row.original.id) }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const colType = (cell.column.columnDef.meta as ColMeta | undefined)?.colType
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
              disposicion:     data.disposicion || null,
            }, cables)
            setModalAbierto(false)
          }}
          onCerrar={() => setModalAbierto(false)}
        />
      )}

      {pendingTipo && (
        <ConfirmModal
          mensaje={
            pendingTipo.nuevoTipo === 'ALIMENTADOR'
              ? 'Convertir este circuito en ALIMENTADOR cambiará su comportamiento de cálculo. Se pueden perder datos ingresados manualmente. ¿Continuar?'
              : 'Quitar el tipo ALIMENTADOR puede afectar los cálculos del tablero. Se pueden perder datos. ¿Continuar?'
          }
          labelConfirmar="Continuar"
          onConfirmar={() => {
            actualizarTipo(pendingTipo.id, pendingTipo.nuevoTipo)
            setPendingTipo(null)
          }}
          onCancelar={() => setPendingTipo(null)}
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
    </div>
  )
}

// ── Sortable row ──────────────────────────────────────────

function SortableRow({ id, isSelected, isNew, isAnyDragging, onClick, children }: {
  id: string
  isSelected: boolean
  isNew: boolean
  isAnyDragging: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <tr
      ref={setNodeRef}
      onClick={onClick}
      className={isNew && !isSelected ? 'circuit-new' : undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isAnyDragging && !isDragging
          ? `${transition}, background-color 100ms ease`
          : 'background-color 100ms ease',
        opacity: isDragging ? 0.4 : 1,
        cursor: 'pointer',
        outline: isSelected ? '1px solid var(--clr-info-a10)' : undefined,
        background: isSelected ? 'var(--clr-info-a0)' : undefined,
      }}
    >
      <td
        className="w-8 text-center text-surface-tonal-a40 cursor-grab select-none"
        {...attributes} {...listeners}
      >⠿</td>
      {children}
    </tr>
  )
}