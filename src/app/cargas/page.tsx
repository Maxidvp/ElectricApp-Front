'use client'
import { useState, useMemo } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import "../../styles/tables.css"
import "../../styles/FormacionModal.css"
import FormacionModal from '@/components/FormacionModal'
import { useTableros } from '@/context/TablerosContext'
import { updateFormacion } from '@/services/circuitos'
import { updateNombreCircuito } from '@/services/circuitos'

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
  }
}

type CircuitoRow = {
  id: number
  circuito: string
  seccion: string
  formacion: string
  area: string
  formacionData: {
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
}

function calcularArea(formacion: CircuitoAPI['formacion']): string {
  const area = (d: number | null) => d ? Math.PI * Math.pow(d / 2, 2) : 0
  const areaFases  = formacion.Nfases * formacion.cond_por_fase * area(formacion.cable.diametro)
  const areaNeutro = formacion.Nneutro * area(formacion.cable_neutro?.diametro ?? null)
  const areaTierra = area(formacion.cable_tierra?.diametro ?? null)
  return (areaFases + areaNeutro + areaTierra).toFixed(2)
}

// Componente de celda editable
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
        onKeyDown={(e) => {
          if (e.key === 'Enter') guardar()
          if (e.key === 'Escape') {
            setTexto(valor)
            setEditando(false)
          }
        }}
        style={{
          width: '100%',
          height: 28,
          padding: '0 6px',
          fontSize: 12,
          border: '1px solid var(--clr-info-a10)',
          borderRadius: 4,
          background: 'var(--clr-surface-a10)',
          color: 'var(--clr-font-a0)',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <span
      onClick={() => setEditando(true)}
      style={{ cursor: 'text', display: 'block', width: '100%' }}
    >
      {valor}
    </span>
  )
}

function mapearCircuitos(data: CircuitoAPI[]): CircuitoRow[] {
  return data.map((c) => ({
    id:        c.id,
    circuito:  c.circuito,
    seccion:   `${c.formacion.cable.seccion_f} ${c.formacion.cable.calibre_tipo}`,
    formacion: c.formacion.nombre,
    area:      calcularArea(c.formacion),
    formacionData: {
      familia_id:        String(c.formacion.cable.familia_id),
      nombre:            c.formacion.nombre,
      cable_fase_id:     String(c.formacion.cable_id),
      cond_por_fase:     String(c.formacion.cond_por_fase),
      Nfases:            String(c.formacion.Nfases),
      cable_neutro_id:   c.formacion.cable_neutro_id ? String(c.formacion.cable_neutro_id) : '',
      Nneutro:           String(c.formacion.Nneutro),
      familia_tierra_id: c.formacion.cable_tierra_id ? String(c.formacion.cable.familia_id) : '',
      cable_tierra_id:   c.formacion.cable_tierra_id ? String(c.formacion.cable_tierra_id) : '',
    }
  }))
}

const columnHelper = createColumnHelper<CircuitoRow>()

export default function TablaCargas() {
  const tableroId = 1

  const { getTablero, tableros, loading, error, recargar  } = useTableros()

  const [modalAbierto, setModalAbierto] = useState(false)
  const [circuitoSeleccionado, setCircuitoSeleccionado] = useState<number | null>(null)
  const [formacionSeleccionada, setFormacionSeleccionada] = useState<any>(null)

  const tablero = getTablero(tableroId)


  
  // useMemo evita recalcular los datos en cada render
  const data = useMemo(() =>
    tablero ? mapearCircuitos(tablero.circuitos as any) : []
  , [tablero])

  // useMemo evita recrear las columnas en cada render — previene loops
  const columns = useMemo(() => [
    columnHelper.accessor('circuito', {
      header: 'Circuito',
      size: 120,
      cell: (info) => (
        <CeldaEditable
          valor={info.getValue()}
          onGuardar={async (nuevoValor) => {
            try {
              await updateNombreCircuito(info.row.original.id, nuevoValor)
              recargar()
            } catch (err) {
              console.error('Error al guardar:', err)
            }
          }}
        />
      )
    }),
    columnHelper.accessor('seccion',  { header: 'Sección',  size: 120 }),
    columnHelper.accessor('formacion', {
      header: 'Formación',
      size: 180,
      cell: (info) => (
        <span
          style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
          onClick={() => {
            setCircuitoSeleccionado(info.row.original.id)
            setFormacionSeleccionada(info.row.original.formacionData)
            setModalAbierto(true)
          }}
        >
          {info.getValue()}
        </span>
      )
    }),
    columnHelper.accessor('area', { header: 'Área (mm²)', size: 140 }),
  ], [recargar])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    enableColumnResizing: true,
  })

  if (loading) return <p>Cargando...</p>
  if (error) return <p>Error: {error}</p>

  return (
    <div className="subcontainer">
      <div className="datatable-container">
        <div className="header-tools">
          <div className="tools">
            <ul>
              <li><button><i className="material-icons">add_circle</i></button></li>
              <li><button><i className="material-icons">edit</i></button></li>
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
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modalAbierto && (
        <FormacionModal
          formacionInicial={formacionSeleccionada}
          onGuardar={async (data) => {
            if (!circuitoSeleccionado) return
            try {
              await updateFormacion(circuitoSeleccionado, {
                cable_id:        Number(data.cable_fase_id),
                nombre:          data.nombre,
                cond_por_fase:   Number(data.cond_por_fase),
                Nfases:          Number(data.Nfases),
                Nneutro:         Number(data.Nneutro),
                cable_neutro_id: data.cable_neutro_id ? Number(data.cable_neutro_id) : null,
                cable_tierra_id: data.cable_tierra_id ? Number(data.cable_tierra_id) : null,
              })
              recargar() // actualiza el contexto global
              setModalAbierto(false)
            } catch (err) {
              console.error('Error al guardar:', err)
            }
          }}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  )
}