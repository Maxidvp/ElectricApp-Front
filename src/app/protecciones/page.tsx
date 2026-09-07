'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/context/ToastContext'
import {
  getFamiliasProtecciones, createFamiliaProteccion, updateFamiliaProteccion,
  type FamiliaProteccionPatch,
} from '@/services/familiasProtecciones'
import {
  createProteccion, updateProteccion, deleteProteccion, type ProteccionPatch,
} from '@/services/protecciones'
import CeldaEditable from '@/components/CeldaEditable'
import { TIPOS_PROTECCION, CURVAS } from '@/utils/protecciones'
import { invalidarCacheProtecciones } from '@/context/ProteccionesContext'

// ── Tipos ─────────────────────────────────────────────────────────

type Variante = ProteccionPatch & { id: number; familia_id: number }
type Familia = FamiliaProteccionPatch & { id: number; protecciones: Variante[] }

// ── Estilos compartidos (mismo patrón que /cables) ────────────────

const EDITABLE_BG = 'color-mix(in srgb, #4A8FD4 4%, transparent)'
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

const CLASES_DIFERENCIAL = ['AC', 'A', 'B', 'F']

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
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; required?: boolean
}) {
  return (
    <div className={cx.field}>
      <label className={cx.label}>{label}{required && <span className="text-danger-a10 ml-0.5">*</span>}</label>
      <select className={cx.input} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Familia: crear/editar ───────────────────────────────────────────

type FamiliaForm = { tipo: string; marca: string; modelo: string; catalogo: string; norma: string }
const EMPTY_FAMILIA: FamiliaForm = { tipo: 'termomagnetico', marca: '', modelo: '', catalogo: '', norma: '' }

function familiaToForm(f: Familia): FamiliaForm {
  return { tipo: f.tipo, marca: f.marca ?? '', modelo: f.modelo ?? '', catalogo: f.catalogo ?? '', norma: f.norma ?? '' }
}

function FamiliaProteccionForm({ familiaEditar, onGuardada, onCancelar }: {
  familiaEditar?: Familia; onGuardada: (f: Familia) => void; onCancelar: () => void
}) {
  const [form, setForm] = useState<FamiliaForm>(() => familiaEditar ? familiaToForm(familiaEditar) : EMPTY_FAMILIA)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof FamiliaForm, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const puedeGuardar = !!form.tipo

  const guardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true); setError(null)
    try {
      const datos: FamiliaProteccionPatch = {
        tipo: form.tipo, marca: form.marca.trim() || null, modelo: form.modelo.trim() || null,
        catalogo: form.catalogo.trim() || null, norma: form.norma.trim() || null,
      }
      const guardada = familiaEditar
        ? await updateFamiliaProteccion(familiaEditar.id, datos)
        : await createFamiliaProteccion(datos)
      onGuardada({ ...guardada, protecciones: familiaEditar?.protecciones ?? [] })
    } catch (e) {
      setError(e instanceof Error ? e.message : `Error al ${familiaEditar ? 'editar' : 'crear'} la familia`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={cx.section}>
      <div className={cx.hdr}><span>{familiaEditar ? `Editar familia — ${familiaEditar.marca ?? ''} ${familiaEditar.modelo ?? ''}` : 'Nueva familia de protección'}</span></div>
      <div className={`${cx.grid} grid-cols-3`}>
        <Select label="Tipo" value={form.tipo} onChange={v => set('tipo', v)} options={TIPOS_PROTECCION} required />
        <Campo label="Marca" value={form.marca} onChange={v => set('marca', v)} placeholder="ej. Schneider Electric" />
        <Campo label="Modelo / línea" value={form.modelo} onChange={v => set('modelo', v)} placeholder="ej. iC60N" />
        <Campo label="Catálogo" value={form.catalogo} onChange={v => set('catalogo', v)} placeholder="ej. Acti9" />
        <Campo label="Norma" value={form.norma} onChange={v => set('norma', v)} placeholder="ej. IEC 60898-1" />
      </div>
      {error && <p className="text-[13px] text-danger-a10 px-3.5 pb-3">{error}</p>}
      <div className="flex gap-2 justify-end px-3.5 pb-3.5">
        <button className={cx.btn} onClick={onCancelar}>Cancelar</button>
        <button className={cx.btnPrimary} disabled={!puedeGuardar || guardando} onClick={guardar}>
          {guardando ? 'Guardando...' : familiaEditar ? 'Guardar cambios' : 'Crear familia'}
        </button>
      </div>
    </div>
  )
}

// ── Variante: agregar ───────────────────────────────────────────────

type VarianteForm = {
  polos: string; In: string; Icu: string; curva: string
  sensibilidad_mA: string; clase_diferencial: string
  rango_regulacion_min: string; rango_regulacion_max: string
}
const EMPTY_VARIANTE: VarianteForm = {
  polos: '', In: '', Icu: '', curva: '',
  sensibilidad_mA: '', clase_diferencial: '',
  rango_regulacion_min: '', rango_regulacion_max: '',
}

function varianteFormToPatch(form: VarianteForm): ProteccionPatch {
  const num = (v: string) => v.trim() ? Number(v) : null
  return {
    polos: num(form.polos), In: num(form.In), Icu: num(form.Icu), curva: form.curva || null,
    sensibilidad_mA: num(form.sensibilidad_mA), clase_diferencial: form.clase_diferencial || null,
    rango_regulacion_min: num(form.rango_regulacion_min), rango_regulacion_max: num(form.rango_regulacion_max),
  }
}

function NuevaVarianteForm({ familia, onCreada }: { familia: Familia; onCreada: (v: Variante) => void }) {
  const [form, setForm] = useState<VarianteForm>(EMPTY_VARIANTE)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof VarianteForm, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const esGuardamotor    = familia.tipo === 'guardamotor'
  const esDiferencial    = familia.tipo === 'diferencial'
  const esTermomagnetico = familia.tipo === 'termomagnetico' || familia.tipo === 'caja_moldeada'

  const puedeGuardar = esGuardamotor
    ? !!form.rango_regulacion_min.trim() && !!form.rango_regulacion_max.trim()
    : !!form.In.trim()

  const guardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true); setError(null)
    try {
      const creada = await createProteccion(familia.id, varianteFormToPatch(form))
      onCreada(creada)
      setForm(EMPTY_VARIANTE)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear la variante')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={cx.section}>
      <div className={cx.hdr}><span>Agregar variante</span></div>
      <div className={`${cx.grid} grid-cols-4`}>
        <Campo label="Polos" type="number" value={form.polos} onChange={v => set('polos', v)} placeholder="ej. 2" />

        {esGuardamotor ? (
          <>
            <Campo label="Rango regulación mín. (A)" type="number" value={form.rango_regulacion_min} onChange={v => set('rango_regulacion_min', v)} required />
            <Campo label="Rango regulación máx. (A)" type="number" value={form.rango_regulacion_max} onChange={v => set('rango_regulacion_max', v)} required />
          </>
        ) : (
          <Campo label="In — corriente nominal (A)" type="number" value={form.In} onChange={v => set('In', v)} required />
        )}

        <Campo label="Icu — poder de corte (kA)" type="number" value={form.Icu} onChange={v => set('Icu', v)} />

        {esTermomagnetico && (
          <Select label="Curva" value={form.curva} onChange={v => set('curva', v)} options={CURVAS.map(c => ({ value: c, label: c }))} />
        )}
        {esDiferencial && (
          <>
            <Campo label="Sensibilidad (mA)" type="number" value={form.sensibilidad_mA} onChange={v => set('sensibilidad_mA', v)} />
            <Select label="Clase" value={form.clase_diferencial} onChange={v => set('clase_diferencial', v)} options={CLASES_DIFERENCIAL.map(c => ({ value: c, label: c }))} />
          </>
        )}
      </div>
      {error && <p className="text-[13px] text-danger-a10 px-3.5 pb-3">{error}</p>}
      <div className="flex justify-end px-3.5 pb-3.5">
        <button className={cx.btnPrimary} disabled={!puedeGuardar || guardando} onClick={guardar}>
          {guardando ? 'Guardando...' : 'Agregar variante'}
        </button>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────

export default function ProteccionesPage() {
  const { showError } = useToast()
  const [familias, setFamilias] = useState<Familia[]>([])
  const [familiaId, setFamiliaId] = useState<number | null>(null)
  const [creandoFamilia, setCreandoFamilia] = useState(false)
  const [editandoFamilia, setEditandoFamilia] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<string>('')

  useEffect(() => {
    getFamiliasProtecciones()
      .then((fs: Familia[]) => {
        setFamilias(fs)
        if (fs.length > 0) setFamiliaId(fs[0].id)
        else setCreandoFamilia(true)
      })
      .finally(() => setLoading(false))
  }, [])

  const familiaActiva = familias.find(f => f.id === familiaId) ?? null
  const familiasFiltradas = filtroTipo ? familias.filter(f => f.tipo === filtroTipo) : familias

  // Edición celda por celda de una variante: actualiza el estado local (anidado dentro
  // de su familia) al instante y persiste con un PUT parcial.
  const actualizarVariante = (id: number, patch: Partial<ProteccionPatch>) => {
    setFamilias(prev => prev.map(f => f.id !== familiaId ? f : {
      ...f, protecciones: f.protecciones.map(v => v.id === id ? { ...v, ...patch } : v),
    }))
    updateProteccion(id, patch)
      .then(() => { if (familiaId != null) invalidarCacheProtecciones(familiaId) })
      .catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  const eliminarVariante = async (id: number) => {
    await deleteProteccion(id)
    setFamilias(prev => prev.map(f => f.id !== familiaId ? f : { ...f, protecciones: f.protecciones.filter(v => v.id !== id) }))
    if (familiaId != null) invalidarCacheProtecciones(familiaId)
  }

  if (loading) return <p className="p-6">Cargando...</p>

  return (
    <div className="bg-surface-a10 min-h-full">
      <div className="max-w-4xl mx-auto p-5 flex flex-col gap-4">

        <div className="flex gap-1.5 flex-wrap">
          {[{ value: '', label: 'Todas' }, ...TIPOS_PROTECCION].map(t => (
            <button
              key={t.value}
              onClick={() => setFiltroTipo(t.value)}
              className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
                filtroTipo === t.value ? 'bg-info-a0 border-info-a10 opacity-100 font-medium' : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Selector de familia */}
        {!creandoFamilia && !editandoFamilia && (
          <div className={cx.section}>
            <div className={cx.hdr}><span>Familia (marca / modelo)</span></div>
            <div className="p-3 flex items-center gap-2 bg-surface-a10 flex-wrap">
              {familiasFiltradas.length > 0 && (
                <select
                  className={cx.input}
                  style={{ maxWidth: 340 }}
                  value={familiaId ?? ''}
                  onChange={e => setFamiliaId(Number(e.target.value))}
                >
                  {familiasFiltradas.map(f => (
                    <option key={f.id} value={f.id}>{[f.marca, f.modelo].filter(Boolean).join(' ') || `Familia #${f.id}`} — {f.protecciones.length} variante{f.protecciones.length !== 1 ? 's' : ''}</option>
                  ))}
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
          <FamiliaProteccionForm
            onGuardada={f => {
              setFamilias(prev => [...prev, f])
              setFamiliaId(f.id)
              setCreandoFamilia(false)
            }}
            onCancelar={() => setCreandoFamilia(false)}
          />
        )}

        {editandoFamilia && familiaActiva && (
          <FamiliaProteccionForm
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
            {/* Variantes ya cargadas */}
            <div className={cx.section}>
              <div className={cx.hdr}>
                <span>Variantes de {[familiaActiva.marca, familiaActiva.modelo].filter(Boolean).join(' ')}</span>
                <span className="ml-auto text-[11px] text-surface-tonal-a40">{familiaActiva.protecciones.length}</span>
              </div>
              {familiaActiva.protecciones.length === 0 ? (
                <p className="p-3 text-[12px] text-surface-tonal-a40 bg-surface-a10">Todavía no hay variantes en esta familia.</p>
              ) : (
                <div className="flex justify-center">
                  <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
                    <table className="datatable" style={{ fontSize: 12, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Polos</th>
                          <th style={thStyle}>In (A)</th><th style={thStyle}>Icu (kA)</th>
                          <th style={thStyle}>Curva</th>
                          <th style={thStyle}>Sensib. (mA)</th><th style={thStyle}>Clase</th>
                          <th style={thStyle}>Rango mín (A)</th><th style={thStyle}>Rango máx (A)</th>
                          <th style={{ width: 70 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {familiaActiva.protecciones.map(v => (
                          <tr key={v.id}>
                            <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={v.polos != null ? String(v.polos) : ''} onGuardar={val => actualizarVariante(v.id, { polos: val.trim() ? Number(val) : null })} /></td>
                            <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={v.In != null ? String(v.In) : ''} onGuardar={val => actualizarVariante(v.id, { In: val.trim() ? Number(val) : null })} /></td>
                            <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={v.Icu != null ? String(v.Icu) : ''} onGuardar={val => actualizarVariante(v.id, { Icu: val.trim() ? Number(val) : null })} /></td>
                            <td style={{ background: EDITABLE_BG, textAlign: 'center' }}>
                              <select
                                className="w-full h-6 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer text-center"
                                style={{ background: 'var(--clr-surface-a10)' }}
                                value={v.curva ?? ''}
                                onChange={e => actualizarVariante(v.id, { curva: e.target.value || null })}
                              >
                                <option value="">—</option>
                                {CURVAS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={v.sensibilidad_mA != null ? String(v.sensibilidad_mA) : ''} onGuardar={val => actualizarVariante(v.id, { sensibilidad_mA: val.trim() ? Number(val) : null })} /></td>
                            <td style={{ background: EDITABLE_BG, textAlign: 'center' }}>
                              <select
                                className="w-full h-6 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer text-center"
                                style={{ background: 'var(--clr-surface-a10)' }}
                                value={v.clase_diferencial ?? ''}
                                onChange={e => actualizarVariante(v.id, { clase_diferencial: e.target.value || null })}
                              >
                                <option value="">—</option>
                                {CLASES_DIFERENCIAL.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={v.rango_regulacion_min != null ? String(v.rango_regulacion_min) : ''} onGuardar={val => actualizarVariante(v.id, { rango_regulacion_min: val.trim() ? Number(val) : null })} /></td>
                            <td style={{ background: EDITABLE_BG, textAlign: 'center' }}><CeldaEditable valor={v.rango_regulacion_max != null ? String(v.rango_regulacion_max) : ''} onGuardar={val => actualizarVariante(v.id, { rango_regulacion_max: val.trim() ? Number(val) : null })} /></td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => eliminarVariante(v.id)}
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

            <NuevaVarianteForm
              familia={familiaActiva}
              onCreada={v => {
                setFamilias(prev => prev.map(f => f.id !== familiaActiva.id ? f : { ...f, protecciones: [...f.protecciones, v] }))
                invalidarCacheProtecciones(familiaActiva.id)
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
