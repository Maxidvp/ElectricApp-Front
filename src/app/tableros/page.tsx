'use client'
import { useState, useEffect } from 'react'
import { useProyectos } from '@/context/ProyectosContext'

// ── Tipos ─────────────────────────────────────────────────────────

type Form = {
  tag: string; nombre: string; ubicacion: string; tipo: string
  tension_mono: string; tension_bi: string; tension_tri: string; frecuencia: string
  corriente_nom: string; corriente_cc: string
  potencia_inst: string; potencia_dem: string
  fabricante: string; modelo: string; norma: string; grado_proteccion: string
}

const EMPTY: Form = {
  tag: '', nombre: '', ubicacion: '', tipo: '',
  tension_mono: '', tension_bi: '', tension_tri: '', frecuencia: '',
  corriente_nom: '', corriente_cc: '',
  potencia_inst: '', potencia_dem: '',
  fabricante: '', modelo: '', norma: '', grado_proteccion: '',
}

function toForm(t: any): Form {
  const n = (v: number | null) => v != null ? String(v) : ''
  return {
    tag:              t.tag              ?? '',
    nombre:           t.nombre           ?? '',
    ubicacion:        t.ubicacion        ?? '',
    tipo:             t.tipo             ?? '',
    tension_mono:     n(t.tension_mono),
    tension_bi:       n(t.tension_bi),
    tension_tri:      n(t.tension_tri),
    frecuencia:       n(t.frecuencia),
    corriente_nom:    n(t.corriente_nom),
    corriente_cc:     n(t.corriente_cc),
    potencia_inst:    n(t.potencia_inst),
    potencia_dem:     n(t.potencia_dem),
    fabricante:       t.fabricante       ?? '',
    modelo:           t.modelo           ?? '',
    norma:            t.norma            ?? '',
    grado_proteccion: t.grado_proteccion ?? '',
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
    tension_mono:     num(form.tension_mono),
    tension_bi:       num(form.tension_bi),
    tension_tri:      num(form.tension_tri),
    frecuencia:       num(form.frecuencia),
    corriente_nom:    num(form.corriente_nom),
    corriente_cc:     num(form.corriente_cc),
    potencia_inst:    num(form.potencia_inst),
    potencia_dem:     num(form.potencia_dem),
    fabricante:       str(form.fabricante),
    modelo:           str(form.modelo),
    norma:            str(form.norma),
    grado_proteccion: str(form.grado_proteccion),
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

// ── Página ────────────────────────────────────────────────────────

export default function TablaTableros() {
  const { tableros, getTablero, loading, error, agregarTablero, duplicarTablero, actualizarTablero, eliminarTablero } = useProyectos()

  const [tableroId, setTableroId] = useState<number | null>(() => {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match(/(?:^|;\s*)last_tablero_id=(\d+)/)
    return m ? Number(m[1]) : null
  })
  const [form,        setForm]       = useState<Form>(EMPTY)
  const [dirty,       setDirty]      = useState(false)
  const [guardando,   setGuardando]  = useState(false)
  const [guardado,    setGuardado]   = useState(false)
  const [confirm,     setConfirm]    = useState(false)
  const [creandoNuevo, setCreandoNuevo] = useState(false)

  const idEfectivo = tableroId ?? tableros[0]?.id ?? null
  const tablero    = idEfectivo !== null ? getTablero(idEfectivo) : undefined

  useEffect(() => {
    if (creandoNuevo) { setForm(EMPTY); setDirty(false) }
    else if (tablero) { setForm(toForm(tablero)); setDirty(false) }
  }, [tablero?.id, creandoNuevo])

  const cambiarTablero = (id: number) => {
    document.cookie = `last_tablero_id=${id};path=/;max-age=31536000`
    setTableroId(id)
    setCreandoNuevo(false)
  }

  const handleChange = (field: keyof Form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
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

          {/* Corrientes */}
          <div className={cx.section}>
            <div className={cx.hdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#E07070' }} />
              <span>Corrientes</span>
            </div>
            <div className={`${cx.grid} grid-cols-2`}>
              <Campo label="Corriente nominal (A)"       name="corriente_nom" type="number" value={form.corriente_nom} onChange={v => handleChange('corriente_nom', v)} placeholder="ej. 400" />
              <Campo label="Corriente de cortocircuito (kA)" name="corriente_cc"  type="number" value={form.corriente_cc}  onChange={v => handleChange('corriente_cc', v)}  placeholder="ej. 25"  />
            </div>
          </div>

          {/* Potencias */}
          <div className={cx.section}>
            <div className={cx.hdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#6aab6a' }} />
              <span>Potencias</span>
            </div>
            <div className={`${cx.grid} grid-cols-2`}>
              <Campo label="Potencia instalada (kW)" name="potencia_inst" type="number" value={form.potencia_inst} onChange={v => handleChange('potencia_inst', v)} placeholder="ej. 150" />
              <Campo label="Potencia demanda (kW)" name="potencia_dem"  type="number" value={form.potencia_dem}  onChange={v => handleChange('potencia_dem', v)}  placeholder="ej. 100" />
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
              <Campo label="Grado de protección" name="grado_proteccion" value={form.grado_proteccion} onChange={v => handleChange('grado_proteccion', v)} placeholder="ej. IP54" />
            </div>
          </div>

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
