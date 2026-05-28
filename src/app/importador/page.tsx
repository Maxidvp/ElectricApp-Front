'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useProyectos } from '@/context/ProyectosContext'
import * as api from '@/services/ruteo'

// ── Helpers ─────────────────────────────────────────────

function mToCm(s: string): number {
  return Math.round(parseFloat(s.trim().replace(',', '.')) * 100)
}

function fmtM(cm: number): string {
  return (cm / 100).toFixed(2) + 'm'
}

type SegData = {
  x1: number; y1: number; z1: number
  x2: number; y2: number; z2: number
  tipo: 'canio' | 'bandeja' | 'pared'
  canio_id: number | null
  bandeja_id: number | null
  label: string
  matched: boolean
}

function parseSegments(
  text: string,
  tipo: 'canio' | 'bandeja' | 'pared',
  catalog: { id: number; nombre: string | null }[]
): SegData[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !isNaN(parseFloat(l.split(';')[0].replace(',', '.'))))
    .map(line => {
      const p = line.split(';').map(s => s.trim())
      const x1 = mToCm(p[0] ?? '0'); const y1 = mToCm(p[1] ?? '0'); const z1 = mToCm(p[2] ?? '0')
      const x2 = mToCm(p[3] ?? '0'); const y2 = mToCm(p[4] ?? '0'); const z2 = mToCm(p[5] ?? '0')
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

// ── Destination selector ──────────────────────────────────

const fieldStyle: React.CSSProperties = {
  padding: '5px 10px',
  background: 'var(--clr-surface-tonal-a10)',
  border: '1px solid var(--clr-surface-tonal-a20)',
  borderRadius: 6,
  color: 'var(--clr-font-a0)',
  fontSize: 13,
  outline: 'none',
}

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
  const placeholder = `Nombre de la ${word}…`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--clr-surface-tonal-a40)' }}>{label}</label>
      {all.length === 0 || creating ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            autoFocus={all.length === 0}
            style={{ ...fieldStyle, flex: 1 }}
            placeholder={placeholder}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  onCommit()
              if (e.key === 'Escape' && all.length > 0) setCreating(false)
            }}
          />
          <button
            onClick={onCommit}
            style={{ ...fieldStyle, cursor: 'pointer', background: 'var(--clr-primary-a0)', border: 'none' }}
          >
            Crear
          </button>
          {all.length > 0 && (
            <button onClick={() => setCreating(false)} style={{ ...fieldStyle, cursor: 'pointer' }}>✕</button>
          )}
        </div>
      ) : (
        <select
          style={fieldStyle}
          value={selectedId ?? ''}
          onChange={e => {
            if (e.target.value === '__new__') setCreating(true)
            else onSelect(Number(e.target.value))
          }}
        >
          {all.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          <option value="__new__">＋ Crear nuevo</option>
        </select>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────

export default function ImportadorPage() {
  const { canios, bandejas, conjuntos, tablaParedes, proyectoActivo, appendSegmentos, appendParedes } = useProyectos()

  const [textCanios,    setTextCanios]    = useState('')
  const [textBandejas,  setTextBandejas]  = useState('')
  const [textParedes,   setTextParedes]   = useState('')
  const [conjuntoId,    setConjuntoId]    = useState<number | null>(null)
  const [layoutId,      setLayoutId]      = useState<number | null>(null)
  const [localConjs,    setLocalConjs]    = useState<NamedItem[]>([])
  const [localLayouts,  setLocalLayouts]  = useState<NamedItem[]>([])
  const [creandoConj,   setCreandoConj]   = useState(false)
  const [nuevoConj,     setNuevoConj]     = useState('')
  const [creandoLayout, setCreandoLayout] = useState(false)
  const [nuevoLayout,   setNuevoLayout]   = useState('')
  const [status,        setStatus]        = useState<'idle' | 'importing' | 'done'>('idle')
  const [imported,      setImported]      = useState(0)

  const allConjs = useMemo(() => [
    ...conjuntos,
    ...localConjs.filter(lc => !conjuntos.some(c => c.id === lc.id)),
  ], [conjuntos, localConjs])

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

  const parsedCanios   = useMemo(() => parseSegments(textCanios,   'canio',   canios),   [textCanios,   canios])
  const parsedBandejas = useMemo(() => parseSegments(textBandejas, 'bandeja', bandejas), [textBandejas, bandejas])
  const parsedParedes  = useMemo(() => parseSegments(textParedes,  'pared',   []),        [textParedes])

  const totalSegs  = parsedCanios.length + parsedBandejas.length
  const totalPared = parsedParedes.length
  const total      = totalSegs + totalPared

  const canImport = total > 0 &&
    (totalSegs  === 0 || conjuntoId !== null) &&
    (totalPared === 0 || layoutId   !== null)

  const crearConjunto = async () => {
    const nombre = nuevoConj.trim(); if (!nombre) return
    try {
      const c = await api.createConjunto(nombre, proyectoActivo?.id)
      setLocalConjs(prev => [...prev, { id: c.id, nombre: c.nombre }])
      setConjuntoId(c.id)
      setCreandoConj(false)
      setNuevoConj('')
    } catch (e) { console.error(e) }
  }

  const crearLayout = async () => {
    if (!proyectoActivo) return
    const nombre = nuevoLayout.trim(); if (!nombre) return
    try {
      const tp = await api.createArquitectura(nombre, proyectoActivo.id)
      setLocalLayouts(prev => [...prev, { id: tp.id, nombre: tp.nombre }])
      setLayoutId(tp.id)
      setCreandoLayout(false)
      setNuevoLayout('')
    } catch (e) { console.error(e) }
  }

  const handleImportar = async () => {
    if (!canImport || status === 'importing') return
    setStatus('importing')
    let count = 0
    try {
      const segs = [...parsedCanios, ...parsedBandejas]
      if (segs.length > 0) {
        const created = await api.createSegmentosBulk(
          segs.map(s => ({
            tipo: s.tipo,
            x1: s.x1, y1: s.y1, z1: s.z1,
            x2: s.x2, y2: s.y2, z2: s.z2,
            canio_id: s.canio_id,
            bandeja_id: s.bandeja_id,
          })),
          conjuntoId !== null ? [conjuntoId] : []
        )
        appendSegmentos(created)
        count += created.length
      }
      if (parsedParedes.length > 0) {
        const created = await api.createParedesBulk(
          parsedParedes.map(s => ({
            x1: s.x1, y1: s.y1, z1: s.z1,
            x2: s.x2, y2: s.y2, z2: s.z2,
            nombre: null, color: null,
            tabla_pared_id: layoutId,
          }))
        )
        appendParedes(created)
        count += created.length
      }
    } catch (e) { console.error('Error al importar', e) }
    setImported(count)
    setStatus('done')
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 960, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--clr-font-a0)', margin: 0 }}>
          Importador de segmentos
        </h1>
        <p style={{ fontSize: 13, color: 'var(--clr-surface-tonal-a40)', marginTop: 6 }}>
          Pegá filas exportadas desde otro programa. Las coordenadas se interpretan en metros y se almacenan en centímetros.
          La primera fila de encabezado se ignora automáticamente.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        <ImportSection
          title="Caños"
          color="#E87C3A"
          hint="Start X;Start Y;Start Z;End X;End Y;End Z;Sección"
          placeholder="0.2282;15.0141;0.0000;1.0941;15.0141;0.0000;EMT 3/4"
          value={textCanios}
          onChange={setTextCanios}
          segments={parsedCanios}
          catalogLabel="Sección"
        />
        <ImportSection
          title="Bandejas"
          color="#378ADD"
          hint="Start X;Start Y;Start Z;End X;End Y;End Z;Dimensión"
          placeholder="0.2282;15.0141;0.0000;1.0941;15.0141;0.0000;BPC 150x50"
          value={textBandejas}
          onChange={setTextBandejas}
          segments={parsedBandejas}
          catalogLabel="Dimensión"
        />

        {/* ── Destinos canalizaciones──────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 24, flexWrap: 'wrap',
          padding: '16px 20px',
          background: 'var(--clr-surface-tonal-a10)',
          border: '1px solid var(--clr-surface-tonal-a20)',
          borderRadius: 8,
        }}>
          <DestSelector
            label="Canalización destino"
            all={allConjs} selectedId={conjuntoId} onSelect={setConjuntoId}
            creating={creandoConj} setCreating={setCreandoConj}
            newName={nuevoConj} setNewName={setNuevoConj} onCommit={crearConjunto}
          />
        </div>

        <ImportSection
          title="Paredes"
          color="#888780"
          hint="Start X;Start Y;Start Z;End X;End Y;End Z"
          placeholder="0.2282;15.0141;0.0000;1.0941;15.0141;0.0000"
          value={textParedes}
          onChange={setTextParedes}
          segments={parsedParedes}
          catalogLabel={null}
        />

        {/* ── Destinos layout──────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 24, flexWrap: 'wrap',
          padding: '16px 20px',
          background: 'var(--clr-surface-tonal-a10)',
          border: '1px solid var(--clr-surface-tonal-a20)',
          borderRadius: 8,
        }}>
          <DestSelector
            label="Layout destino"
            all={allLayouts} selectedId={layoutId} onSelect={setLayoutId}
            creating={creandoLayout} setCreating={setCreandoLayout}
            newName={nuevoLayout} setNewName={setNuevoLayout} onCommit={crearLayout}
          />
        </div>


      </div>

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
              padding: '9px 24px',
              borderRadius: 7,
              border: '1px solid var(--clr-primary-a0)',
              background: status === 'importing' ? 'transparent' : 'var(--clr-primary-a0)',
              color: 'var(--clr-font-a0)',
              fontSize: 14,
              fontWeight: 500,
              cursor: !canImport || status === 'importing' ? 'default' : 'pointer',
              opacity: !canImport ? 0.4 : 1,
              transition: 'background 0.12s',
            }}
          >
            {status === 'importing'
              ? 'Importando…'
              : total === 0
              ? 'Nada que importar'
              : `Importar ${total} segmento${total !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Import section ────────────────────────────────────────

type SectionProps = {
  title: string
  color: string
  hint: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  segments: SegData[]
  catalogLabel: string | null
}

function ImportSection({ title, color, hint, placeholder, value, onChange, segments, catalogLabel }: SectionProps) {
  const unmatched = catalogLabel ? segments.filter(s => s.label && !s.matched).length : 0
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--clr-font-a0)' }}>{title}</span>
        {segments.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--clr-surface-tonal-a40)' }}>
            {segments.length} fila{segments.length !== 1 ? 's' : ''}
          </span>
        )}
        {unmatched > 0 && (
          <span style={{ fontSize: 12, color: 'var(--clr-warning-a10)' }}>
            · {unmatched} sin coincidir en catálogo
          </span>
        )}
      </div>

      <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--clr-surface-tonal-a40)', marginBottom: 6 }}>
        {hint}
      </div>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
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

      {segments.length > 0 && (
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          <table className="datatable" style={{ fontSize: 12, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>X1</th><th>Y1</th><th>Z1</th>
                <th>X2</th><th>Y2</th><th>Z2</th>
                {catalogLabel && <th>{catalogLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {segments.map((seg, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--clr-surface-tonal-a40)', textAlign: 'center' }}>{i + 1}</td>
                  <td>{fmtM(seg.x1)}</td>
                  <td>{fmtM(seg.y1)}</td>
                  <td>{fmtM(seg.z1)}</td>
                  <td>{fmtM(seg.x2)}</td>
                  <td>{fmtM(seg.y2)}</td>
                  <td>{fmtM(seg.z2)}</td>
                  {catalogLabel && (
                    <td>
                      {!seg.label
                        ? <span style={{ color: 'var(--clr-surface-tonal-a40)' }}>—</span>
                        : seg.matched
                        ? <span style={{ color: 'var(--clr-success-a20)' }}>✓ {seg.label}</span>
                        : <span style={{ color: 'var(--clr-warning-a10)' }} title="No encontrado en catálogo">⚠ {seg.label}</span>
                      }
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
