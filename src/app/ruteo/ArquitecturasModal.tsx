'use client'
import { useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'

const cx = {
  overlay: 'fixed inset-0 bg-black/60 flex items-center justify-center z-100',
  modal: 'bg-surface-tonal-a0 border border-surface-tonal-a20 rounded-[10px] px-[26px] py-[22px] min-w-[420px] max-w-[520px] w-full flex flex-col gap-2.5',
  title: 'text-[15px] font-semibold text-font-a0 mb-1',
  footer: 'flex justify-end mt-2 pt-3 border-t border-surface-tonal-a20',
  list: 'flex flex-col gap-0.75 mb-1',
  item: 'flex items-center gap-2 px-2 py-1.5 bg-surface-tonal-a10 rounded-md',
  name: 'flex-1 text-[13px] text-font-a0',
  nameEditable: 'cursor-pointer rounded-[3px] px-1 py-px -mx-1 -my-px transition-colors hover:bg-white/[0.07]',
  renameInput: 'flex-1 px-1.75 py-0.75 bg-surface-tonal-a0 border border-info-a10 rounded-sm text-font-a0 text-[13px] outline-none',
  activaBtn: (active: boolean) =>
    `px-2 py-0.5 text-[11px] rounded-[5px] border cursor-pointer transition-[background,color,border-color] duration-100 shrink-0 ${
      active
        ? 'bg-[rgba(33,73,138,0.18)] border-info-a10 text-font-a0'
        : 'border-surface-tonal-a20 bg-transparent text-surface-tonal-a40 hover:bg-surface-tonal-a10 hover:text-font-a0'
    }`,
  btnDanger: 'px-2.25 py-0.75 rounded-sm border border-danger-a0 bg-transparent text-danger-a10 text-[11px] cursor-pointer transition-[background,color] hover:bg-danger-a0 hover:text-font-a0 shrink-0',
  create: 'flex gap-1.5',
  createInput: 'flex-1 px-2.5 py-1.5 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 text-[13px] outline-none focus:border-primary-a20',
  createBtn: 'px-3.5 py-1.5 rounded-md border border-primary-a0 bg-primary-a0 text-font-a0 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-default',
  closeBtn: 'px-4.5 py-1.75 rounded-md border border-surface-tonal-a30 bg-transparent text-font-a20 text-[13px] cursor-pointer hover:bg-surface-tonal-a10 hover:text-font-a0',
}

export function ArquitecturasModal({ onClose }: { onClose: () => void }) {
  const {
    tablaParedes, paredes, activaArquitecturaId,
    addArquitectura, renameArquitectura, deleteArquitectura,
    setActivaArquitecturaId,
  } = useProyectos()

  const [newName,   setNewName]   = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingVal, setEditingVal] = useState('')

  const commitRename = (id: number) => {
    const name = editingVal.trim()
    if (name) renameArquitectura(id, name)
    setEditingId(null)
  }

  const handleCreate = () => {
    const name = newName.trim(); if (!name) return
    addArquitectura(name); setNewName('')
  }

  return (
    <div className={cx.overlay} onClick={onClose}>
      <div className={cx.modal} onClick={e => e.stopPropagation()}>

        <div className={cx.title}>Arquitecturas</div>

        {tablaParedes.length === 0 && (
          <p className="text-xs text-[#ff8888] m-0 mb-1">
            ⚠ No hay arquitecturas. Creá una para poder dibujar paredes.
          </p>
        )}

        <div className={cx.list}>
          {tablaParedes.map(tp => {
            const count   = paredes.filter(p => p.tabla_pared_id === tp.id).length
            const isActiva = activaArquitecturaId === tp.id
            return (
              <div key={tp.id} className={cx.item}>
                <button
                  className={cx.activaBtn(isActiva)}
                  onClick={() => setActivaArquitecturaId(tp.id)}
                  title="Usar esta arquitectura al dibujar"
                >
                  {isActiva ? '● Activa' : '○'}
                </button>

                {editingId === tp.id ? (
                  <input
                    className={cx.renameInput}
                    value={editingVal}
                    autoFocus
                    onChange={e => setEditingVal(e.target.value)}
                    onBlur={() => commitRename(tp.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  commitRename(tp.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                ) : (
                  <span
                    className={`${cx.name} ${cx.nameEditable}`}
                    title="Click para editar"
                    onClick={() => { setEditingId(tp.id); setEditingVal(tp.nombre) }}
                  >
                    {tp.nombre}
                    <span className="text-surface-tonal-a40 ml-1.5 text-[11px]">
                      ({count} pared{count !== 1 ? 'es' : ''})
                    </span>
                  </span>
                )}

                <button className={cx.btnDanger} onClick={() => deleteArquitectura(tp.id)}>
                  Eliminar
                </button>
              </div>
            )
          })}
        </div>

        <div className={cx.create}>
          <input
            className={cx.createInput}
            placeholder="Nombre de la nueva arquitectura…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          />
          <button className={cx.createBtn} onClick={handleCreate} disabled={!newName.trim()}>
            Crear
          </button>
        </div>

        <div className={cx.footer}>
          <button className={cx.closeBtn} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
