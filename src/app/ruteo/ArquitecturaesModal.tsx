'use client'
import { useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'

export function ArquitecturaesModal({ onClose }: { onClose: () => void }) {
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
    <div className="ruteo-modal-overlay" onClick={onClose}>
      <div className="ruteo-modal" onClick={e => e.stopPropagation()}>

        <div className="ruteo-modal-title">Tablas de paredes</div>

        {tablaParedes.length === 0 && (
          <p style={{ fontSize: 12, color: '#ff8888', margin: '0 0 12px' }}>
            ⚠ No hay tablas. Creá una para poder dibujar paredes.
          </p>
        )}

        <div className="rcm-list">
          {tablaParedes.map(tp => {
            const tpParedes = paredes.filter(p => p.tabla_pared_id === tp.id)
            const isActiva  = activaArquitecturaId === tp.id
            return (
              <div key={tp.id} className="rcm-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>

                {/* Tabla header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    className={`panel-seg-conjunto-btn${isActiva ? ' in' : ''}`}
                    style={{ flexShrink: 0, fontSize: 11, padding: '2px 8px' }}
                    onClick={() => setActivaArquitecturaId(tp.id)}
                    title="Seleccionar como activa"
                  >{isActiva ? '● Activa' : '○ Activar'}</button>

                  {editingTablaId === tp.id ? (
                    <input className="rcm-rename-input" value={editingTablaVal} autoFocus
                      style={{ flex: 1 }}
                      onChange={e => setEditingTablaVal(e.target.value)}
                      onBlur={() => commitTabla(tp.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  commitTabla(tp.id)
                        if (e.key === 'Escape') setEditingTablaId(null)
                      }} />
                  ) : (
                    <span
                      className="rcm-name rcm-name-editable"
                      style={{ flex: 1 }}
                      title="Click para editar"
                      onClick={() => { setEditingTablaId(tp.id); setEditingTablaVal(tp.nombre) }}
                    >
                      {tp.nombre}
                      <span style={{ color: '#666', marginLeft: 6, fontSize: 11 }}>
                        ({tpParedes.length} pared{tpParedes.length !== 1 ? 'es' : ''})
                      </span>
                    </span>
                  )}

                  <button className="rcm-btn danger" onClick={() => deleteArquitectura(tp.id)}>Eliminar</button>
                </div>

                {/* Conjuntos where this tabla is applied */}
                {conjuntos.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 2 }}>
                    <span style={{ fontSize: 11, color: '#888', alignSelf: 'center', marginRight: 2 }}>Aplicar en:</span>
                    {conjuntos.map(c => {
                      const applied = tp.conjuntos.some(tc => tc.id === c.id)
                      return (
                        <button key={c.id}
                          className={`panel-seg-conjunto-btn${applied ? ' in' : ''}`}
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => applied
                            ? removeArquitecturaFromConjunto(tp.id, c.id)
                            : addArquitecturaToConjunto(tp.id, c.id)}
                        >{applied ? '✓ ' : ''}{c.nombre}</button>
                      )
                    })}
                  </div>
                )}

                {/* Individual paredes */}
                {tpParedes.length > 0 && (
                  <div style={{ paddingLeft: 8, borderLeft: '2px solid #333', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {tpParedes.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {editingParedId === p.id ? (
                          <input className="rcm-rename-input" value={editingParedVal} autoFocus
                            style={{ flex: 1 }}
                            placeholder="Nombre de la pared…"
                            onChange={e => setEditingParedVal(e.target.value)}
                            onBlur={() => commitPared(p.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  commitPared(p.id)
                              if (e.key === 'Escape') setEditingParedId(null)
                            }} />
                        ) : (
                          <span
                            className="rcm-name rcm-name-editable"
                            style={{ flex: 1, fontSize: 12, color: p.nombre ? '#ccc' : '#555', fontStyle: p.nombre ? 'normal' : 'italic' }}
                            title="Click para editar nombre"
                            onClick={() => { setEditingParedId(p.id); setEditingParedVal(p.nombre ?? '') }}
                          >{p.nombre || 'Sin nombre'}</span>
                        )}
                        <span style={{ fontSize: 10, color: '#555' }}>
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

        <div className="rcm-create">
          <input className="rcm-create-input" placeholder="Nombre de la nueva tabla…"
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }} />
          <button className="rcm-create-btn" onClick={handleCreate} disabled={!newName.trim()}>Crear</button>
        </div>

        <div className="ruteo-modal-footer">
          <button className="rcm-close-btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
