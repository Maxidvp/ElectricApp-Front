'use client'
import { useState, useEffect, useMemo } from 'react'
import { useToast } from '@/context/ToastContext'
import { getFamiliasCables, createFamiliaCable, updateFamiliaCable, type FamiliaCablePatch } from '@/services/familiasCables'
import { getCablesPorFamilia, createCable, createCablesBulk, updateCable, deleteCable, type CablePatch } from '@/services/cables'
import { invalidarCacheCables } from '@/context/CablesContext'
import CeldaEditable from '@/components/CeldaEditable'

// ── Tipos ─────────────────────────────────────────────────────────

type Familia = FamiliaCablePatch & { id: number }
type Cable = CablePatch & { id: number }

// ── Estilos compartidos (mismo patrón que tableros/page.tsx) ──────

// Mismo tinte de celda editable que usan las tablas de cargas/cortocircuitos
const EDITABLE_BG = 'color-mix(in srgb, #4A8FD4 4%, transparent)'

// Los <table className="datatable"> de esta página no están dentro de un
// .datatable-container, así que el padding de cabecera del CSS global no aplica —
// se define acá mismo para que el texto de los <th> no quede pegado al borde.
const thStyle: React.CSSProperties = { textAlign: 'center', padding: '6px 8px' }

const cx = {
  input: 'h-[34px] border border-surface-tonal-a30 rounded-[7px] px-[10px] text-[13px] bg-surface-a10 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10 focus:shadow-[0_0_0_3px_rgba(64,119,209,0.2)]',
  label: 'text-xs text-font-a20',
  field: 'flex flex-col gap-[5px]',
  section: 'border border-surface-tonal-a20 rounded-[10px] overflow-hidden',
  hdr: 'flex items-center gap-2 px-[14px] py-2 bg-surface-tonal-a0 border-b border-surface-tonal-a20 text-xs font-medium text-font-a20',
  grid: 'p-3 grid gap-[10px] bg-surface-a10',
  btn: 'h-[34px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 transition-colors hover:bg-surface-tonal-a10 hover:text-font-a0',
  btnPrimary: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 transition-colors hover:bg-info-a10 hover:border-info-a10 disabled:opacity-50 disabled:cursor-not-allowed',
}

function Campo({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <div className={cx.field}>
      <label className={cx.label}>{label}{required && <span className="text-danger-a10 ml-0.5">*</span>}</label>
      <input className={cx.input} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function Select({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean
}) {
  return (
    <div className={cx.field}>
      <label className={cx.label}>{label}{required && <span className="text-danger-a10 ml-0.5">*</span>}</label>
      <select className={cx.input} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── Familia: crear nueva ───────────────────────────────────────────

const TIPOS_FAMILIA = ['Unipolar', 'Multipolar', 'Apantallado']
const MATERIALES = ['Cobre', 'Aluminio']
const AISLAMIENTOS = ['PVC', 'XLPE', 'EPR', 'LSZH']

type FamiliaForm = {
  nombre: string; norma: string; tipo: string; material: string; aislamiento: string
  modelo: string; catalogo: string; tension_nom: string; tension_aisl: string; temperatura: string
}
const EMPTY_FAMILIA: FamiliaForm = {
  nombre: '', norma: '', tipo: '', material: '', aislamiento: '',
  modelo: '', catalogo: '', tension_nom: '', tension_aisl: '', temperatura: '',
}

function familiaToForm(f: Familia): FamiliaForm {
  const s = (v: number | null) => v != null ? String(v) : ''
  return {
    nombre: f.nombre, norma: f.norma, tipo: f.tipo, material: f.material, aislamiento: f.aislamiento,
    modelo: f.modelo ?? '', catalogo: f.catalogo ?? '', tension_nom: f.tension_nom ?? '',
    tension_aisl: s(f.tension_aisl), temperatura: s(f.temperatura),
  }
}

// Sirve para crear o editar: si viene `familiaEditar` edita esa familia (PUT),
// si no crea una nueva (POST). Los campos que no se exponen acá (proteccion,
// pantalla, blindaje, temperatura_imp) se preservan tal cual al editar, en vez
// de pisarlos con null, para no perder datos cargados por otra vía.
function FamiliaCableForm({ familiaEditar, onGuardada, onCancelar }: {
  familiaEditar?: Familia; onGuardada: (f: Familia) => void; onCancelar: () => void
}) {
  const [form, setForm] = useState<FamiliaForm>(() => familiaEditar ? familiaToForm(familiaEditar) : EMPTY_FAMILIA)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof FamiliaForm, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const puedeGuardar = form.nombre.trim() && form.norma.trim() && form.tipo && form.material && form.aislamiento

  const guardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true); setError(null)
    try {
      const num = (v: string) => v.trim() ? Number(v) : null
      const datos: FamiliaCablePatch = {
        nombre: form.nombre.trim(), norma: form.norma.trim(), tipo: form.tipo,
        material: form.material, aislamiento: form.aislamiento,
        modelo: form.modelo.trim() || null, catalogo: form.catalogo.trim() || null,
        tension_nom: form.tension_nom.trim() || null, tension_aisl: num(form.tension_aisl),
        proteccion: familiaEditar?.proteccion ?? null, pantalla: familiaEditar?.pantalla ?? null, blindaje: familiaEditar?.blindaje ?? null,
        temperatura: num(form.temperatura), temperatura_imp: familiaEditar?.temperatura_imp ?? null,
      }
      const guardada = familiaEditar
        ? await updateFamiliaCable(familiaEditar.id, datos)
        : await createFamiliaCable(datos)
      onGuardada(guardada)
    } catch (e) {
      setError(e instanceof Error ? e.message : `Error al ${familiaEditar ? 'editar' : 'crear'} la familia`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={cx.section}>
      <div className={cx.hdr}><span>{familiaEditar ? `Editar familia — ${familiaEditar.nombre}` : 'Nueva familia de cable'}</span></div>
      <div className={`${cx.grid} grid-cols-3`}>
        <Campo label="Nombre" value={form.nombre} onChange={v => set('nombre', v)} placeholder="ej. Serie NF" required />
        <Campo label="Norma" value={form.norma} onChange={v => set('norma', v)} placeholder="ej. IRAM 2178-1" required />
        <Select label="Tipo" value={form.tipo} onChange={v => set('tipo', v)} options={TIPOS_FAMILIA} required />
        <Select label="Material" value={form.material} onChange={v => set('material', v)} options={MATERIALES} required />
        <Select label="Aislamiento" value={form.aislamiento} onChange={v => set('aislamiento', v)} options={AISLAMIENTOS} required />
        <Campo label="Máxima temperatura de servicio (°C)" type="number" value={form.temperatura} onChange={v => set('temperatura', v)} placeholder="ej. 70" />
        <Campo label="Modelo" value={form.modelo} onChange={v => set('modelo', v)} placeholder="opcional" />
        <Campo label="Catálogo / fabricante" value={form.catalogo} onChange={v => set('catalogo', v)} placeholder="ej. Marlew" />
        <Campo label="Tensión nominal" value={form.tension_nom} onChange={v => set('tension_nom', v)} placeholder="ej. 0,6/1 kV CA - 1,5 kV CC" />
      </div>
      {error && (
        <p className="text-[13px] text-danger-a10 px-3.5 pb-3">{error}</p>
      )}
      <div className="flex gap-2 justify-end px-3.5 pb-3.5">
        <button className={cx.btn} onClick={onCancelar}>Cancelar</button>
        <button className={cx.btnPrimary} disabled={!puedeGuardar || guardando} onClick={guardar}>
          {guardando ? 'Guardando...' : familiaEditar ? 'Guardar cambios' : 'Crear familia'}
        </button>
      </div>
    </div>
  )
}

// ── Cable: agregar uno solo ─────────────────────────────────────────

const CALIBRES = ['mm²', 'AWG', 'kcmil']

type CableForm = {
  nombre: string; calibre_tipo: string
  seccion_f: string; seccion_n: string; seccion_t: string
  Nfases: string; Nneutro: string; Ntierra: string
  diametro: string; peso: string; Iadm: string
}
const EMPTY_CABLE: CableForm = {
  nombre: '', calibre_tipo: 'mm²',
  seccion_f: '', seccion_n: '', seccion_t: '',
  Nfases: '', Nneutro: '', Ntierra: '',
  diametro: '', peso: '', Iadm: '',
}

function cableFormToPatch(form: CableForm): CablePatch {
  const num = (v: string) => v.trim() ? Number(v) : null
  return {
    nombre: form.nombre.trim(), calibre_tipo: form.calibre_tipo,
    seccion_f: form.seccion_f.trim(), seccion_n: form.seccion_n.trim() || '0', seccion_t: form.seccion_t.trim() || '0',
    Nfases: Number(form.Nfases) || 0, Nneutro: Number(form.Nneutro) || 0, Ntierra: Number(form.Ntierra) || 0,
    diametro: num(form.diametro), peso: num(form.peso), Iadm: Number(form.Iadm) || 0,
  }
}

function NuevoCableForm({ familiaId, onCreado }: { familiaId: number; onCreado: (c: Cable) => void }) {
  const [form, setForm] = useState<CableForm>(EMPTY_CABLE)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof CableForm, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const puedeGuardar = form.nombre.trim() && form.seccion_f.trim() && form.Nfases.trim() && form.Iadm.trim()

  const guardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true); setError(null)
    try {
      const creado = await createCable(familiaId, cableFormToPatch(form))
      onCreado(creado)
      setForm(EMPTY_CABLE)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el cable')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={cx.section}>
      <div className={cx.hdr}><span>Agregar cable</span></div>
      <div className={`${cx.grid} grid-cols-4`}>
        <Campo label="Nombre / formación" value={form.nombre} onChange={v => set('nombre', v)} placeholder="ej. 3x25+PE6" required />
        <Select label="Calibre" value={form.calibre_tipo} onChange={v => set('calibre_tipo', v)} options={CALIBRES} required />
        <Campo label="Sección fase" value={form.seccion_f} onChange={v => set('seccion_f', v)} placeholder="ej. 25" required />
        <Campo label="N° fases" type="number" value={form.Nfases} onChange={v => set('Nfases', v)} placeholder="ej. 3" required />
        <Campo label="Sección neutro" value={form.seccion_n} onChange={v => set('seccion_n', v)} placeholder="0 si no tiene" />
        <Campo label="N° neutros" type="number" value={form.Nneutro} onChange={v => set('Nneutro', v)} placeholder="ej. 0 o 1" />
        <Campo label="Sección tierra" value={form.seccion_t} onChange={v => set('seccion_t', v)} placeholder="0 si no tiene" />
        <Campo label="N° tierras" type="number" value={form.Ntierra} onChange={v => set('Ntierra', v)} placeholder="ej. 0 o 1" />
        <Campo label="Diámetro ext. (mm)" type="number" value={form.diametro} onChange={v => set('diametro', v)} placeholder="opcional" />
        <Campo label="Peso (kg/km)" type="number" value={form.peso} onChange={v => set('peso', v)} placeholder="opcional" />
        <Campo label="Corriente admisible (A)" type="number" value={form.Iadm} onChange={v => set('Iadm', v)} placeholder="ej. 117" required />
      </div>
      {error && <p className="text-[13px] text-danger-a10 px-3.5 pb-3">{error}</p>}
      <div className="flex justify-end px-3.5 pb-3.5">
        <button className={cx.btnPrimary} disabled={!puedeGuardar || guardando} onClick={guardar}>
          {guardando ? 'Guardando...' : 'Agregar cable'}
        </button>
      </div>
    </div>
  )
}

// ── Cables: importar lista ──────────────────────────────────────────

// Alias de columnas (encabezado, minúsculas) → campo de CablePatch. Acepta
// exportaciones de planilla en español o los nombres de campo tal cual.
const COL_MAP: Record<string, keyof CablePatch> = {
  'nombre': 'nombre', 'formación': 'nombre', 'formacion': 'nombre', 'name': 'nombre',
  'calibre': 'calibre_tipo', 'calibre_tipo': 'calibre_tipo', 'unidad': 'calibre_tipo',
  'seccion_f': 'seccion_f', 'sección fase': 'seccion_f', 'seccion fase': 'seccion_f', 'sf': 'seccion_f',
  'seccion_n': 'seccion_n', 'sección neutro': 'seccion_n', 'seccion neutro': 'seccion_n', 'sn': 'seccion_n',
  'seccion_t': 'seccion_t', 'sección tierra': 'seccion_t', 'seccion tierra': 'seccion_t', 'st': 'seccion_t',
  'nfases': 'Nfases', 'n fases': 'Nfases', 'n° fases': 'Nfases',
  'nneutro': 'Nneutro', 'n neutro': 'Nneutro', 'n neutros': 'Nneutro', 'n° neutros': 'Nneutro',
  'ntierra': 'Ntierra', 'n tierra': 'Ntierra', 'n tierras': 'Ntierra', 'n° tierras': 'Ntierra',
  'diametro': 'diametro', 'diámetro': 'diametro', 'diametro (mm)': 'diametro', 'diámetro (mm)': 'diametro',
  'peso': 'peso', 'peso (kg/km)': 'peso',
  'iadm': 'Iadm', 'iadm (a)': 'Iadm', 'corriente admisible': 'Iadm', 'i adm': 'Iadm',
}

type FilaImport = CablePatch & { _fila: number; _valida: boolean; _errores: string[] }

function parseFlt(s: string): number {
  return parseFloat(s.trim().replace(',', '.'))
}

function parseCablesCsv(texto: string): FilaImport[] {
  const limpio = texto.replace(/^﻿/, '')
  const lineas = limpio.split('\n').map(l => l.trim()).filter(Boolean)
  if (lineas.length < 2) return []

  const sep = lineas[0].includes(';') ? ';' : ','
  const headers = lineas[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  const idx: Partial<Record<keyof CablePatch, number>> = {}
  headers.forEach((h, i) => {
    const campo = COL_MAP[h]
    if (campo && idx[campo] === undefined) idx[campo] = i
  })

  return lineas.slice(1).map((linea, i) => {
    const partes = linea.split(sep).map(s => s.trim().replace(/^["']|["']$/g, ''))
    const get = (campo: keyof CablePatch): string => idx[campo] !== undefined ? (partes[idx[campo]!] ?? '') : ''

    const nombre = get('nombre')
    const calibre_tipo = get('calibre_tipo') || 'mm²'
    const seccion_f = get('seccion_f')
    const seccion_n = get('seccion_n') || '0'
    const seccion_t = get('seccion_t') || '0'
    const Nfases = Math.round(parseFlt(get('Nfases') || '0')) || 0
    const Nneutro = Math.round(parseFlt(get('Nneutro') || '0')) || 0
    const Ntierra = Math.round(parseFlt(get('Ntierra') || '0')) || 0
    const diametroStr = get('diametro')
    const pesoStr = get('peso')
    const Iadm = parseFlt(get('Iadm') || '0') || 0

    const errores: string[] = []
    if (!nombre) errores.push('nombre')
    if (!seccion_f) errores.push('seccion_f')
    if (!Nfases) errores.push('Nfases')
    if (!Iadm) errores.push('Iadm')

    return {
      _fila: i + 2, _valida: errores.length === 0, _errores: errores,
      nombre, calibre_tipo, seccion_f, seccion_n, seccion_t, Nfases, Nneutro, Ntierra,
      diametro: diametroStr ? parseFlt(diametroStr) : null,
      peso: pesoStr ? parseFlt(pesoStr) : null,
      Iadm,
    }
  })
}

function ImportarCablesForm({ familiaId, onImportados }: { familiaId: number; onImportados: (cables: Cable[]) => void }) {
  const [texto, setTexto] = useState('')
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<number | null>(null)

  const filas = useMemo(() => parseCablesCsv(texto), [texto])
  const validas = filas.filter(f => f._valida)
  const invalidas = filas.filter(f => !f._valida)

  const importar = async () => {
    if (validas.length === 0 || importando) return
    setImportando(true); setError(null); setResultado(null)
    try {
      const items: CablePatch[] = validas.map(({ _fila, _valida, _errores, ...patch }) => patch)
      const creados = await createCablesBulk(familiaId, items)
      onImportados(creados)
      setResultado(creados.length)
      setTexto('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className={cx.section}>
      <div className={cx.hdr}>
        <span>Importar lista de cables</span>
        {filas.length > 0 && (
          <span className="ml-auto text-[11px] text-surface-tonal-a40">
            {validas.length} válida{validas.length !== 1 ? 's' : ''}
            {invalidas.length > 0 && <span className="text-danger-a10"> · {invalidas.length} con error</span>}
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 bg-surface-a10">
        <p className="text-[11px] font-mono text-surface-tonal-a40">
          nombre;calibre_tipo;seccion_f;seccion_n;seccion_t;Nfases;Nneutro;Ntierra;diametro;peso;Iadm
        </p>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={'nombre;calibre_tipo;seccion_f;seccion_n;seccion_t;Nfases;Nneutro;Ntierra;diametro;peso;Iadm\n3x25+PE6;mm²;25;0;6;3;0;1;29.7;1350;98'}
          spellCheck={false}
          className="w-full h-28 box-border px-2.5 py-2 bg-surface-tonal-a0 border border-surface-tonal-a20 rounded-[7px] text-font-a0 text-xs font-mono resize-y outline-none"
        />

        {filas.length > 0 && (
          <div className="overflow-x-auto max-h-64 overflow-y-auto border border-surface-tonal-a20 rounded-[7px]">
            <table className="datatable" style={{ fontSize: 12, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 32 }}>#</th>
                  <th style={thStyle}>Nombre</th><th style={thStyle}>Calibre</th>
                  <th style={thStyle}>Sf</th><th style={thStyle}>Sn</th><th style={thStyle}>St</th>
                  <th style={thStyle}>Nf</th><th style={thStyle}>Nn</th><th style={thStyle}>Nt</th>
                  <th style={thStyle}>Ø</th><th style={thStyle}>Peso</th><th style={thStyle}>Iadm</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f._fila} style={{ background: f._valida ? undefined : 'color-mix(in srgb, var(--clr-danger-a0) 10%, transparent)' }}>
                    <td style={{ color: 'var(--clr-surface-tonal-a40)', textAlign: 'center' }}>{f._fila}</td>
                    <td style={{ textAlign: 'center' }}>{f.nombre || '—'}</td><td style={{ textAlign: 'center' }}>{f.calibre_tipo}</td>
                    <td style={{ textAlign: 'center' }}>{f.seccion_f || '—'}</td><td style={{ textAlign: 'center' }}>{f.seccion_n}</td><td style={{ textAlign: 'center' }}>{f.seccion_t}</td>
                    <td style={{ textAlign: 'center' }}>{f.Nfases}</td><td style={{ textAlign: 'center' }}>{f.Nneutro}</td><td style={{ textAlign: 'center' }}>{f.Ntierra}</td>
                    <td style={{ textAlign: 'center' }}>{f.diametro ?? '—'}</td><td style={{ textAlign: 'center' }}>{f.peso ?? '—'}</td><td style={{ textAlign: 'center' }}>{f.Iadm || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {invalidas.length > 0 && (
          <p className="text-[11px] text-danger-a10">
            Filas con datos faltantes (no se importan): {invalidas.map(f => f._fila).join(', ')} — revisá nombre / sección de fase / N° fases / Iadm.
          </p>
        )}

        {error && <p className="text-[13px] text-danger-a10">{error}</p>}
        {resultado != null && <p className="text-[13px] text-[#6aab6a]">✓ {resultado} cable{resultado !== 1 ? 's' : ''} importado{resultado !== 1 ? 's' : ''}.</p>}

        <div className="flex justify-end pt-1">
          <button className={cx.btnPrimary} disabled={validas.length === 0 || importando} onClick={importar}>
            {importando ? 'Importando...' : `Importar ${validas.length || ''} cable${validas.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────

export default function CablesPage() {
  const { showError } = useToast()
  const [familias, setFamilias] = useState<Familia[]>([])
  const [familiaId, setFamiliaId] = useState<number | null>(null)
  const [creandoFamilia, setCreandoFamilia] = useState(false)
  const [editandoFamilia, setEditandoFamilia] = useState(false)
  const [cables, setCables] = useState<Cable[]>([])
  const [loading, setLoading] = useState(true)
  const [modo, setModo] = useState<'individual' | 'lista'>('individual')

  useEffect(() => {
    getFamiliasCables()
      .then((fs: Familia[]) => {
        setFamilias(fs)
        if (fs.length > 0) setFamiliaId(fs[0].id)
        else setCreandoFamilia(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (familiaId == null) { setCables([]); return }
    getCablesPorFamilia(familiaId).then(setCables).catch(() => setCables([]))
  }, [familiaId])

  const familiaActiva = familias.find(f => f.id === familiaId) ?? null

  // Edición celda por celda: actualiza en el estado local al instante y persiste
  // con un PUT parcial (mismo patrón "editable" que las tablas de cargas/caídas).
  const actualizarCampo = (id: number, patch: Partial<CablePatch>) => {
    setCables(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    updateCable(id, patch)
      .then(() => { if (familiaId != null) invalidarCacheCables(familiaId) })
      .catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  if (loading) return <p className="p-6">Cargando...</p>

  return (
    <div className="bg-surface-a10 min-h-full">
      <div className="max-w-4xl mx-auto p-5 flex flex-col gap-4">

        {/* Selector de familia */}
        {!creandoFamilia && !editandoFamilia && (
          <div className={cx.section}>
            <div className={cx.hdr}><span>Familia de cable</span></div>
            <div className="p-3 flex items-center gap-2 bg-surface-a10 flex-wrap">
              {familias.length > 0 && (
                <select
                  className={cx.input}
                  style={{ maxWidth: 320 }}
                  value={familiaId ?? ''}
                  onChange={e => setFamiliaId(Number(e.target.value))}
                >
                  {familias.map(f => <option key={f.id} value={f.id}>{f.nombre} — {f.norma}</option>)}
                </select>
              )}
              {familiaActiva && (
                <button className={cx.btn} onClick={() => setEditandoFamilia(true)}>✎ Editar</button>
              )}
              <button className={cx.btn} onClick={() => setCreandoFamilia(true)}>+ Nueva familia</button>
            </div>
          </div>
        )}

        {creandoFamilia && (
          <FamiliaCableForm
            onGuardada={f => {
              setFamilias(prev => [...prev, f])
              setFamiliaId(f.id)
              setCreandoFamilia(false)
            }}
            onCancelar={() => setCreandoFamilia(false)}
          />
        )}

        {editandoFamilia && familiaActiva && (
          <FamiliaCableForm
            familiaEditar={familiaActiva}
            onGuardada={f => {
              setFamilias(prev => prev.map(x => x.id === f.id ? f : x))
              setEditandoFamilia(false)
            }}
            onCancelar={() => setEditandoFamilia(false)}
          />
        )}

        {familiaActiva && !creandoFamilia && !editandoFamilia && (
          <>
            {/* Cables ya cargados */}
            <div className={cx.section}>
              <div className={cx.hdr}>
                <span>Cables en {familiaActiva.nombre}</span>
                <span className="ml-auto text-[11px] text-surface-tonal-a40">{cables.length}</span>
              </div>
              {cables.length === 0 ? (
                <p className="p-3 text-[12px] text-surface-tonal-a40 bg-surface-a10">Todavía no hay cables en esta familia.</p>
              ) : (
                <div className="flex justify-center">
                <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
                  <table className="datatable" style={{ fontSize: 12, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Nombre</th><th style={thStyle}>Calibre</th>
                        <th style={thStyle}>Sección F</th><th style={thStyle}>Sección N</th><th style={thStyle}>Sección T</th>
                        <th style={thStyle}>N fases</th><th style={thStyle}>N neutros</th><th style={thStyle}>N tierras</th>
                        <th style={thStyle}>Ø (mm)</th><th style={thStyle}>Peso (kg/km)</th><th style={thStyle}>Iadm (A)</th>
                        <th style={{ width: 70 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {cables.map(c => (
                        <tr key={c.id}>
                          <td style={{ background: EDITABLE_BG, textAlign: 'center' }}>
                            <CeldaEditable valor={c.nombre} onGuardar={v => actualizarCampo(c.id, { nombre: v })} />
                          </td>
                          <td style={{ background: EDITABLE_BG, textAlign: 'center' }}>
                            <select
                              className="w-full h-6 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer text-center"
                              style={{ background: 'var(--clr-surface-a10)' }}
                              value={c.calibre_tipo}
                              onChange={e => actualizarCampo(c.id, { calibre_tipo: e.target.value })}
                            >
                              {CALIBRES.map(cal => <option key={cal} value={cal}>{cal}</option>)}
                            </select>
                          </td>
                          <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={c.seccion_f} onGuardar={v => actualizarCampo(c.id, { seccion_f: v })} /></td>
                          <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={c.seccion_n} onGuardar={v => actualizarCampo(c.id, { seccion_n: v })} /></td>
                          <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={c.seccion_t} onGuardar={v => actualizarCampo(c.id, { seccion_t: v })} /></td>
                          <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={String(c.Nfases)} onGuardar={v => actualizarCampo(c.id, { Nfases: Number(v) || 0 })} /></td>
                          <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={String(c.Nneutro)} onGuardar={v => actualizarCampo(c.id, { Nneutro: Number(v) || 0 })} /></td>
                          <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={String(c.Ntierra)} onGuardar={v => actualizarCampo(c.id, { Ntierra: Number(v) || 0 })} /></td>
                          <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={c.diametro != null ? String(c.diametro) : ''} onGuardar={v => actualizarCampo(c.id, { diametro: v.trim() ? Number(v) : null })} /></td>
                          <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={c.peso != null ? String(c.peso) : ''} onGuardar={v => actualizarCampo(c.id, { peso: v.trim() ? Number(v) : null })} /></td>
                          <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={String(c.Iadm)} onGuardar={v => actualizarCampo(c.id, { Iadm: Number(v) || 0 })} /></td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={async () => {
                                await deleteCable(c.id)
                                setCables(prev => prev.filter(x => x.id !== c.id))
                                if (familiaId != null) invalidarCacheCables(familiaId)
                              }}
                              className="text-[11px] px-2 py-0.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              )}
            </div>

            {/* Modo: individual o lista */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setModo('individual')}
                className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
                  modo === 'individual' ? 'bg-info-a0 border-info-a10 opacity-100 font-medium' : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
                }`}
              >
                Agregar uno
              </button>
              <button
                onClick={() => setModo('lista')}
                className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
                  modo === 'lista' ? 'bg-info-a0 border-info-a10 opacity-100 font-medium' : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
                }`}
              >
                Importar lista
              </button>
            </div>

            {modo === 'individual' ? (
              <NuevoCableForm familiaId={familiaActiva.id} onCreado={c => { setCables(prev => [...prev, c]); invalidarCacheCables(familiaActiva.id) }} />
            ) : (
              <ImportarCablesForm familiaId={familiaActiva.id} onImportados={cs => { setCables(prev => [...prev, ...cs]); invalidarCacheCables(familiaActiva.id) }} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
