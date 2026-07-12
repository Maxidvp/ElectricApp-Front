'use client'
import { useState } from 'react'
import type { FuenteAlimentacion } from '@/context/ProyectosContext'
import { CATALOGO_TRANSFORMADORES, type TransformadorCatalogo } from '@/data/transformadoresCatalogo'

type Props = {
  fuentes: FuenteAlimentacion[]
  onAgregar: (data: Omit<FuenteAlimentacion, 'id' | 'tablero_id'>) => Promise<void>
  onActualizar: (id: number, data: Omit<FuenteAlimentacion, 'id' | 'tablero_id'>) => Promise<void>
  onEliminar: (id: number) => Promise<void>
}

const TIPOS_FUENTE = [
  { value: 'RED', label: 'Red de distribución' },
  { value: 'TRANSFORMADOR', label: 'Transformador' },
  { value: 'GENERADOR', label: 'Generador' },
  { value: 'UPS', label: 'UPS' },
  { value: 'PANEL_SOLAR', label: 'Paneles solares' },
] as const

type Tipo = typeof TIPOS_FUENTE[number]['value']

type Form = {
  tipo: Tipo
  nombre: string
  tension_nominal: string
  potencia_nominal: string
  potencia_cc: string
  corriente_cc: string
  relacion_rx: string
  xd_subtransitoria_pct: string
  factor_potencia: string
  rg_sobre_xd: string
  corriente_limitada_pu: string
  tension_primaria: string
  ukr_porcentaje: string
  perdidas_cobre_w: string
  grupo_conexion: string
}

const EMPTY: Form = {
  tipo: 'RED', nombre: '',
  tension_nominal: '', potencia_nominal: '',
  potencia_cc: '', corriente_cc: '', relacion_rx: '',
  xd_subtransitoria_pct: '', factor_potencia: '', rg_sobre_xd: '',
  corriente_limitada_pu: '',
  tension_primaria: '', ukr_porcentaje: '', perdidas_cobre_w: '', grupo_conexion: '',
}

function toForm(f: FuenteAlimentacion): Form {
  const n = (v: number | null) => v != null ? String(v) : ''
  return {
    tipo: f.tipo as Tipo, nombre: f.nombre ?? '',
    tension_nominal: n(f.tension_nominal), potencia_nominal: n(f.potencia_nominal),
    potencia_cc: n(f.potencia_cc), corriente_cc: n(f.corriente_cc), relacion_rx: n(f.relacion_rx),
    xd_subtransitoria_pct: n(f.xd_subtransitoria_pct), factor_potencia: n(f.factor_potencia), rg_sobre_xd: n(f.rg_sobre_xd),
    corriente_limitada_pu: n(f.corriente_limitada_pu),
    tension_primaria: n(f.tension_primaria), ukr_porcentaje: n(f.ukr_porcentaje),
    perdidas_cobre_w: n(f.perdidas_cobre_w), grupo_conexion: f.grupo_conexion ?? '',
  }
}

function fromForm(form: Form): Omit<FuenteAlimentacion, 'id' | 'tablero_id'> {
  const num = (v: string) => v.trim() ? Number(v) : null
  return {
    tipo: form.tipo, nombre: form.nombre.trim() || null,
    tension_nominal: num(form.tension_nominal), potencia_nominal: num(form.potencia_nominal),
    potencia_cc: num(form.potencia_cc), corriente_cc: num(form.corriente_cc), relacion_rx: num(form.relacion_rx),
    xd_subtransitoria_pct: num(form.xd_subtransitoria_pct), factor_potencia: num(form.factor_potencia), rg_sobre_xd: num(form.rg_sobre_xd),
    corriente_limitada_pu: num(form.corriente_limitada_pu),
    tension_primaria: num(form.tension_primaria), ukr_porcentaje: num(form.ukr_porcentaje),
    perdidas_cobre_w: num(form.perdidas_cobre_w), grupo_conexion: form.grupo_conexion.trim() || null,
    // Campos avanzados no expuestos en este formulario básico: quedan en null y el
    // motor de cálculo usa sus defaults (uRr vía perdidas_cobre_w, Z0/Z1 por grupo_conexion).
    uRr_porcentaje: null, impedancia_homopolar_ratio: null,
  }
}

// Valores típicos por tipo: se muestran como placeholder, no se cargan solos —
// el usuario los ve como referencia y puede sobreescribirlos.
const TIPICOS: Record<Tipo, Partial<Record<keyof Form, string>>> = {
  RED: { relacion_rx: '0.1' },
  TRANSFORMADOR: { ukr_porcentaje: 'ej. 4-6 (BT), 6-12 (MT)' },
  GENERADOR: { xd_subtransitoria_pct: '15', factor_potencia: '0.8', rg_sobre_xd: '0.15' },
  UPS: { corriente_limitada_pu: '1.5' },
  PANEL_SOLAR: { corriente_limitada_pu: '1.2' },
}

const cx = {
  input: 'h-[32px] border border-surface-tonal-a30 rounded-[7px] px-[10px] text-[13px] bg-surface-a10 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
  label: 'text-xs text-font-a20',
  field: 'flex flex-col gap-[5px]',
}

function Campo({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div className={cx.field}>
      <label className={cx.label}>{label}</label>
      <input className={cx.input} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

// El modelo de catálogo "seleccionado" no se guarda como estado aparte: se deriva
// comparando los valores actuales del formulario contra cada entrada del catálogo.
// Así, si el usuario toca cualquier campo precargado, deja de matchear con ninguno
// y el desplegable vuelve solo a "cargar valores manualmente" — no puede desincronizarse.
function coincideConCatalogo(form: Form, cat: TransformadorCatalogo): boolean {
  return form.tension_primaria === String(cat.tension_primaria)
    && form.tension_nominal === String(cat.tension_secundaria)
    && form.potencia_nominal === String(cat.potencia_nominal)
    && form.ukr_porcentaje === String(cat.ukr_porcentaje)
    && form.perdidas_cobre_w === String(cat.perdidas_cobre_w)
    && form.grupo_conexion === cat.grupo_conexion
}

// Campos específicos según el tipo de fuente elegido
function CamposPorTipo({ form, set, setMany }: {
  form: Form; set: (k: keyof Form, v: string) => void; setMany: (patch: Partial<Form>) => void
}) {
  const t = TIPICOS[form.tipo]
  if (form.tipo === 'RED') return (
    <>
      <Campo label="Tensión nominal (kV)" type="number" value={form.tension_nominal} onChange={v => set('tension_nominal', v)} placeholder="ej. 13.2" />
      <Campo label="Potencia de cortocircuito (MVA)" type="number" value={form.potencia_cc} onChange={v => set('potencia_cc', v)} placeholder="ej. 500" />
      <Campo label="Corriente de cortocircuito (kA)" type="number" value={form.corriente_cc} onChange={v => set('corriente_cc', v)} placeholder="alternativa a la potencia" />
      <Campo label="R/X" type="number" value={form.relacion_rx} onChange={v => set('relacion_rx', v)} placeholder={t.relacion_rx} />
    </>
  )
  if (form.tipo === 'TRANSFORMADOR') return (
    <>
      <div className={`${cx.field} col-span-2`}>
        <label className={cx.label}>Modelo de catálogo (opcional)</label>
        <select
          className={cx.input}
          value={CATALOGO_TRANSFORMADORES.find(cat => coincideConCatalogo(form, cat))?.id ?? ''}
          onChange={e => {
            const cat = CATALOGO_TRANSFORMADORES.find(c => c.id === e.target.value)
            if (!cat) return
            setMany({
              tension_primaria: String(cat.tension_primaria),
              tension_nominal: String(cat.tension_secundaria),
              potencia_nominal: String(cat.potencia_nominal),
              ukr_porcentaje: String(cat.ukr_porcentaje),
              perdidas_cobre_w: String(cat.perdidas_cobre_w),
              grupo_conexion: cat.grupo_conexion,
            })
          }}
        >
          <option value="">— Cargar valores manualmente —</option>
          {CATALOGO_TRANSFORMADORES.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
        </select>
        <span className="text-[11px] text-surface-tonal-a40 leading-tight">
          Serie típica IRAM 2250 (13,2 kV/400 V, Dyn11). Autocompleta los campos de abajo — quedan editables.
        </span>
      </div>
      <Campo label="Tensión primaria (kV)" type="number" value={form.tension_primaria} onChange={v => set('tension_primaria', v)} placeholder="ej. 13.2" />
      <Campo label="Tensión secundaria (V)" type="number" value={form.tension_nominal} onChange={v => set('tension_nominal', v)} placeholder="ej. 400" />
      <Campo label="Potencia nominal (kVA)" type="number" value={form.potencia_nominal} onChange={v => set('potencia_nominal', v)} placeholder="ej. 630" />
      <Campo label="Ukr (%)" type="number" value={form.ukr_porcentaje} onChange={v => set('ukr_porcentaje', v)} placeholder={t.ukr_porcentaje} />
      <Campo label="Pérdidas en el cobre (W)" type="number" value={form.perdidas_cobre_w} onChange={v => set('perdidas_cobre_w', v)} placeholder="ej. 6500" />
      <Campo label="Grupo de conexión" value={form.grupo_conexion} onChange={v => set('grupo_conexion', v)} placeholder="ej. Dyn11" />
    </>
  )
  if (form.tipo === 'GENERADOR') return (
    <>
      <Campo label="Tensión nominal (V)" type="number" value={form.tension_nominal} onChange={v => set('tension_nominal', v)} placeholder="ej. 400" />
      <Campo label="Potencia nominal (kVA)" type="number" value={form.potencia_nominal} onChange={v => set('potencia_nominal', v)} placeholder="ej. 500" />
      <Campo label="X''d (%)" type="number" value={form.xd_subtransitoria_pct} onChange={v => set('xd_subtransitoria_pct', v)} placeholder={t.xd_subtransitoria_pct} />
      <Campo label="Factor de potencia" type="number" value={form.factor_potencia} onChange={v => set('factor_potencia', v)} placeholder={t.factor_potencia} />
      <Campo label="R/X''d" type="number" value={form.rg_sobre_xd} onChange={v => set('rg_sobre_xd', v)} placeholder={t.rg_sobre_xd} />
    </>
  )
  // UPS y PANEL_SOLAR comparten forma: potencia electrónicamente limitada, sin componente subtransitoria
  return (
    <>
      <Campo label="Tensión nominal (V)" type="number" value={form.tension_nominal} onChange={v => set('tension_nominal', v)} placeholder="ej. 400" />
      <Campo label={form.tipo === 'UPS' ? 'Potencia nominal (kVA)' : 'Potencia nominal (kWp)'} type="number" value={form.potencia_nominal} onChange={v => set('potencia_nominal', v)} placeholder="ej. 100" />
      <Campo label="Corriente limitada (× In)" type="number" value={form.corriente_limitada_pu} onChange={v => set('corriente_limitada_pu', v)} placeholder={t.corriente_limitada_pu} />
    </>
  )
}

export default function FuentesSection({ fuentes, onAgregar, onActualizar, onEliminar }: Props) {
  const [editando, setEditando] = useState<number | 'nueva' | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [guardando, setGuardando] = useState(false)

  const set = (k: keyof Form, v: string) => setForm(prev => ({ ...prev, [k]: v }))
  const setMany = (patch: Partial<Form>) => setForm(prev => ({ ...prev, ...patch }))

  const abrirNueva = () => { setForm(EMPTY); setEditando('nueva') }
  const abrirEditar = (f: FuenteAlimentacion) => { setForm(toForm(f)); setEditando(f.id) }
  const cerrar = () => setEditando(null)

  const guardar = async () => {
    setGuardando(true)
    try {
      if (editando === 'nueva') await onAgregar(fromForm(form))
      else if (editando != null) await onActualizar(editando, fromForm(form))
      cerrar()
    } finally {
      setGuardando(false)
    }
  }

  const labelTipo = (t: string) => TIPOS_FUENTE.find(o => o.value === t)?.label ?? t

  return (
    <div className="border border-surface-tonal-a20 rounded-[10px] overflow-hidden">
      <div className="flex items-center gap-2 px-[14px] py-2 bg-surface-tonal-a0 border-b border-surface-tonal-a20 text-xs font-medium text-font-a20">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#c98a3e' }} />
        <span>Fuente de alimentación</span>
        {editando === null && (
          <button
            onClick={abrirNueva}
            className="ml-auto text-[11px] px-2 py-0.5 rounded border border-surface-tonal-a30 text-font-a30 hover:text-font-a10 hover:border-surface-tonal-a40 transition-colors cursor-pointer"
          >
            + Agregar fuente
          </button>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2 bg-surface-a10">
        {fuentes.length === 0 && editando === null && (
          <p className="text-[12px] text-surface-tonal-a40">Sin fuente de alimentación cargada.</p>
        )}

        {fuentes.filter(f => f.id !== editando).map(f => (
          <div key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-[7px] border border-surface-tonal-a20 bg-surface-tonal-a0">
            <div className="flex flex-col">
              <span className="text-[13px] text-font-a0">{f.nombre || labelTipo(f.tipo)}</span>
              <span className="text-[11px] text-surface-tonal-a40">{labelTipo(f.tipo)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => abrirEditar(f)} className="text-[11px] px-2 py-0.5 rounded border border-surface-tonal-a30 text-font-a30 hover:text-font-a10 cursor-pointer">
                Editar
              </button>
              <button onClick={() => onEliminar(f.id)} className="text-[11px] px-2 py-0.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 cursor-pointer">
                Eliminar
              </button>
            </div>
          </div>
        ))}

        {editando !== null && (
          <div className="flex flex-col gap-2.5 p-3 rounded-[7px] border border-info-a10 bg-surface-tonal-a0">
            <div className={cx.field}>
              <label className={cx.label}>Tipo</label>
              <select
                className={cx.input}
                value={form.tipo}
                onChange={e => setForm(prev => ({ ...EMPTY, tipo: e.target.value as Tipo, nombre: prev.nombre }))}
              >
                {TIPOS_FUENTE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <Campo label="Nombre (opcional)" value={form.nombre} onChange={v => set('nombre', v)} placeholder="ej. Grupo electrógeno N°1" />
            <div className="grid grid-cols-2 gap-[10px]">
              <CamposPorTipo form={form} set={set} setMany={setMany} />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={cerrar} className="h-[30px] px-3 rounded-[7px] text-[12px] cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 hover:bg-surface-tonal-a10">
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="h-[30px] px-3 rounded-[7px] text-[12px] font-medium cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 hover:bg-info-a10 disabled:opacity-40"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
