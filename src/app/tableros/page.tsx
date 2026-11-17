'use client'
import { useState, useEffect, useMemo } from 'react'
import { useProyectos } from '@/context/ProyectosContext'
import { calcCorriente } from '@/utils/electricidad'
import FuentesSection from './FuentesSection'
import { useTableroSeleccionado } from '@/hooks/useTableroSeleccionado'

// ── Tipos ─────────────────────────────────────────────────────────

type Form = {
  tag: string; nombre: string; ubicacion: string; tipo: string; categoria: string; sistema_montaje: string
  tension_mono: string; tension_bi: string; tension_tri: string; frecuencia: string
  corriente_nom: string
  potencia_inst: string; potencia_dem: string; factor_potencia: string
  fabricante: string; modelo: string; norma: string; grado_proteccion: string
  material_gabinete: string; clase_aislacion: string; grado_proteccion_operacion: string; grado_ik: string; apto_personas: string; conductores_internos: string; forma_separacion: string; esquema_tierra: string; reserva_pct: string; potencia_disipacion: string; icw_ka: string
}

// Categoría = qué diagramas/rutas de la app aplican a este tablero. `tipo` sigue
// siendo texto libre para el subtipo (Principal, Seccional, MCC, etc.) dentro de ella.
const CATEGORIAS = [
  { value: 'POTENCIA', label: 'Potencia (unifilar)' },
  { value: 'CONTROL',  label: 'Control / instrumentación (lazo)' },
  { value: 'DATOS',    label: 'Datos / comunicaciones' },
]

// Sistema de montaje — solo tiene sentido cuando categoria = POTENCIA.
const SISTEMAS_MONTAJE = [
  { value: 'RIEL_DIN',       label: 'Riel DIN (IEC 61439)' },
  { value: 'PANELBOARD',     label: 'Panelboard / Load Center (UL 67)' },
  { value: 'SWITCHBOARD',    label: 'Switchboard / barras abiertas (UL 891 / IEC 61439 PSC)' },
  { value: 'SWITCHGEAR_MT',  label: 'Switchgear metal-clad (media tensión)' },
  { value: 'MCC_BUCKETS',    label: 'MCC por cubículos extraíbles' },
]

const EMPTY: Form = {
  tag: '', nombre: '', ubicacion: '', tipo: '', categoria: '', sistema_montaje: '',
  tension_mono: '', tension_bi: '', tension_tri: '', frecuencia: '',
  corriente_nom: '',
  potencia_inst: '', potencia_dem: '', factor_potencia: '',
  fabricante: '', modelo: '', norma: '', grado_proteccion: '',
  material_gabinete: '', clase_aislacion: '', grado_proteccion_operacion: '', grado_ik: '', apto_personas: '', conductores_internos: '', forma_separacion: '', esquema_tierra: '', reserva_pct: '', potencia_disipacion: '', icw_ka: '',
}

function toForm(t: any): Form {
  const n = (v: number | null) => v != null ? String(v) : ''
  return {
    tag:              t.tag              ?? '',
    nombre:           t.nombre           ?? '',
    ubicacion:        t.ubicacion        ?? '',
    tipo:             t.tipo             ?? '',
    categoria:        t.categoria        ?? '',
    sistema_montaje:  t.sistema_montaje  ?? '',
    tension_mono:     n(t.tension_mono),
    tension_bi:       n(t.tension_bi),
    tension_tri:      n(t.tension_tri),
    frecuencia:       n(t.frecuencia),
    corriente_nom:    n(t.corriente_nom),
    potencia_inst:    n(t.potencia_inst),
    potencia_dem:     n(t.potencia_dem),
    factor_potencia:  n(t.factor_potencia),
    fabricante:       t.fabricante       ?? '',
    modelo:           t.modelo           ?? '',
    norma:            t.norma            ?? '',
    grado_proteccion: t.grado_proteccion ?? '',
    material_gabinete: t.material_gabinete ?? '',
    clase_aislacion: t.clase_aislacion ?? '',
    grado_proteccion_operacion: t.grado_proteccion_operacion ?? '',
    grado_ik: t.grado_ik ?? '',
    apto_personas: t.apto_personas ?? '',
    conductores_internos: t.conductores_internos ?? '',
    forma_separacion: t.forma_separacion ?? '',
    esquema_tierra: t.esquema_tierra ?? '',
    reserva_pct: n(t.reserva_pct ?? null),
    potencia_disipacion: n(t.potencia_disipacion ?? null),
    icw_ka: n(t.icw_ka ?? null),
  }
}

function fromForm(form: Form) {
  const num = (v: string) => v.trim() ? Number(v) : null
  const str = (v: string) => v.trim() || null
  return {
    tag:              form.tag.trim(),
    nombre:           str(form.nombre),
    ubicacion:        str(form.ubicacion),
    tipo:             str(form.tipo),
    categoria:        str(form.categoria),
    sistema_montaje:  form.categoria === 'POTENCIA' ? str(form.sistema_montaje) : null,
    tension_mono:     num(form.tension_mono),
    tension_bi:       num(form.tension_bi),
    tension_tri:      num(form.tension_tri),
    frecuencia:       num(form.frecuencia),
    corriente_nom:    num(form.corriente_nom),
    potencia_inst:    num(form.potencia_inst),
    potencia_dem:     form.categoria === 'POTENCIA' ? num(form.potencia_dem) : null,
    factor_potencia:  form.categoria === 'CONTROL' || form.categoria === 'DATOS' ? num(form.factor_potencia) : null,
    fabricante:       str(form.fabricante),
    modelo:           str(form.modelo),
    norma:            str(form.norma),
    grado_proteccion: str(form.grado_proteccion),
    material_gabinete: str(form.material_gabinete),
    clase_aislacion: str(form.clase_aislacion),
    grado_proteccion_operacion: str(form.grado_proteccion_operacion),
    grado_ik: str(form.grado_ik),
    apto_personas: str(form.apto_personas),
    conductores_internos: str(form.conductores_internos),
    forma_separacion: str(form.forma_separacion),
    esquema_tierra: str(form.esquema_tierra),
    reserva_pct: num(form.reserva_pct),
    potencia_disipacion: num(form.potencia_disipacion),
    icw_ka: num(form.icw_ka),
  }
}

// ── Estilos compartidos ────────────────────────────────────────────

const cx = {
  input: 'h-[34px] border border-surface-tonal-a30 rounded-[7px] px-[10px] text-[13px] bg-surface-a10 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10 focus:shadow-[0_0_0_3px_rgba(64,119,209,0.2)] disabled:opacity-40 disabled:cursor-not-allowed',
  label: 'text-xs text-font-a20',
  field: 'flex flex-col gap-[5px]',
  section: 'border border-surface-tonal-a20 rounded-[10px] overflow-hidden',
  hdr: 'flex items-center gap-2 px-[14px] py-2 bg-surface-tonal-a0 border-b border-surface-tonal-a20 text-xs font-medium text-font-a20',
  grid: 'p-3 grid gap-[10px] bg-surface-a10',
}

// ── Componentes de campo ──────────────────────────────────────────

function Campo({ label, name, value, onChange, placeholder, required, type = 'text' }: {
  label: string; name: string; value: string
  onChange: (v: string) => void; placeholder?: string
  required?: boolean; type?: string
}) {
  return (
    <div className={cx.field}>
      <label className={cx.label}>
        {label}{required && <span className="text-danger-a10 ml-0.5">*</span>}
      </label>
      <input
        className={`${cx.input} ${type === 'number' ? '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none' : ''}`}
        name={name}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

// Shows auto-computed hint below the field when the user hasn't entered a value manually
function CampoAuto({ label, name, value, onChange, autoValue, decimals = 1 }: {
  label: string; name: string; value: string
  onChange: (v: string) => void; autoValue: number | null; decimals?: number
}) {
  const ph = autoValue != null ? String(parseFloat(autoValue.toFixed(decimals))) : undefined
  return (
    <div className={cx.field}>
      <label className={cx.label}>{label}</label>
      <input
        className={`${cx.input} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        name={name}
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={ph}
      />
      {autoValue != null && !value.trim() && (
        <span className="text-[11px] text-font-a30 leading-none">← feeder principal</span>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────

export default function TablaTableros() {
  const {
    tableros, getTablero, loading, error, agregarTablero, duplicarTablero, actualizarTablero, eliminarTablero,
    agregarFuente, actualizarFuente, eliminarFuente,
  } = useProyectos()

  const [form,        setForm]       = useState<Form>(EMPTY)
  const [dirty,       setDirty]      = useState(false)
  const [guardando,   setGuardando]  = useState(false)
  const [guardado,    setGuardado]   = useState(false)
  const [confirm,     setConfirm]    = useState(false)
  const [creandoNuevo, setCreandoNuevo] = useState(false)

  const { tablero, idEfectivo, seleccionarTablero } = useTableroSeleccionado(tableros)

  useEffect(() => {
    if (creandoNuevo) { setForm(EMPTY); setDirty(false) }
    else if (tablero) { setForm(toForm(tablero)); setDirty(false) }
  }, [tablero?.id, creandoNuevo])

  const cambiarTablero = (id: number) => {
    seleccionarTablero(id)
    setCreandoNuevo(false)
  }

  const handleChange = (field: keyof Form, value: string) => {
    setForm(prev => ({
      ...prev, [field]: value,
      // sistema_montaje solo tiene sentido con categoria POTENCIA — se limpia si se cambia a otra
      ...(field === 'categoria' && value !== 'POTENCIA' ? { sistema_montaje: '' } : {}),
    }))
    setDirty(true)
    setGuardado(false)
  }

  const handleGuardar = async () => {
    if (!form.tag.trim()) return
    setGuardando(true)
    try {
      if (creandoNuevo) {
        const nuevo = await agregarTablero(fromForm(form))
        cambiarTablero(nuevo.id)
      } else {
        if (!tablero) return
        await actualizarTablero(tablero.id, fromForm(form) as any)
        setDirty(false)
        setGuardado(true)
        setTimeout(() => setGuardado(false), 2000)
      }
    } finally {
      setGuardando(false)
    }
  }

  const handleDuplicar = async () => {
    if (!tablero) return
    setGuardando(true)
    try {
      const nuevo = await duplicarTablero(tablero.id)
      cambiarTablero(nuevo.id)
    } finally {
      setGuardando(false)
    }
  }

  // Derive potencia_inst, potencia_dem, corriente_nom from the last feeder in the tablero
  const autoValues = useMemo(() => {
    const circuitos = tablero?.circuitos
    if (!circuitos?.length) return null

    const sorted = [...circuitos]
      .filter(c => !c.parent_id)
      .sort((a, b) => a.orden - b.orden)

    // Last alimentador by orden is the main feeder (summarizes everything above it)
    const lastFeederIdx = sorted.reduce<number>((found, c, i) => c.es_acometida ? i : found, -1)
    if (lastFeederIdx === -1) return null

    const above = sorted.slice(0, lastFeederIdx).filter(c => !c.es_acometida)
    const potencia_inst = above.reduce((s, c) => s + (c.potencia ?? 0), 0) || null

    // Weighted power factor: Σ(FPᵢ·Pᵢ) / ΣPᵢ
    const conFP = above.filter(c => c.FP != null && (c.potencia ?? 0) > 0)
    const sumPot = conFP.reduce((s, c) => s + (c.potencia ?? 0), 0)
    const fp = sumPot > 0 ? conFP.reduce((s, c) => s + c.FP! * (c.potencia ?? 0), 0) / sumPot : null

    const tipo   = form.tension_tri ? 'tri' : form.tension_bi ? 'bi' : form.tension_mono ? 'mono' : null
    const tension = tipo === 'tri' ? Number(form.tension_tri)
                  : tipo === 'bi'  ? Number(form.tension_bi)
                  : tipo === 'mono' ? Number(form.tension_mono)
                  : null

    const corriente_nom = calcCorriente(potencia_inst, tipo, tension, fp)

    return { potencia_inst, potencia_dem: potencia_inst, corriente_nom }
  }, [tablero?.circuitos, form.tension_tri, form.tension_bi, form.tension_mono])

  const handleAutocompletar = () => {
    if (!autoValues) return
    setForm(prev => ({
      ...prev,
      corriente_nom: autoValues.corriente_nom != null ? String(parseFloat(autoValues.corriente_nom.toFixed(1))) : prev.corriente_nom,
      potencia_inst: autoValues.potencia_inst != null ? String(autoValues.potencia_inst) : prev.potencia_inst,
      potencia_dem:  autoValues.potencia_dem  != null ? String(autoValues.potencia_dem)  : prev.potencia_dem,
    }))
    setDirty(true)
    setGuardado(false)
  }

  if (loading && !tablero) return <p className="p-6">Cargando...</p>
  if (error) return <p className="p-6 text-danger-a10">Error: {error}</p>

  return (
    <div className="bg-surface-a10 min-h-full">
      {/* Selector de tableros */}
      <div className="flex gap-1.5 px-3 pt-3 pb-2 flex-wrap border-b border-surface-tonal-a20 bg-surface-tonal-a0">
        {tableros.map(t => (
          <button
            key={t.id}
            onClick={() => cambiarTablero(t.id)}
            className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
              idEfectivo === t.id && !creandoNuevo
                ? 'bg-info-a0 border-info-a10 opacity-100 font-medium'
                : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
            }`}
          >
            {t.nombre || t.tag}
          </button>
        ))}
        <button
          onClick={() => setCreandoNuevo(true)}
          className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
            creandoNuevo
              ? 'bg-info-a0 border-info-a10 opacity-100 font-medium'
              : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
          }`}
        >
          + Nuevo
        </button>
      </div>

      {!tablero && !creandoNuevo ? (
        <p className="p-6 text-surface-tonal-a40 text-sm">Sin tablero seleccionado.</p>
      ) : (
        <div className="max-w-3xl mx-auto p-5 flex flex-col gap-4">

          {/* Identificación */}
          <div className={cx.section}>
            <div className={cx.hdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-primary-a0" />
              <span>Identificación</span>
            </div>
            <div className={`${cx.grid} grid-cols-2`}>
              <Campo label="Tag" name="tag" value={form.tag} onChange={v => handleChange('tag', v)} placeholder="ej. TG-01" required />
              <Campo label="Nombre" name="nombre" value={form.nombre} onChange={v => handleChange('nombre', v)} placeholder="ej. Tablero general" />
              <Campo label="Ubicación" name="ubicacion" value={form.ubicacion} onChange={v => handleChange('ubicacion', v)} placeholder="ej. Sala eléctrica piso 2" />
              <Campo label="Tipo" name="tipo" value={form.tipo} onChange={v => handleChange('tipo', v)} placeholder="ej. Principal, Seccional" />
              <div className={cx.field}>
                <label className={cx.label}>Categoría</label>
                <select
                  className={cx.input}
                  value={form.categoria}
                  onChange={e => handleChange('categoria', e.target.value)}
                >
                  <option value="">—</option>
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              {form.categoria === 'POTENCIA' && (
                <div className={cx.field}>
                  <label className={cx.label}>Sistema de montaje</label>
                  <select
                    className={cx.input}
                    value={form.sistema_montaje}
                    onChange={e => handleChange('sistema_montaje', e.target.value)}
                  >
                    <option value="">—</option>
                    {SISTEMAS_MONTAJE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Sistema eléctrico */}
          <div className={cx.section}>
            <div className={cx.hdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-warning-a10" />
              <span>Sistema eléctrico</span>
            </div>
            <div className={`${cx.grid} grid-cols-4`}>
              <Campo label="Tensión mono (V)" name="tension_mono" type="number" value={form.tension_mono} onChange={v => handleChange('tension_mono', v)} placeholder="ej. 220" />
              <Campo label="Tensión bi (V)"   name="tension_bi"   type="number" value={form.tension_bi}   onChange={v => handleChange('tension_bi', v)}   placeholder="ej. 220" />
              <Campo label="Tensión tri (V)"  name="tension_tri"  type="number" value={form.tension_tri}  onChange={v => handleChange('tension_tri', v)}  placeholder="ej. 380" />
              <Campo label="Frecuencia (Hz)"  name="frecuencia"   type="number" value={form.frecuencia}   onChange={v => handleChange('frecuencia', v)}   placeholder="ej. 50"  />
            </div>
          </div>

          {/* Equipo */}
          <div className={cx.section}>
            <div className={cx.hdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-surface-tonal-a40" />
              <span>Equipo</span>
            </div>
            <div className={`${cx.grid} grid-cols-2`}>
              <Campo label="Fabricante"        name="fabricante"       value={form.fabricante}       onChange={v => handleChange('fabricante', v)}       placeholder="ej. Siemens" />
              <Campo label="Modelo"            name="modelo"           value={form.modelo}           onChange={v => handleChange('modelo', v)}           placeholder="ej. SIVACON S8" />
              <Campo label="Norma"             name="norma"            value={form.norma}            onChange={v => handleChange('norma', v)}            placeholder="ej. IEC 61439" />
              <Campo label="Grado de protección externo" name="grado_proteccion" value={form.grado_proteccion} onChange={v => handleChange('grado_proteccion', v)} placeholder="ej. IP54" />
            </div>
          </div>

          {/* Gabinete — datos que el unifilar muestra junto al tablero (esquema tipo de
              COPAIPA, CTM-003) y los propios de un tablero industrial. Solo POTENCIA. */}
          {form.categoria === 'POTENCIA' && (
            <div className={cx.section}>
              <div className={cx.hdr}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-info-a10" />
                <span>Gabinete (datos para el unifilar)</span>
              </div>
              <div className={`${cx.grid} grid-cols-3`}>
                <Campo label="Material del gabinete" name="material_gabinete" value={form.material_gabinete} onChange={v => handleChange('material_gabinete', v)} placeholder="Metálico / Material aislante" />
                <Campo label="Clase de aislación" name="clase_aislacion" value={form.clase_aislacion} onChange={v => handleChange('clase_aislacion', v)} placeholder="ej. II" />
                <Campo label="IP para operación" name="grado_proteccion_operacion" value={form.grado_proteccion_operacion} onChange={v => handleChange('grado_proteccion_operacion', v)} placeholder="ej. IP20" />
                <Campo label="Grado IK" name="grado_ik" value={form.grado_ik} onChange={v => handleChange('grado_ik', v)} placeholder="ej. IK08" />
                <Campo label="Apto para personas" name="apto_personas" value={form.apto_personas} onChange={v => handleChange('apto_personas', v)} placeholder="ej. BA1, BA4, BA5" />
                <Campo label="Reserva (%)" name="reserva_pct" type="number" value={form.reserva_pct} onChange={v => handleChange('reserva_pct', v)} placeholder="ej. 20" />
                <Campo label="Conductores internos" name="conductores_internos" value={form.conductores_internos} onChange={v => handleChange('conductores_internos', v)} placeholder="ej. Cu/PVC IRAM NM 247-3" />
                <Campo label="Potencia de disipación (W)" name="potencia_disipacion" type="number" value={form.potencia_disipacion} onChange={v => handleChange('potencia_disipacion', v)} placeholder="solo gabinete aislante" />
                <Campo label="Esquema de conexión a tierra" name="esquema_tierra" value={form.esquema_tierra} onChange={v => handleChange('esquema_tierra', v)} placeholder="ej. TT, TN-S" />
                <Campo label="Icw de barras (kA)" name="icw_ka" type="number" value={form.icw_ka} onChange={v => handleChange('icw_ka', v)} placeholder="ej. 25" />
                <Campo label="Forma de separación" name="forma_separacion" value={form.forma_separacion} onChange={v => handleChange('forma_separacion', v)} placeholder="ej. 2b, 4a (IEC 61439)" />
              </div>
            </div>
          )}

          {/* Corrientes */}
          <div className={cx.section}>
            <div className={cx.hdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#E07070' }} />
              <span>Corrientes</span>
              {autoValues && (
                <button
                  onClick={handleAutocompletar}
                  className="ml-auto text-[11px] px-2 py-0.5 rounded border border-surface-tonal-a30 text-font-a30 hover:text-font-a10 hover:border-surface-tonal-a40 transition-colors cursor-pointer"
                >
                  Autocompletar desde feeder
                </button>
              )}
            </div>
            <div className={`${cx.grid} grid-cols-3`}>
              <CampoAuto label="Corriente nominal (A)" name="corriente_nom" value={form.corriente_nom} onChange={v => handleChange('corriente_nom', v)} autoValue={autoValues?.corriente_nom ?? null} />
            </div>
            <p className="px-3 pb-2.5 -mt-1.5 text-[11px] text-surface-tonal-a40 bg-surface-a10">
              La Icc de barra no se carga acá: se calcula en Cortocircuitos desde la fuente o el alimentador del tablero.
            </p>
          </div>

          {/* Potencias — en CONTROL/DATOS este tablero es una carga (no tiene circuitos
              propios), así que solo pide lo necesario para que el circuito ALIMENTADOR
              que lo vincule con un tablero de potencia pueda tomar su demanda. */}
          <div className={cx.section}>
            <div className={cx.hdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#6aab6a' }} />
              <span>Potencias</span>
            </div>
            {form.categoria === 'CONTROL' || form.categoria === 'DATOS' ? (
              <>
                <div className={`${cx.grid} grid-cols-2`}>
                  <Campo label="Potencia (kW)" name="potencia_inst" type="number" value={form.potencia_inst} onChange={v => handleChange('potencia_inst', v)} placeholder="ej. 0.5" />
                  <Campo label="Factor de potencia (FP)" name="factor_potencia" type="number" value={form.factor_potencia} onChange={v => handleChange('factor_potencia', v)} placeholder="ej. 0.9" />
                </div>
                <p className="px-3 pb-2.5 -mt-1.5 text-[11px] text-surface-tonal-a40 bg-surface-a10">
                  Carga que toma el circuito ALIMENTADOR que vincule este tablero con su tablero de potencia de origen.
                </p>
              </>
            ) : (
              <div className={`${cx.grid} grid-cols-2`}>
                <CampoAuto label="Potencia instalada (kW)" name="potencia_inst" value={form.potencia_inst} onChange={v => handleChange('potencia_inst', v)} autoValue={autoValues?.potencia_inst ?? null} decimals={2} />
                <CampoAuto label="Potencia demanda (kW)"   name="potencia_dem"  value={form.potencia_dem}  onChange={v => handleChange('potencia_dem', v)}  autoValue={autoValues?.potencia_dem  ?? null} decimals={2} />
              </div>
            )}
          </div>

          {/* Fuente de alimentación */}
          {!creandoNuevo && tablero && (
            <FuentesSection
              fuentes={tablero.fuentes}
              onAgregar={data => agregarFuente(tablero.id, data)}
              onActualizar={actualizarFuente}
              onEliminar={eliminarFuente}
            />
          )}

          {/* Botón guardar / duplicar / eliminar */}
          <div className="flex items-center justify-between pt-1">
            {creandoNuevo ? (
              <button
                onClick={() => setCreandoNuevo(false)}
                className="h-[34px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a10 hover:bg-surface-tonal-a20 transition-colors"
              >
                Cancelar
              </button>
            ) : confirm ? (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-surface-tonal-a40">¿Eliminar tablero?</span>
                <button
                  onClick={async () => { const id = tablero?.id; if (id) { await eliminarTablero(id); setConfirm(false) } }}
                  className="h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-danger-a10 bg-danger-a0 text-white transition-colors hover:opacity-85"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="h-[34px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a10 transition-colors hover:bg-surface-tonal-a20"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDuplicar}
                  disabled={guardando}
                  className="h-[34px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-blue-500 bg-transparent text-blue-400 transition-[background,color] hover:bg-blue-500/10 disabled:opacity-40"
                >
                  Duplicar tablero
                </button>
                <button
                  onClick={() => setConfirm(true)}
                  className="h-[34px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-red-500 bg-transparent text-red-400 transition-[background,color] hover:bg-red-500/10"
                >
                  Eliminar tablero
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              {guardado && <span className="text-[13px] text-[#6aab6a]">Guardado</span>}
              <button
                onClick={handleGuardar}
                disabled={(!dirty && !creandoNuevo) || guardando || !form.tag.trim()}
                className="h-[34px] px-5 rounded-[7px] text-[13px] font-medium cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 transition-colors hover:bg-info-a10 hover:border-info-a10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {guardando ? 'Guardando...' : creandoNuevo ? 'Crear tablero' : 'Guardar cambios'}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
