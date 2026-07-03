'use client'
import { useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'

const cx = {
  overlay: 'fixed inset-0 bg-black/60 flex items-center justify-center z-100',
  modal: 'bg-surface-tonal-a0 border border-surface-tonal-a20 rounded-[10px] w-[520px] max-w-[95vw] max-h-[85vh] flex flex-col',
  header: 'px-[26px] pt-[22px] pb-0 shrink-0',
  title: 'text-[15px] font-semibold text-font-a0 mb-3',
  scroll: 'flex flex-col gap-4 px-[26px] py-3 overflow-y-auto flex-1',
  footer: 'flex justify-end px-[26px] py-4 border-t border-surface-tonal-a20 shrink-0',
  list: 'flex flex-col gap-0.75',
  item: 'flex items-center gap-2 px-2 py-1.5 bg-surface-tonal-a10 rounded-md',
  name: 'flex-1 text-[13px] text-font-a0',
  nameEditable: 'cursor-pointer rounded-[3px] px-1 py-px -mx-1 -my-px transition-colors hover:bg-white/[0.07]',
  renameInput: 'flex-1 px-1.75 py-0.75 bg-surface-tonal-a0 border border-info-a10 rounded-sm text-font-a0 text-[13px] outline-none',
  actions: 'flex gap-1 shrink-0',
  btn: 'px-2.25 py-0.75 rounded-sm border border-surface-tonal-a30 bg-transparent text-font-a20 text-[11px] cursor-pointer transition-[background,color] hover:bg-surface-tonal-a20 hover:text-font-a0',
  btnDanger: 'px-2.25 py-0.75 rounded-sm border border-danger-a0 bg-transparent text-danger-a10 text-[11px] cursor-pointer transition-[background,color] hover:bg-danger-a0 hover:text-font-a0',
  create: 'flex gap-1.5',
  createInput: 'flex-1 px-2.5 py-1.5 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 text-[13px] outline-none focus:border-primary-a20',
  createBtn: 'px-3.5 py-1.5 rounded-md border border-primary-a0 bg-primary-a0 text-font-a0 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-default',
  activoBtn: (active: boolean) =>
    `px-2 py-0.5 text-[11px] rounded-[5px] border cursor-pointer transition-[background,color,border-color] duration-100 shrink-0 ${
      active
        ? 'bg-[rgba(33,73,138,0.18)] border-info-a10 text-font-a0'
        : 'border-surface-tonal-a20 bg-transparent text-surface-tonal-a40 hover:bg-surface-tonal-a10 hover:text-font-a0'
    }`,
  vinculoBtn: (active: boolean) =>
    `px-2 py-0.5 text-[11px] rounded-[5px] border cursor-pointer transition-[background,color,border-color] duration-100 shrink-0 ${
      active
        ? 'bg-[rgba(80,140,80,0.18)] border-success-a20 text-success-a20'
        : 'border-surface-tonal-a20 bg-transparent text-surface-tonal-a40 hover:bg-surface-tonal-a10 hover:text-font-a0'
    }`,
  closeBtn: 'px-4.5 py-1.75 rounded-md border border-surface-tonal-a30 bg-transparent text-font-a20 text-[13px] cursor-pointer hover:bg-surface-tonal-a10 hover:text-font-a0',
  sectionLabel: 'text-[11px] font-semibold text-font-a20 uppercase tracking-[0.05em]',
  tableroBtn: (active: boolean) =>
    `px-2 py-1.25 rounded-[5px] border text-xs cursor-pointer transition-[background,color,border-color] duration-100 ${
      active
        ? 'bg-[rgba(33,73,138,0.18)] border-info-a10 text-font-a0'
        : 'border-surface-tonal-a20 bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
    }`,
  divider: 'h-px bg-surface-tonal-a20',
}

export function ConjuntosModal({ onClose }: { onClose: () => void }) {
  const {
    conjuntos, tableros,
    activeConjuntoId, setActiveConjuntoId,
    addConjunto, renameConjunto, deleteConjunto,
    addTableroToConjunto, removeTableroFromConjunto,
    tablaParedes, paredes, activaArquitecturaId, setActivaArquitecturaId,
    addArquitectura, renameArquitectura, deleteArquitectura,
    addArquitecturaToConjunto, removeArquitecturaFromConjunto,
  } = useProyectos()

  const [newConjName,    setNewConjName]    = useState('')
  const [editingConjId,  setEditingConjId]  = useState<number | null>(null)
  const [editingConjVal, setEditingConjVal] = useState('')

  const [newArqName,    setNewArqName]    = useState('')
  const [editingArqId,  setEditingArqId]  = useState<number | null>(null)
  const [editingArqVal, setEditingArqVal] = useState('')

  const commitRenameConj = (id: number) => {
    const name = editingConjVal.trim()
    if (name) renameConjunto(id, name)
    setEditingConjId(null)
  }

  const commitRenameArq = (id: number) => {
    const name = editingArqVal.trim()
    if (name) renameArquitectura(id, name)
    setEditingArqId(null)
  }

  const handleCreateConj = () => {
    const name = newConjName.trim(); if (!name) return
    addConjunto(name); setNewConjName('')
  }

  const handleCreateArq = async () => {
    const name = newArqName.trim(); if (!name) return
    const arq = await addArquitectura(name)
    if (arq && activeConj) {
      addArquitecturaToConjunto(arq.id, activeConj.id)
      setActivaArquitecturaId(arq.id)
    }
    setNewArqName('')
  }

  const toggleArqEnConj = (arqId: number) => {
    if (!activeConj) return
    const inConj = activeConj.arquitecturas.some(a => a.id === arqId)
    if (inConj) {
      removeArquitecturaFromConjunto(arqId, activeConj.id)
      if (activaArquitecturaId === arqId) setActivaArquitecturaId(null)
    } else {
      addArquitecturaToConjunto(arqId, activeConj.id)
      setActivaArquitecturaId(arqId)
    }
  }

  const activeConj = conjuntos.find(c => c.id === activeConjuntoId)

  return (
    <div className={cx.overlay} onClick={onClose}>
      <div className={cx.modal} onClick={e => e.stopPropagation()}>

        <div className={cx.header}>
          <div className={cx.title}>Canalizaciones</div>
        </div>

        <div className={cx.scroll}>

          {/* ── Lista de conjuntos ── */}
          <div className={cx.list}>
            {conjuntos.map(c => (
              <div key={c.id} className={cx.item}>
                <button
                  className={cx.activoBtn(activeConjuntoId === c.id)}
                  onClick={() => setActiveConjuntoId(c.id)}
                  title="Usar esta canalización"
                >
                  {activeConjuntoId === c.id ? '● Activa' : '○'}
                </button>
                {editingConjId === c.id ? (
                  <input className={cx.renameInput} value={editingConjVal} autoFocus
                    onChange={e => setEditingConjVal(e.target.value)}
                    onBlur={() => commitRenameConj(c.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  commitRenameConj(c.id)
                      if (e.key === 'Escape') setEditingConjId(null)
                    }} />
                ) : (
                  <span
                    className={`${cx.name} ${cx.nameEditable}`}
                    title="Click para editar"
                    onClick={() => { setEditingConjId(c.id); setEditingConjVal(c.nombre) }}
                  >{c.nombre}</span>
                )}
                <div className={cx.actions}>
                  {conjuntos.length > 1 && (
                    <button className={cx.btnDanger} onClick={() => deleteConjunto(c.id)}>Eliminar</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className={cx.create}>
            <input className={cx.createInput} placeholder="Nombre de la nueva canalización…"
              value={newConjName} onChange={e => setNewConjName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateConj() }} />
            <button className={cx.createBtn} onClick={handleCreateConj} disabled={!newConjName.trim()}>Crear</button>
          </div>

          {activeConj && (<>

            {/* ── Tableros del conjunto activo ── */}
            {tableros.length > 0 && (<>
              <div className={cx.divider} />
              <div className="flex flex-col gap-1.5">
                <span className={cx.sectionLabel}>Tableros — {activeConj.nombre}</span>
                <div className="flex flex-wrap gap-1.5">
                  {tableros.map(t => {
                    const inC = activeConj.tableros.some(ct => ct.id === t.id)
                    return (
                      <button
                        key={t.id}
                        className={cx.tableroBtn(inC)}
                        onClick={() => inC
                          ? removeTableroFromConjunto(activeConj.id, t.id)
                          : addTableroToConjunto(activeConj.id, t.id)}
                      >
                        {inC ? '✓ ' : ''}{t.tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>)}

            {/* ── Arquitectura del conjunto activo ── */}
            <div className={cx.divider} />
            <div className="flex flex-col gap-2">
              <span className={cx.sectionLabel}>Arquitectura — {activeConj.nombre}</span>

              {tablaParedes.length === 0 && (
                <p className="text-xs text-[#ff8888] m-0">
                  ⚠ No hay arquitecturas. Creá una para poder dibujar paredes.
                </p>
              )}

              <div className={cx.list}>
                {tablaParedes.map(tp => {
                  const count  = paredes.filter(p => p.tabla_pared_id === tp.id).length
                  const inConj = activeConj.arquitecturas.some(a => a.id === tp.id)
                  return (
                    <div key={tp.id} className={cx.item}>
                      <button
                        className={cx.activoBtn(inConj)}
                        onClick={() => toggleArqEnConj(tp.id)}
                        title={inConj ? 'Click para desvincular' : 'Usar esta arquitectura para este conjunto'}
                      >
                        {inConj ? '● Activa' : '○'}
                      </button>

                      {editingArqId === tp.id ? (
                        <input className={cx.renameInput} value={editingArqVal} autoFocus
                          onChange={e => setEditingArqVal(e.target.value)}
                          onBlur={() => commitRenameArq(tp.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  commitRenameArq(tp.id)
                            if (e.key === 'Escape') setEditingArqId(null)
                          }} />
                      ) : (
                        <span
                          className={`${cx.name} ${cx.nameEditable}`}
                          title="Click para editar"
                          onClick={() => { setEditingArqId(tp.id); setEditingArqVal(tp.nombre) }}
                        >
                          {tp.nombre}
                          <span className="text-surface-tonal-a40 ml-1.5 text-[11px]">
                            ({count} pared{count !== 1 ? 'es' : ''})
                          </span>
                        </span>
                      )}

                      <div className={cx.actions}>
                        <button className={cx.btnDanger} onClick={() => deleteArquitectura(tp.id)}>Eliminar</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className={cx.create}>
                <input className={cx.createInput} placeholder="Nombre de la nueva arquitectura…"
                  value={newArqName} onChange={e => setNewArqName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateArq() }} />
                <button className={cx.createBtn} onClick={handleCreateArq} disabled={!newArqName.trim()}>Crear</button>
              </div>
            </div>

          </>)}

        </div>

        <div className={cx.footer}>
          <button className={cx.closeBtn} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
