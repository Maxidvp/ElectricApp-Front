'use client'
import { useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'

export function ConjuntosModal({ onClose }: { onClose: () => void }) {
  const {
    conjuntos, tableros, tablaParedes, activaTablaParedId,
    addConjunto, renameConjunto, deleteConjunto,
    addTableroToConjunto, removeTableroFromConjunto,
    addTablaPared, renameTablaPared, deleteTablaPared,
    setActivaTablaParedId,
    addTablaParedToConjunto, removeTablaParedFromConjunto,
  } = useProyectos()

  const [tableroConjuntoId, setTableroConjuntoId] = useState<number | ''>(conjuntos[0]?.id ?? '')
  const [newConjName,       setNewConjName]       = useState('')
  const [editingConjId,     setEditingConjId]     = useState<number | null>(null)
  const [editingConjName,   setEditingConjName]   = useState('')

  const [newTablaName,      setNewTablaName]      = useState('')
  const [editingTablaId,    setEditingTablaId]    = useState<number | null>(null)
  const [editingTablaName,  setEditingTablaName]  = useState('')

  // ── Conjuntos ──────────────────────────────────────────────────
  const handleCreateConj = () => {
    const name = newConjName.trim(); if (!name) return
    addConjunto(name); setNewConjName('')
  }

  const handleRenameConj = (id: number) => {
    const name = editingConjName.trim(); if (name) renameConjunto(id, name)
    setEditingConjId(null)
  }

  // ── Tablas de paredes ──────────────────────────────────────────
  const handleCreateTabla = () => {
    const name = newTablaName.trim(); if (!name) return
    addTablaPared(name); setNewTablaName('')
  }

  const handleRenameTabla = (id: number) => {
    const name = editingTablaName.trim(); if (name) renameTablaPared(id, name)
    setEditingTablaId(null)
  }

  return (
    <div className="ruteo-modal-overlay" onClick={onClose}>
      <div className="ruteo-modal" onClick={e => e.stopPropagation()}>

        {/* ── Conjuntos ─────────────────────────────────────────── */}
        <div className="ruteo-modal-title">Configurar conjuntos</div>

        <div className="ruteo-modal-section-label">Conjuntos</div>
        <div className="rcm-list">
          {conjuntos.map(c => (
            <div key={c.id} className="rcm-item">
              {editingConjId === c.id ? (
                <input className="rcm-rename-input" value={editingConjName} autoFocus
                  onChange={e => setEditingConjName(e.target.value)}
                  onBlur={() => handleRenameConj(c.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameConj(c.id)
                    if (e.key === 'Escape') setEditingConjId(null)
                  }} />
              ) : (
                <span className="rcm-name">{c.nombre}</span>
              )}
              <div className="rcm-actions">
                {editingConjId !== c.id && (
                  <button className="rcm-btn" onClick={() => { setEditingConjId(c.id); setEditingConjName(c.nombre) }}>
                    Renombrar
                  </button>
                )}
                {conjuntos.length > 1 && (
                  <button className="rcm-btn danger" onClick={() => deleteConjunto(c.id)}>Eliminar</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="rcm-create">
          <input className="rcm-create-input" placeholder="Nombre del nuevo conjunto…"
            value={newConjName} onChange={e => setNewConjName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateConj() }} />
          <button className="rcm-create-btn" onClick={handleCreateConj} disabled={!newConjName.trim()}>Crear</button>
        </div>

        {/* ── Tableros ───────────────────────────────────────────── */}
        {tableros.length > 0 && (
          <>
            <div className="ruteo-modal-section-label" style={{ marginTop: 20 }}>Tableros por conjunto</div>
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

        {/* ── Tablas de paredes ─────────────────────────────────── */}
        <div className="ruteo-modal-section-label" style={{ marginTop: 20 }}>Tablas de paredes</div>

        {tablaParedes.length === 0 && (
          <p style={{ fontSize: 12, color: '#aaa', margin: '4px 0 8px' }}>
            No hay tablas. Creá una para poder dibujar paredes.
          </p>
        )}

        <div className="rcm-list">
          {tablaParedes.map(tp => (
            <div key={tp.id} className="rcm-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Active indicator */}
                <button
                  className={`panel-seg-conjunto-btn${activaTablaParedId === tp.id ? ' in' : ''}`}
                  style={{ flexShrink: 0, fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setActivaTablaParedId(tp.id)}
                  title="Seleccionar como activa"
                >{activaTablaParedId === tp.id ? '● Activa' : '○ Activar'}</button>

                {editingTablaId === tp.id ? (
                  <input className="rcm-rename-input" value={editingTablaName} autoFocus
                    style={{ flex: 1 }}
                    onChange={e => setEditingTablaName(e.target.value)}
                    onBlur={() => handleRenameTabla(tp.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameTabla(tp.id)
                      if (e.key === 'Escape') setEditingTablaId(null)
                    }} />
                ) : (
                  <span className="rcm-name" style={{ flex: 1 }}>
                    {tp.nombre}
                    <span style={{ color: '#666', marginLeft: 6, fontSize: 11 }}>
                      ({tp.paredes.length} pared{tp.paredes.length !== 1 ? 'es' : ''})
                    </span>
                  </span>
                )}

                <div className="rcm-actions">
                  {editingTablaId !== tp.id && (
                    <button className="rcm-btn" onClick={() => { setEditingTablaId(tp.id); setEditingTablaName(tp.nombre) }}>
                      Renombrar
                    </button>
                  )}
                  <button className="rcm-btn danger" onClick={() => deleteTablaPared(tp.id)}>Eliminar</button>
                </div>
              </div>

              {/* Conjuntos where this tabla is applied */}
              {conjuntos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 4 }}>
                  <span style={{ fontSize: 11, color: '#888', alignSelf: 'center', marginRight: 2 }}>Aplicar en:</span>
                  {conjuntos.map(c => {
                    const applied = tp.conjuntos.some(tc => tc.id === c.id)
                    return (
                      <button key={c.id}
                        className={`panel-seg-conjunto-btn${applied ? ' in' : ''}`}
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => applied
                          ? removeTablaParedFromConjunto(tp.id, c.id)
                          : addTablaParedToConjunto(tp.id, c.id)}
                      >{applied ? '✓ ' : ''}{c.nombre}</button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="rcm-create">
          <input className="rcm-create-input" placeholder="Nombre de la nueva tabla…"
            value={newTablaName} onChange={e => setNewTablaName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateTabla() }} />
          <button className="rcm-create-btn" onClick={handleCreateTabla} disabled={!newTablaName.trim()}>Crear</button>
        </div>

        <div className="ruteo-modal-footer">
          <button className="rcm-close-btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
