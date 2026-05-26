'use client'
import { useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'

const cx = {
  overlay: 'fixed inset-0 bg-black/60 flex items-center justify-center z-100',
  modal: 'bg-surface-tonal-a0 border border-surface-tonal-a20 rounded-[10px] px-[26px] py-[22px] min-w-[420px] max-w-[520px] w-full flex flex-col gap-2.5 max-h-[90vh] overflow-y-auto',
  title: 'text-[15px] font-semibold text-font-a0 mb-1',
  footer: 'flex justify-end mt-2 pt-3 border-t border-surface-tonal-a20',
  list: 'flex flex-col gap-0.75 mb-1',
  item: 'flex items-center gap-2 px-2 py-1.5 bg-surface-tonal-a10 rounded-md',
  name: 'flex-1 text-[13px] text-font-a0',
  nameEditable: 'cursor-pointer rounded-[3px] px-1 py-px -mx-1 -my-px transition-colors hover:bg-white/[0.07]',
  renameInput: 'flex-1 px-1.75 py-0.75 bg-surface-tonal-a0 border border-info-a10 rounded-sm text-font-a0 text-[13px] outline-none',
  btnDanger: 'px-2.25 py-0.75 rounded-sm border border-danger-a0 bg-transparent text-danger-a10 text-[11px] cursor-pointer transition-[background,color] hover:bg-danger-a0 hover:text-font-a0',
  create: 'flex gap-1.5',
  createInput: 'flex-1 px-2.5 py-1.5 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 text-[13px] outline-none focus:border-primary-a20',
  createBtn: 'px-3.5 py-1.5 rounded-md border border-primary-a0 bg-primary-a0 text-font-a0 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-default',
  closeBtn: 'px-4.5 py-1.75 rounded-md border border-surface-tonal-a30 bg-transparent text-font-a20 text-[13px] cursor-pointer hover:bg-surface-tonal-a10 hover:text-font-a0',
  conjuntoBtn: (active: boolean) =>
    `text-left px-2 py-0.5 text-[11px] rounded-[5px] border cursor-pointer transition-[background,color,border-color] duration-100 ${
      active
        ? 'bg-[rgba(33,73,138,0.18)] border-info-a10 text-font-a0'
        : 'border-surface-tonal-a20 bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
    }`,
}

export function ArquitecturasModal({ onClose }: { onClose: () => void }) {
  const {
    conjuntos, tablaParedes, paredes, activaArquitecturaId,
    addArquitectura, renameArquitectura, deleteArquitectura,
    setActivaArquitecturaId,
    addArquitecturaToConjunto, removeArquitecturaFromConjunto,
    editPared,
  } = useProyectos()

  const [newName,       setNewName]       = useState('')
  const [editingTablaId,   setEditingTablaId]   = useState<number | null>(null)
  const [editingTablaVal,  setEditingTablaVal]  = useState('')
  const [editingParedId,   setEditingParedId]   = useState<number | null>(null)
  const [editingParedVal,  setEditingParedVal]  = useState('')

  const commitTabla = (id: number) => {
    const name = editingTablaVal.trim()
    if (name) renameArquitectura(id, name)
    setEditingTablaId(null)
  }

  const commitPared = (id: number) => {
    editPared(id, { nombre: editingParedVal.trim() || null })
    setEditingParedId(null)
  }

  const handleCreate = () => {
    const name = newName.trim(); if (!name) return
    addArquitectura(name); setNewName('')
  }

  return (
    <div className={cx.overlay} onClick={onClose}>
      <div className={cx.modal} onClick={e => e.stopPropagation()}>

        <div className={cx.title}>Tablas de paredes</div>

        {tablaParedes.length === 0 && (
          <p className="text-xs text-[#ff8888] m-0 mb-3">
            ⚠ No hay tablas. Creá una para poder dibujar paredes.
          </p>
        )}

        <div className={cx.list}>
          {tablaParedes.map(tp => {
            const tpParedes = paredes.filter(p => p.tabla_pared_id === tp.id)
            const isActiva  = activaArquitecturaId === tp.id
            return (
              <div key={tp.id} className="flex items-stretch gap-2 px-2 py-1.5 bg-surface-tonal-a10 rounded-md flex-col">

                <div className="flex items-center gap-1.5">
                  <button
                    className={cx.conjuntoBtn(isActiva)}
                    onClick={() => setActivaArquitecturaId(tp.id)}
                    title="Seleccionar como activa"
                  >{isActiva ? '● Activa' : '○ Activar'}</button>

                  {editingTablaId === tp.id ? (
                    <input className={`${cx.renameInput} flex-1`} value={editingTablaVal} autoFocus
                      onChange={e => setEditingTablaVal(e.target.value)}
                      onBlur={() => commitTabla(tp.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  commitTabla(tp.id)
                        if (e.key === 'Escape') setEditingTablaId(null)
                      }} />
                  ) : (
                    <span
                      className={`${cx.name} ${cx.nameEditable} flex-1`}
                      title="Click para editar"
                      onClick={() => { setEditingTablaId(tp.id); setEditingTablaVal(tp.nombre) }}
                    >
                      {tp.nombre}
                      <span className="text-surface-tonal-a40 ml-1.5 text-[11px]">
                        ({tpParedes.length} pared{tpParedes.length !== 1 ? 'es' : ''})
                      </span>
                    </span>
                  )}

                  <button className={cx.btnDanger} onClick={() => deleteArquitectura(tp.id)}>Eliminar</button>
                </div>

                {conjuntos.length > 0 && (
                  <div className="flex flex-wrap gap-1 pl-0.5">
                    <span className="text-[11px] text-surface-tonal-a40 self-center mr-0.5">Aplicar en:</span>
                    {conjuntos.map(c => {
                      const applied = tp.conjuntos.some(tc => tc.id === c.id)
                      return (
                        <button key={c.id}
                          className={cx.conjuntoBtn(applied)}
                          onClick={() => applied
                            ? removeArquitecturaFromConjunto(tp.id, c.id)
                            : addArquitecturaToConjunto(tp.id, c.id)}
                        >{applied ? '✓ ' : ''}{c.nombre}</button>
                      )
                    })}
                  </div>
                )}

                {tpParedes.length > 0 && (
                  <div className="pl-2 border-l-2 border-surface-tonal-a20 flex flex-col gap-1">
                    {tpParedes.map(p => (
                      <div key={p.id} className="flex items-center gap-1.5">
                        {editingParedId === p.id ? (
                          <input className={`${cx.renameInput} flex-1`} value={editingParedVal} autoFocus
                            placeholder="Nombre de la pared…"
                            onChange={e => setEditingParedVal(e.target.value)}
                            onBlur={() => commitPared(p.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  commitPared(p.id)
                              if (e.key === 'Escape') setEditingParedId(null)
                            }} />
                        ) : (
                          <span
                            className={`${cx.nameEditable} flex-1 text-xs ${p.nombre ? 'text-font-a20' : 'text-surface-tonal-a40 italic'}`}
                            title="Click para editar nombre"
                            onClick={() => { setEditingParedId(p.id); setEditingParedVal(p.nombre ?? '') }}
                          >{p.nombre || 'Sin nombre'}</span>
                        )}
                        <span className="text-[10px] text-surface-tonal-a40">
                          ({(p.x1/100).toFixed(1)}, {(p.y1/100).toFixed(1)}) → ({(p.x2/100).toFixed(1)}, {(p.y2/100).toFixed(1)})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className={cx.create}>
          <input className={cx.createInput} placeholder="Nombre de la nueva tabla…"
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }} />
          <button className={cx.createBtn} onClick={handleCreate} disabled={!newName.trim()}>Crear</button>
        </div>

        <div className={cx.footer}>
          <button className={cx.closeBtn} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
