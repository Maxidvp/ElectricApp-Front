'use client'
import { useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'

export function ConjuntosModal({ onClose }: { onClose: () => void }) {
  const { conjuntos, paredes, tableros, addConjunto, renameConjunto, deleteConjunto, addParedToConjunto, addTableroToConjunto, removeTableroFromConjunto } = useProyectos()
  const [tableroConjuntoId, setTableroConjuntoId] = useState<number | ''>(conjuntos[0]?.id ?? '')
  const [newName,     setNewName]     = useState('')
  const [editingId,   setEditingId]   = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [copyFrom,    setCopyFrom]    = useState<number | ''>(conjuntos[0]?.id ?? '')
  const [copyTo,      setCopyTo]      = useState<number | ''>(conjuntos[1]?.id ?? '')
  const [copied,      setCopied]      = useState(false)

  const paredesDe = (conjId: number | '') =>
    conjId !== '' ? paredes.filter(p => p.conjuntos.some(c => c.id === conjId)) : []

  const paredsPendientes = copyFrom !== '' && copyTo !== '' && copyFrom !== copyTo
    ? paredesDe(copyFrom).filter(p => !p.conjuntos.some(c => c.id === copyTo)).length
    : 0

  const handleCreate = () => {
    const name = newName.trim(); if (!name) return
    addConjunto(name); setNewName('')
  }

  const handleRenameCommit = (id: number) => {
    const name = editingName.trim(); if (name) renameConjunto(id, name)
    setEditingId(null)
  }

  const handleCopy = () => {
    if (copyFrom === '' || copyTo === '' || copyFrom === copyTo) return
    paredesDe(copyFrom).forEach(p => {
      if (!p.conjuntos.some(c => c.id === copyTo)) addParedToConjunto(Number(copyTo), p.id)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="ruteo-modal-overlay" onClick={onClose}>
      <div className="ruteo-modal" onClick={e => e.stopPropagation()}>

        <div className="ruteo-modal-title">Configurar conjuntos</div>

        <div className="ruteo-modal-section-label">Conjuntos</div>
        <div className="rcm-list">
          {conjuntos.map(c => (
            <div key={c.id} className="rcm-item">
              {editingId === c.id ? (
                <input className="rcm-rename-input" value={editingName} autoFocus
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={() => handleRenameCommit(c.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameCommit(c.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }} />
              ) : (
                <span className="rcm-name">{c.nombre}</span>
              )}
              <div className="rcm-actions">
                {editingId !== c.id && (
                  <button className="rcm-btn" onClick={() => { setEditingId(c.id); setEditingName(c.nombre) }}>
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
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }} />
          <button className="rcm-create-btn" onClick={handleCreate} disabled={!newName.trim()}>Crear</button>
        </div>

        {conjuntos.length >= 2 && (
          <>
            <div className="ruteo-modal-section-label" style={{ marginTop: 20 }}>Copiar paredes</div>
            <div className="rcm-copy-row">
              <select className="rcm-copy-select" value={copyFrom}
                onChange={e => { setCopyFrom(Number(e.target.value)); setCopied(false) }}>
                {conjuntos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <span className="rcm-copy-arrow">→</span>
              <select className="rcm-copy-select" value={copyTo}
                onChange={e => { setCopyTo(Number(e.target.value)); setCopied(false) }}>
                {conjuntos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button className="rcm-copy-btn" onClick={handleCopy}
                disabled={!paredsPendientes || copied}>
                {copied ? '✓ Copiado' : `Copiar${paredsPendientes ? ` (${paredsPendientes})` : ''}`}
              </button>
            </div>
            {copyFrom === copyTo && copyFrom !== '' && (
              <p className="rcm-copy-warn">Origen y destino deben ser distintos</p>
            )}
          </>
        )}

        {tableros.length > 0 && (
          <>
            <div className="ruteo-modal-section-label" style={{ marginTop: 20 }}>Tableros</div>
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
