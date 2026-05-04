'use client'
import { useState, useMemo } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import "../../styles/tables.css"
import "../../styles/FormacionModal.css"
import FormacionModal from '@/components/FormacionModal'
import TableroModal from '@/components/TableroModal'
import { useTableros } from '@/context/TablerosContext'

type CircuitoAPI = {
  id: number
  circuito: string
  formacion: {
    nombre: string
    cond_por_fase: number
    Nfases: number
    Nneutro: number
    cable_id: number
    cable_neutro_id: number | null
    cable_tierra_id: number | null
    cable: { seccion_f: string; diametro: number | null; calibre_tipo: string; familia_id: number }
    cable_neutro: { diametro: number | null } | null
    cable_tierra: { diametro: number | null } | null
  } | null
}

type FormacionData = {
  familia_id: string
  nombre: string
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
  seccion: string
  formacion: string
  area: string
  formacionData: FormacionData | null
}

function calcularArea(formacion: NonNullable<CircuitoAPI['formacion']>): string {
  const area = (d: number | null) => d ? Math.PI * Math.pow(d / 2, 2) : 0
  const areaFases  = formacion.Nfases * formacion.cond_por_fase * area(formacion.cable.diametro)
  const areaNeutro = formacion.Nneutro * area(formacion.cable_neutro?.diametro ?? null)
  const areaTierra = area(formacion.cable_tierra?.diametro ?? null)
  return (areaFases + areaNeutro + areaTierra).toFixed(2)
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
        style={{
          width: '100%', height: 28, padding: '0 6px', fontSize: 12,
          border: '1px solid var(--clr-info-a10)', borderRadius: 4,
          background: 'var(--clr-surface-a10)', color: 'var(--clr-font-a0)', outline: 'none',
        }}
      />
    )
  }

  return (
    <span onClick={() => setEditando(true)} style={{ cursor: 'text', display: 'block', width: '100%' }}>
      {valor}
    </span>
  )
}

function mapearCircuitos(data: CircuitoAPI[]): CircuitoRow[] {
  return data.map((c) => ({
    id:        c.id,
    circuito:  c.circuito,
    seccion:   c.formacion ? `${c.formacion.cable.seccion_f} ${c.formacion.cable.calibre_tipo}` : '—',
    formacion: c.formacion?.nombre ?? '—',
    area:      c.formacion ? calcularArea(c.formacion) : '—',
    formacionData: c.formacion ? {
      familia_id:        String(c.formacion.cable.familia_id),
      nombre:            c.formacion.nombre,
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
    renombrarCircuito, agregarCircuito, duplicarCircuito,
    actualizarFormacion, agregarTablero,
  } = useTableros()

  const [tableroId, setTableroId]                       = useState<number | null>(null)
  const [modalTableroAbierto, setModalTableroAbierto]   = useState(false)
  const [modalAbierto, setModalAbierto]                 = useState(false)
  const [circuitoEditando, setCircuitoEditando]         = useState<number | null>(null)
  const [formacionSeleccionada, setFormacionSeleccionada] = useState<FormacionData | null>(null)
  const [rowSeleccionada, setRowSeleccionada]           = useState<number | null>(null)

  const idEfectivo = tableroId ?? tableros[0]?.id ?? null
  const tablero    = idEfectivo !== null ? getTablero(idEfectivo) : undefined

  const cambiarTablero = (id: number) => {
    setTableroId(id)
    setRowSeleccionada(null)
  }

  const handleCrearTablero = async (data: any) => {
    const nuevo = await agregarTablero(data)
    cambiarTablero(nuevo.id)
    setModalTableroAbierto(false)
  }

  const data = useMemo(() =>
    tablero ? mapearCircuitos(tablero.circuitos as any) : []
  , [tablero])

  const handleAgregar = () => {
    if (!idEfectivo) return
    agregarCircuito(idEfectivo)
  }

  const handleDuplicar = () => {
    if (!rowSeleccionada) return
    duplicarCircuito(rowSeleccionada)
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
    columnHelper.accessor('seccion', { header: 'Sección', size: 120 }),
    columnHelper.accessor('formacion', {
      header: 'Formación',
      size: 180,
      cell: (info) => {
        const fd = info.row.original.formacionData
        if (!fd) return (
          <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12 }}>Sin formación</span>
        )
        return (
          <span
            style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
            onClick={(e) => {
              e.stopPropagation()
              setCircuitoEditando(info.row.original.id)
              setFormacionSeleccionada(fd)
              setModalAbierto(true)
            }}
          >
            {info.getValue()}
          </span>
        )
      }
    }),
    columnHelper.accessor('area', { header: 'Área (mm²)', size: 140 }),
  ], [renombrarCircuito])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    enableColumnResizing: true,
  })

  if (loading && !tablero) return <p>Cargando...</p>
  if (error) return <p>Error: {error}</p>

  return (
    <div className="subcontainer">
      <div className="tablero-tabs">
        {tableros.map((t) => (
          <button
            key={t.id}
            className={`tablero-tab${idEfectivo === t.id ? ' activo' : ''}`}
            onClick={() => cambiarTablero(t.id)}
          >
            {t.nombre ?? t.tag}
          </button>
        ))}
        <button
          className="tablero-tab"
          onClick={() => setModalTableroAbierto(true)}
          title="Agregar tablero"
        >
          <i className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle' }}>add</i>
        </button>
      </div>
      <div className="datatable-container">
        <div className="header-tools">
          <div className="tools">
            <ul>
              <li>
                <button onClick={handleAgregar} title="Agregar circuito">
                  <i className="material-icons">add_circle</i>
                </button>
              </li>
              <li>
                <button
                  onClick={handleDuplicar}
                  disabled={rowSeleccionada === null}
                  title="Duplicar circuito seleccionado"
                  style={{ opacity: rowSeleccionada === null ? 0.4 : 1 }}
                >
                  <i className="material-icons">content_copy</i>
                </button>
              </li>
              <li><button><i className="material-icons">delete</i></button></li>
            </ul>
          </div>
          <div className="search">
            <input type="search" className="search-input" placeholder="Buscar..." />
          </div>
        </div>
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
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isSelected = row.original.id === rowSeleccionada
              return (
                <tr
                  key={row.id}
                  onClick={() => setRowSeleccionada(isSelected ? null : row.original.id)}
                  style={{
                    cursor: 'pointer',
                    outline: isSelected ? '1px solid var(--clr-info-a10)' : undefined,
                    background: isSelected ? 'var(--clr-info-a0)' : undefined,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalAbierto && formacionSeleccionada && (
        <FormacionModal
          formacionInicial={formacionSeleccionada}
          onGuardar={(data) => {
            if (!circuitoEditando) return
            actualizarFormacion(circuitoEditando, {
              cable_id:        Number(data.cable_fase_id),
              nombre:          data.nombre,
              cond_por_fase:   Number(data.cond_por_fase),
              Nfases:          Number(data.Nfases),
              Nneutro:         Number(data.Nneutro),
              cable_neutro_id: data.cable_neutro_id ? Number(data.cable_neutro_id) : null,
              cable_tierra_id: data.cable_tierra_id ? Number(data.cable_tierra_id) : null,
            })
            setModalAbierto(false)
          }}
          onCerrar={() => setModalAbierto(false)}
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
