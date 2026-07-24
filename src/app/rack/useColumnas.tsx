'use client'
import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import CeldaEditable from '@/components/CeldaEditable'
import type { PuertoRed } from '@/context/ProyectosContext'
import { TIPOS_PUERTO, type ColMeta } from './types'

type Acciones = {
  actualizarCampo: (id: number, campo: keyof PuertoRed, valor: string | number | null) => void
  abrirCableModal: (puerto: PuertoRed) => void
}

const columnHelper = createColumnHelper<PuertoRed>()

const selectCx = 'w-full h-6 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer text-center'

function textoEditable(campo: keyof PuertoRed, actualizarCampo: Acciones['actualizarCampo']) {
  return (info: any) => (
    <CeldaEditable
      valor={info.getValue() ?? ''}
      onGuardar={v => actualizarCampo(info.row.original.id, campo, v.trim() || null)}
    />
  )
}

export function useColumnas(acciones: Acciones) {
  const { actualizarCampo, abrirCableModal } = acciones

  return useMemo(() => [
    columnHelper.accessor('puerto', {
      header: 'Puerto',
      size: 110,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => (
        <CeldaEditable
          valor={info.getValue()}
          onGuardar={v => actualizarCampo(info.row.original.id, 'puerto', v.trim() || info.getValue())}
        />
      ),
    }),
    columnHelper.accessor('descripcion', {
      header: 'Descripción',
      size: 180,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('descripcion', actualizarCampo),
    }),
    columnHelper.accessor('tipo', {
      header: 'Tipo',
      size: 130,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => (
        <select
          value={info.getValue() ?? ''}
          onChange={e => actualizarCampo(info.row.original.id, 'tipo', e.target.value || null)}
          onClick={e => e.stopPropagation()}
          className={selectCx}
          style={{ background: 'var(--clr-surface-a10)' }}
        >
          <option value="">—</option>
          {TIPOS_PUERTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      ),
    }),
    columnHelper.accessor('vlan', {
      header: 'VLAN',
      size: 80,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('vlan', actualizarCampo),
    }),
    columnHelper.accessor('dispositivo_conectado', {
      header: 'Dispositivo conectado',
      size: 170,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('dispositivo_conectado', actualizarCampo),
    }),
    columnHelper.accessor('cable_tipo', {
      header: 'Tipo de cable',
      size: 120,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('cable_tipo', actualizarCampo),
    }),
    columnHelper.accessor('velocidad', {
      header: 'Velocidad',
      size: 100,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('velocidad', actualizarCampo),
    }),
    columnHelper.accessor('fabricante', {
      header: 'Fabricante',
      size: 120,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('fabricante', actualizarCampo),
    }),
    columnHelper.accessor('modelo', {
      header: 'Modelo',
      size: 120,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('modelo', actualizarCampo),
    }),
    columnHelper.display({
      id: 'cable',
      header: 'Cable',
      size: 220,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const puerto = info.row.original
        const openModal = (e: React.MouseEvent) => { e.stopPropagation(); abrirCableModal(puerto) }
        if (!puerto.cable) return <span onClick={openModal} className="text-surface-tonal-a40 text-xs cursor-pointer">Sin cable</span>
        return (
          <span onClick={openModal} className="text-xs cursor-pointer underline decoration-dotted">
            {puerto.cantidad_cables ?? 1} × {puerto.cable.nombre}
          </span>
        )
      },
    }),
  ], [actualizarCampo, abrirCableModal])
}
