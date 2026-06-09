'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useProyectos } from '@/context/ProyectosContext'
import * as api from '@/services/ruteo'

// ── Types ─────────────────────────────────────────────────

type Unit = 'mm' | 'cm' | 'm'
type Tipo = 'canio' | 'bandeja' | 'pared'

type SegData = {
  x1: number; y1: number; z1: number
  x2: number; y2: number; z2: number
  tipo: Tipo
  canio_id: number | null
  bandeja_id: number | null
  label: string
  matched: boolean
}

// ── Conversión y formato ──────────────────────────────────

function toCm(val: number, unit: Unit): number {
  if (unit === 'm')  return Math.round(val * 100)
  if (unit === 'mm') return Math.round(val / 10)
  return Math.round(val)
}

function parseFlt(s: string): number {
  return parseFloat(s.trim().replace(',', '.'))
}

function fmtM(cm: number): string {
  return (cm / 100).toFixed(2) + 'm'
}

// ── Parser de texto (filas separadas por punto y coma) ────

function parseSegments(
  text: string,
  tipo: Tipo,
  catalog: { id: number; nombre: string | null }[],
  unit: Unit,
): SegData[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !isNaN(parseFlt(l.split(';')[0])))
    .map(line => {
      const p = line.split(';').map(s => s.trim())
      const x1 = toCm(parseFlt(p[0] ?? '0'), unit); const y1 = toCm(parseFlt(p[1] ?? '0'), unit); const z1 = toCm(parseFlt(p[2] ?? '0'), unit)
      const x2 = toCm(parseFlt(p[3] ?? '0'), unit); const y2 = toCm(parseFlt(p[4] ?? '0'), unit); const z2 = toCm(parseFlt(p[5] ?? '0'), unit)
      const label = p[6] ?? ''
      const match = label ? catalog.find(c => c.nombre?.toLowerCase() === label.toLowerCase()) : null
      return {
        x1, y1, z1, x2, y2, z2, tipo, label,
        canio_id:   tipo === 'canio'   ? (match?.id ?? null) : null,
        bandeja_id: tipo === 'bandeja' ? (match?.id ?? null) : null,
        matched:    tipo === 'pared' || !!match,
      }
    })
    .filter(s => [s.x1, s.y1, s.x2, s.y2].every(n => !isNaN(n)))
}

// ── Parser CSV (columnas detectadas desde el encabezado) ──

const COL_MAP: Record<string, string> = {
  'start x': 'x1', 'inicio x': 'x1', 'x1': 'x1',
  'start y': 'y1', 'inicio y': 'y1', 'y1': 'y1',
  'start z': 'z1', 'inicio z': 'z1', 'z1': 'z1',
  'end x':   'x2', 'fin x':   'x2', 'x2': 'x2',
  'end y':   'y2', 'fin y':   'y2', 'y2': 'y2',
  'end z':   'z2', 'fin z':   'z2', 'z2': 'z2',
  'section': 'label', 'sección': 'label', 'seccion': 'label',
  'dimension': 'label', 'dimensión': 'label', 'tipo': 'label',
}

function parseCsvSegments(
  csvText: string,
  tipo: Tipo,
  catalog: { id: number; nombre: string | null }[],
  unit: Unit,
): SegData[] {
  const text = csvText.replace(/^﻿/, '')
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, ' '))

  const idx: Record<string, number> = {}
  headers.forEach((h, i) => {
    const field = COL_MAP[h]
    if (field && idx[field] === undefined) idx[field] = i
  })

  if (idx.x1 === undefined || idx.y1 === undefined || idx.x2 === undefined || idx.y2 === undefined) return []

  const get = (parts: string[], field: string): number =>
    idx[field] !== undefined ? toCm(parseFlt(parts[idx[field]] ?? '0'), unit) : 0

  return lines.slice(1)
    .map(line => {
      const parts = line.split(sep).map(s => s.trim().replace(/^["']|["']$/g, ''))
      const x1 = get(parts, 'x1'); const y1 = get(parts, 'y1'); const z1 = get(parts, 'z1')
      const x2 = get(parts, 'x2'); const y2 = get(parts, 'y2'); const z2 = get(parts, 'z2')
      const label = idx.label !== undefined ? (parts[idx.label] ?? '') : ''
      const match = label ? catalog.find(c => c.nombre?.toLowerCase() === label.toLowerCase()) : null
      return {
        x1, y1, z1, x2, y2, z2, tipo, label,
        canio_id:   tipo === 'canio'   ? (match?.id ?? null) : null,
        bandeja_id: tipo === 'bandeja' ? (match?.id ?? null) : null,
        matched:    tipo === 'pared' || !!match,
      }
    })
    .filter(s => [s.x1, s.y1, s.x2, s.y2].every(n => !isNaN(n)))
}

// ── Previsualización SVG ──────────────────────────────────

function SegPreview({ segments, color }: { segments: SegData[], color: string }) {
  if (segments.length === 0) return null
  const xs   = segments.flatMap(s => [s.x1, s.x2])
  const ys   = segments.flatMap(s => [s.y1, s.y2])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const pad  = span * 0.04 + 1
  const sw   = span * 0.004 + 0.5
  return (
    <div style={{
      marginTop: 10,
      background: 'var(--clr-surface-tonal-a0)',
      border: '1px solid var(--clr-surface-tonal-a20)',
      borderRadius: 7,
      overflow: 'hidden',
    }}>
      <svg
        viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
        style={{ width: '100%', maxHeight: 280, display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {segments.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke={color}
            strokeOpacity={s.matched || s.tipo === 'pared' ? 0.85 : 0.25}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  )
}

// ── Config por tipo ───────────────────────────────────────

const TIPO_INFO = {
  canio:   { label: 'Caño',    color: '#E87C3A', catalogLabel: 'Sección'   as string | null, hint: 'Start X;Start Y;Start Z;End X;End Y;End Z;Sección',    placeholder: '0.2282;15.0141;0.0000;1.0941;15.0141;0.0000'   },
  bandeja: { label: 'Bandeja', color: '#378ADD', catalogLabel: 'Dimensión' as string | null, hint: 'Start X;Start Y;Start Z;End X;End Y;End Z;Dimensión',  placeholder: '0.2282;15.0141;0.0000;1.0941;15.0141;0.0000' },
  pared:   { label: 'Pared',   color: '#888780', catalogLabel: null,                         hint: 'Start X;Start Y;Start Z;End X;End Y;End Z',             placeholder: '0.2282;15.0141;0.0000;1.0941;15.0141;0.0000'           },
} as const

// ── Estilos compartidos ───────────────────────────────────

const fieldStyle: React.CSSProperties = {
  padding: '5px 10px',
  background: 'var(--clr-surface-tonal-a10)',
  border: '1px solid var(--clr-surface-tonal-a20)',
  borderRadius: 6,
  color: 'var(--clr-font-a0)',
  fontSize: 13,
  outline: 'none',
}

// ── Selector de destino ───────────────────────────────────

type NamedItem = { id: number; nombre: string }

function DestSelector({
  label, all, selectedId, onSelect,
  creating, setCreating, newName, setNewName, onCommit,
}: {
  label: string
  all: NamedItem[]
  selectedId: number | null
  onSelect: (id: number) => void
  creating: boolean
  setCreating: (v: boolean) => void
  newName: string
  setNewName: (v: string) => void
  onCommit: () => void
}) {
  const word = label.split(' ')[0].toLowerCase()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--clr-surface-tonal-a40)' }}>{label}</label>
      {all.length === 0 || creating ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            autoFocus={all.length === 0}
            style={{ ...fieldStyle, flex: 1 }}
            placeholder={`Nombre de la ${word}…`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  onCommit()
              if (e.key === 'Escape' && all.length > 0) setCreating(false)
            }}
          />
          <button onClick={onCommit} style={{ ...fieldStyle, cursor: 'pointer', background: 'var(--clr-primary-a0)', border: 'none' }}>Crear</button>
          {all.length > 0 && <button onClick={() => setCreating(false)} style={{ ...fieldStyle, cursor: 'pointer' }}>✕</button>}
        </div>
      ) : (
        <select style={fieldStyle} value={selectedId ?? ''} onChange={e => {
          if (e.target.value === '__new__') setCreating(true)
          else onSelect(Number(e.target.value))
        }}>
          {all.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          <option value="__new__">＋ Crear nuevo</option>
        </select>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────

export default function ImportadorPage() {
  const { canios, bandejas, conjuntos, tablaParedes, proyectoActivo, appendSegmentos, appendParedes, addArquitectura, addConjunto } = useProyectos()

  const [unit,         setUnit]         = useState<Unit>('m')
  const [tipo,         setTipo]         = useState<Tipo>('canio')
  const [textInput,    setTextInput]    = useState('')
  const [csvText,      setCsvText]      = useState<string | null>(null)
  const [csvFilename,  setCsvFilename]  = useState<string | null>(null)

  const [conjuntoId,    setConjuntoId]    = useState<number | null>(null)
  const [layoutId,      setLayoutId]      = useState<number | null>(null)
  const [localLayouts,  setLocalLayouts]  = useState<NamedItem[]>([])
  const [creandoConj,   setCreandoConj]   = useState(false)
  const [nuevoConj,     setNuevoConj]     = useState('')
  const [creandoLayout, setCreandoLayout] = useState(false)
  const [nuevoLayout,   setNuevoLayout]   = useState('')
  const [status,        setStatus]        = useState<'idle' | 'importing' | 'done'>('idle')
  const [imported,      setImported]      = useState(0)

  const fileRef = useRef<HTMLInputElement>(null)

  const allConjs = useMemo(() => conjuntos, [conjuntos])

  const allLayouts = useMemo(() => [
    ...tablaParedes,
    ...localLayouts.filter(ll => !tablaParedes.some(tp => tp.id === ll.id)),
  ], [tablaParedes, localLayouts])

  useEffect(() => {
    if (conjuntoId === null && allConjs.length > 0) setConjuntoId(allConjs[0].id)
  }, [allConjs, conjuntoId])

  useEffect(() => {
    if (layoutId === null && allLayouts.length > 0) setLayoutId(allLayouts[0].id)
  }, [allLayouts, layoutId])

  const catalog = useMemo(() =>
    tipo === 'canio' ? canios : tipo === 'bandeja' ? bandejas : [],
    [tipo, canios, bandejas]
  )

  const parsedFromText = useMemo(() =>
    parseSegments(textInput, tipo, catalog, unit),
    [textInput, tipo, catalog, unit]
  )
  const parsedFromCsv = useMemo(() =>
    csvText ? parseCsvSegments(csvText, tipo, catalog, unit) : null,
    [csvText, tipo, catalog, unit]
  )
  const segments = parsedFromCsv ?? parsedFromText

  const handleSetTipo = (t: Tipo) => {
    setTipo(t)
  }

  const handleCsvSelect = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => setCsvText((e.target?.result as string) ?? null)
    reader.readAsText(file, 'utf-8')
    setCsvFilename(file.name)
  }

  const canImport = segments.length > 0 &&
    (tipo === 'pared' ? layoutId !== null : conjuntoId !== null)

  const crearConjunto = async () => {
    const nombre = nuevoConj.trim(); if (!nombre) return
    try {
      const c = await addConjunto(nombre)
      setConjuntoId(c.id); setCreandoConj(false); setNuevoConj('')
    } catch (e) { console.error(e) }
  }

  const crearLayout = async () => {
    if (!proyectoActivo) return
    const nombre = nuevoLayout.trim(); if (!nombre) return
    try {
      const tp = await addArquitectura(nombre)
      if (!tp) return
      setLocalLayouts(prev => [...prev, { id: tp.id, nombre: tp.nombre }])
      setLayoutId(tp.id); setCreandoLayout(false); setNuevoLayout('')
    } catch (e) { console.error(e) }
  }

  const handleImportar = async () => {
    if (!canImport || status === 'importing') return
    setStatus('importing')
    let count = 0
    try {
      if (tipo === 'pared') {
        const created = await api.createParedesBulk(
          segments.map(s => ({
            x1: s.x1, y1: s.y1, z1: s.z1,
            x2: s.x2, y2: s.y2, z2: s.z2,
            nombre: null, color: null,
            tabla_pared_id: layoutId,
          }))
        )
        appendParedes(created)
        count = created.length
      } else {
        const created = await api.createSegmentosBulk(
          segments.map(s => ({
            tipo: s.tipo,
            x1: s.x1, y1: s.y1, z1: s.z1,
            x2: s.x2, y2: s.y2, z2: s.z2,
            canio_id: s.canio_id,
            bandeja_id: s.bandeja_id,
          })),
          conjuntoId !== null ? [conjuntoId] : []
        )
        appendSegmentos(created)
        count = created.length
      }
    } catch (e) { console.error('Error al importar', e) }
    setImported(count)
    setStatus('done')
  }

  const tipoInfo = TIPO_INFO[tipo]
  const unmatched = tipoInfo.catalogLabel ? segments.filter(s => s.label && !s.matched).length : 0

  const tipoBtn = (active: boolean, color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
    border: active ? `1px solid ${color}` : '1px solid var(--clr-surface-tonal-a20)',
    background: active ? `${color}22` : 'var(--clr-surface-tonal-a10)',
    color: active ? 'var(--clr-font-a0)' : 'var(--clr-surface-tonal-a40)',
    transition: 'all 0.1s',
  })

  return (
    <div style={{ padding: '28px 36px', maxWidth: 960, margin: '0 auto' }}>

      {/* Encabezado */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--clr-font-a0)', margin: 0 }}>
          Importador de segmentos
        </h1>
        <p style={{ fontSize: 13, color: 'var(--clr-surface-tonal-a40)', marginTop: 6, marginBottom: 12 }}>
          Pegá filas en formato separado por punto y coma, o cargá un archivo CSV con encabezado.
          Las columnas se detectan automáticamente desde la primera fila del CSV.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--clr-surface-tonal-a40)' }}>Unidades del archivo:</span>
          {(['m', 'cm', 'mm'] as Unit[]).map(u => (
            <label key={u} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, color: unit === u ? 'var(--clr-font-a0)' : 'var(--clr-surface-tonal-a40)' }}>
              <input type="radio" name="unit" value={u} checked={unit === u} onChange={() => setUnit(u)} style={{ cursor: 'pointer', accentColor: 'var(--clr-primary-a0)' }} />
              {u}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Sección de importación unificada */}
        <div>
          {/* Fila: selector de tipo + CSV */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(Object.entries(TIPO_INFO) as [Tipo, typeof TIPO_INFO[Tipo]][]).map(([t, info]) => (
                <button key={t} onClick={() => handleSetTipo(t)} style={tipoBtn(tipo === t, info.color)}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: info.color, flexShrink: 0, display: 'inline-block' }} />
                  {info.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {segments.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--clr-surface-tonal-a40)' }}>
                  {segments.length} fila{segments.length !== 1 ? 's' : ''}
                </span>
              )}
              {unmatched > 0 && (
                <span style={{ fontSize: 12, color: 'var(--clr-warning-a10)' }}>
                  · {unmatched} sin coincidir
                </span>
              )}
              {csvFilename ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--clr-surface-tonal-a10)', border: '1px solid var(--clr-surface-tonal-a20)', borderRadius: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--clr-success-a20)' }}>✓</span>
                  <span style={{ fontSize: 11, color: 'var(--clr-font-a20)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{csvFilename}</span>
                  <button onClick={() => { setCsvText(null); setCsvFilename(null); setStatus('idle'); setImported(0) }} title="Quitar CSV"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--clr-surface-tonal-a40)', fontSize: 13, lineHeight: 1 }}>×</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} style={{ ...fieldStyle, cursor: 'pointer', fontSize: 11, padding: '3px 10px' }}>
                  Cargar CSV
                </button>
              )}
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvSelect(f); e.target.value = '' }} />
            </div>
          </div>

          {/* Hint */}
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--clr-surface-tonal-a40)', marginBottom: 6 }}>
            {csvFilename ? 'CSV — columnas detectadas desde la primera fila del archivo' : tipoInfo.hint}
          </div>

          {/* Textarea */}
          {!csvFilename && (
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={tipoInfo.placeholder}
              spellCheck={false}
              style={{
                width: '100%', height: 110, boxSizing: 'border-box',
                padding: '8px 10px',
                background: 'var(--clr-surface-tonal-a10)',
                border: '1px solid var(--clr-surface-tonal-a20)',
                borderRadius: 7,
                color: 'var(--clr-font-a0)',
                fontSize: 12, fontFamily: 'monospace',
                resize: 'vertical', outline: 'none',
              }}
            />
          )}

          {/* Previsualización SVG */}
          <SegPreview segments={segments} color={tipoInfo.color} />

          {/* Tabla de preview */}
          {segments.length > 0 && (
            <div style={{ marginTop: 10, overflowX: 'auto' }}>
              <table className="datatable" style={{ fontSize: 12, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 32, textAlign: 'left' }}>#</th>
                    <th style={{ textAlign: 'left' }}>X1</th><th style={{ textAlign: 'left' }}>Y1</th><th style={{ textAlign: 'left' }}>Z1</th>
                    <th style={{ textAlign: 'left' }}>X2</th><th style={{ textAlign: 'left' }}>Y2</th><th style={{ textAlign: 'left' }}>Z2</th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map((seg, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--clr-surface-tonal-a40)', textAlign: 'left' }}>{i + 1}</td>
                      <td>{fmtM(seg.x1)}</td><td>{fmtM(seg.y1)}</td><td>{fmtM(seg.z1)}</td>
                      <td>{fmtM(seg.x2)}</td><td>{fmtM(seg.y2)}</td><td>{fmtM(seg.z2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Destino según tipo */}
        <div style={{
          display: 'flex', gap: 24, flexWrap: 'wrap',
          padding: '16px 20px',
          background: 'var(--clr-surface-tonal-a10)',
          border: '1px solid var(--clr-surface-tonal-a20)',
          borderRadius: 8,
        }}>
          {tipo !== 'pared' ? (
            <DestSelector
              label="Canalización destino"
              all={allConjs} selectedId={conjuntoId} onSelect={setConjuntoId}
              creating={creandoConj} setCreating={setCreandoConj}
              newName={nuevoConj} setNewName={setNuevoConj} onCommit={crearConjunto}
            />
          ) : (
            <DestSelector
              label="Layout destino"
              all={allLayouts} selectedId={layoutId} onSelect={setLayoutId}
              creating={creandoLayout} setCreating={setCreandoLayout}
              newName={nuevoLayout} setNewName={setNuevoLayout} onCommit={crearLayout}
            />
          )}
        </div>

      </div>

      {/* Botón de importar */}
      <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 16 }}>
        {status === 'done' ? (
          <>
            <span style={{ fontSize: 14, color: 'var(--clr-success-a20)' }}>
              ✓ {imported} segmento{imported !== 1 ? 's' : ''} importado{imported !== 1 ? 's' : ''} correctamente
            </span>
            <Link href="/ruteo" style={{ fontSize: 13, color: 'var(--clr-info-a10)', textDecoration: 'underline' }}>
              Ir a Ruteo →
            </Link>
          </>
        ) : (
          <button
            onClick={handleImportar}
            disabled={!canImport || status === 'importing'}
            style={{
              padding: '9px 24px', borderRadius: 7,
              border: '1px solid var(--clr-primary-a0)',
              background: status === 'importing' ? 'transparent' : 'var(--clr-primary-a0)',
              color: 'var(--clr-font-a0)', fontSize: 14, fontWeight: 500,
              cursor: !canImport || status === 'importing' ? 'default' : 'pointer',
              opacity: !canImport ? 0.4 : 1,
              transition: 'background 0.12s',
            }}
          >
            {status === 'importing'
              ? 'Importando…'
              : segments.length === 0
              ? 'Nada que importar'
              : `Importar ${segments.length} segmento${segments.length !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  )
}
