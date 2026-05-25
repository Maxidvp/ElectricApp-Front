'use client'
import { useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'

export function ConjuntosModal({ onClose }: { onClose: () => void }) {
  const {
    conjuntos, tableros,
    addConjunto, renameConjunto, deleteConjunto,
    addTableroToConjunto, removeTableroFromConjunto,
  } = useProyectos()

  const [tableroConjuntoId, setTableroConjuntoId] = useState<number | ''>(conjuntos[0]?.id ?? '')
  const [newName,    setNewName]    = useState('')
  const [editingId,  setEditingId]  = useState<number | null>(null)
  const [editingVal, setEditingVal] = useState('')

  const commitRename = (id: number) => {
    const name = editingVal.trim()
    if (name) renameConjunto(id, name)
    setEditingId(null)
  }

  const handleCreate = () => {
    const name = newName.trim(); if (!name) return
    addConjunto(name); setNewName('')
  }

  return (
    <div className="ruteo-modal-overlay" onClick={onClose}>
      <div className="ruteo-modal" onClick={e => e.stopPropagation()}>

        <div className="ruteo-modal-title">Canalizaciones</div>

        <div className="rcm-list">
          {conjuntos.map(c => (
            <div key={c.id} className="rcm-item">
              {editingId === c.id ? (
                <input className="rcm-rename-input" value={editingVal} autoFocus
                  onChange={e => setEditingVal(e.target.value)}
                  onBlur={() => commitRename(c.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  commitRename(c.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }} />
              ) : (
                <span
                  className="rcm-name rcm-name-editable"
                  title="Click para editar"
                  onClick={() => { setEditingId(c.id); setEditingVal(c.nombre) }}
                >{c.nombre}</span>
              )}
              <div className="rcm-actions">
                {conjuntos.length > 1 && (
                  <button className="rcm-btn danger" onClick={() => deleteConjunto(c.id)}>Eliminar</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="rcm-create">
          <input className="rcm-create-input" placeholder="Nombre de la nueva canalización…"
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }} />
          <button className="rcm-create-btn" onClick={handleCreate} disabled={!newName.trim()}>Crear</button>
        </div>

        {tableros.length > 0 && (
          <>
            <div className="ruteo-modal-section-label" style={{ marginTop: 20 }}>Tableros por canalización</div>
            <div className="rcm-copy-row" style={{ alignItems: 'center' }}>
              <select className="rcm-copy-select" value={tableroConjuntoId}
                onChange={e => setTableroConjuntoId(Number(e.target.value))}>
                {conjuntos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {tableroConjuntoId !== '' && (() => {
              const conj = conjuntos.find(c => c.id === tableroConjuntoId)
              if (!conj) return null
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {tableros.map(t => {
                    const inC = conj.tableros.some(ct => ct.id === t.id)
                    return (
                      <button key={t.id}
                        className={`panel-seg-conjunto-btn${inC ? ' in' : ''}`}
                        onClick={() => inC
                          ? removeTableroFromConjunto(conj.id, t.id)
                          : addTableroToConjunto(conj.id, t.id)}
                      >{inC ? '✓ ' : ''}{t.tag}</button>
                    )
                  })}
                </div>
              )
            })()}
          </>
        )}

        <div className="ruteo-modal-footer">
          <button className="rcm-close-btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
