'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProyectos } from '@/context/ProyectosContext'
import { useCables } from '@/context/CablesContext'
import { useAuth } from '@/context/AuthContext'
import type { FormatoFormacion, NomenclaturaFases } from '@/services/proyectos'

// ── Estilos compartidos ────────────────────────────────────────────

const cx = {
  input:   'h-[34px] border border-surface-tonal-a30 rounded-[7px] px-[10px] text-[13px] bg-surface-a10 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10 focus:shadow-[0_0_0_3px_rgba(64,119,209,0.2)]',
  label:   'text-xs text-font-a20',
  field:   'flex flex-col gap-[5px]',
  section: 'border border-surface-tonal-a20 rounded-[10px] overflow-hidden',
  hdr:     'flex items-center gap-2 px-[14px] py-2 bg-surface-tonal-a0 border-b border-surface-tonal-a20 text-xs font-medium text-font-a20',
  grid:    'p-3 grid gap-[10px] bg-surface-a10',
}

type Seccion = 'general' | 'cables' | 'expresiones' | 'participantes' | 'eliminar'

const FORMATOS: { id: FormatoFormacion; label: string; desc: string }[] = [
  { id: 'ingles',    label: 'Sistema inglés',      desc: 'Ej: 4C#10 AWG (3P-N)+1C#10 AWG (G)' },
  { id: 'extendida', label: 'Expresión extendida', desc: 'A IMPLEMENTAR' },
  { id: 'copaipa',   label: 'Expresión COPAIPA',   desc: 'Ej: 2x2,5 Cu/PVC + PE 1x2,5 Cu/PVC' },
  { id: 'resumida',  label: 'Expresión resumida',  desc: 'A IMPLEMENTAR' },
]

const NOMENCLATURAS: { id: NomenclaturaFases; label: string; fases: string; desc: string }[] = [
  { id: 'RST',    label: 'RST',      fases: 'R · S · T',          desc: 'Tradicional — Europa / Latinoamérica' },
  { id: 'L1L2L3', label: 'L1 L2 L3', fases: 'L1 · L2 · L3',      desc: 'IEC 60446 actual' },
  { id: 'ABC',    label: 'ABC',      fases: 'A · B · C',          desc: 'ANSI / IEEE — EE.UU.' },
  { id: 'UVW',    label: 'UVW',      fases: 'U · V · W',          desc: 'Motores eléctricos (IEC)' },
]

const secciones: { id: Seccion; label: string }[] = [
  { id: 'general',      label: 'General' },
  { id: 'cables',       label: 'Cables' },
  { id: 'expresiones',  label: 'Expresiones' },
  { id: 'participantes', label: 'Participantes' },
  { id: 'eliminar',     label: 'Eliminar' },
]

export default function ProyectoPage() {
  const router = useRouter()
  const {
    proyectoActivo, actualizarProyecto, eliminarProyecto,
    agregarFamiliaProyecto, quitarFamiliaProyecto,
    agregarParticipante, quitarParticipante,
  } = useProyectos()
  const { familias: todasLasFamilias } = useCables()
  const { usuario } = useAuth()

  const [seccion,   setSeccion]   = useState<Seccion>('general')
  const [nombre,    setNombre]    = useState(proyectoActivo?.nombre ?? '')
  const [desc,      setDesc]      = useState(proyectoActivo?.descripcion ?? '')
  const [dirty,     setDirty]     = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardado,  setGuardado]  = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [eliminando,  setEliminando]  = useState(false)
  const [emailNuevo, setEmailNuevo] = useState('')
  const [errorParticipante, setErrorParticipante] = useState<string | null>(null)
  const [agregandoParticipante, setAgregandoParticipante] = useState(false)

  if (!proyectoActivo) {
    return (
      <div className="h-[calc(100dvh-3rem)] bg-surface-a10 flex items-center justify-center p-8">
        <p className="text-[13px] text-surface-tonal-a40">No hay ningún proyecto activo — activá uno desde el inicio.</p>
      </div>
    )
  }

  const proyecto = proyectoActivo
  const esDueño = usuario?.id === proyecto.usuario_id || usuario?.role === 'ADMIN'

  const handleAgregarParticipante = async () => {
    if (!emailNuevo.trim() || agregandoParticipante) return
    setAgregandoParticipante(true)
    try {
      await agregarParticipante(emailNuevo.trim())
      setEmailNuevo('')
      setErrorParticipante(null)
    } catch (err) {
      setErrorParticipante((err as Error).message)
    } finally {
      setAgregandoParticipante(false)
    }
  }

  const handleGuardar = async () => {
    if (!nombre.trim()) return
    setGuardando(true)
    try {
      await actualizarProyecto(proyecto.id, { nombre: nombre.trim(), descripcion: desc.trim() || null })
      setDirty(false)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2000)
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async () => {
    if (confirmText !== proyecto.nombre || eliminando) return
    setEliminando(true)
    try {
      await eliminarProyecto(proyecto.id)
      router.push('/')
    } finally {
      setEliminando(false)
    }
  }

  const familiaIds = proyecto.familia_ids ?? []
  const formatoActivo: FormatoFormacion = (proyecto.formato_formacion ?? 'ingles') as FormatoFormacion
  const nomenclaturaActiva: NomenclaturaFases = (proyecto.nomenclatura_fases ?? 'RST') as NomenclaturaFases

  return (
    <div className="h-[calc(100dvh-3rem)] bg-surface-a10 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="bg-surface-tonal-a0 border-b border-surface-tonal-a20 px-5 py-3">
        <span className="text-[14px] font-semibold text-font-a0">{proyecto.nombre}</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-44 shrink-0 bg-surface-tonal-a0 border-r border-surface-tonal-a20 flex flex-col pt-3 gap-0.5 px-2">
          {secciones.map(s => {
            const esEliminar = s.id === 'eliminar'
            const activo = seccion === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSeccion(s.id)}
                className={`w-full text-left px-3 py-2 rounded-[7px] text-[13px] cursor-pointer border-none transition-colors ${
                  activo
                    ? esEliminar ? 'bg-danger-a0/15 text-danger-a10 font-medium' : 'bg-info-a0/20 text-info-a10 font-medium'
                    : esEliminar ? 'bg-transparent text-danger-a10/70 hover:bg-danger-a0/10 hover:text-danger-a10' : 'bg-transparent text-font-a20 hover:bg-surface-tonal-a10'
                } ${esEliminar ? 'mt-auto' : ''}`}
              >
                {s.label}
              </button>
            )
          })}
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg flex flex-col gap-5">

            {seccion === 'general' && (<>
              <div className={cx.section}>
                <div className={cx.hdr}>Información del proyecto</div>
                <div className={`${cx.grid} grid-cols-1`}>
                  <div className={cx.field}>
                    <label className={cx.label}>
                      Nombre <span className="text-danger-a10 ml-0.5">*</span>
                    </label>
                    <input
                      className={cx.input}
                      value={nombre}
                      onChange={e => { setNombre(e.target.value); setDirty(true); setGuardado(false) }}
                      placeholder="Nombre del proyecto"
                    />
                  </div>
                  <div className={cx.field}>
                    <label className={cx.label}>Descripción</label>
                    <input
                      className={cx.input}
                      value={desc}
                      onChange={e => { setDesc(e.target.value); setDirty(true); setGuardado(false) }}
                      placeholder="Descripción opcional"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleGuardar}
                  disabled={!dirty || guardando || !nombre.trim()}
                  className="h-[34px] px-5 rounded-[7px] text-[13px] font-medium cursor-pointer border-none transition-colors bg-primary-a0 hover:bg-primary-a10 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {guardando ? 'Guardando…' : guardado ? 'Guardado ✓' : 'Guardar'}
                </button>
              </div>
            </>)}

            {seccion === 'expresiones' && (<>
              <div className={cx.section}>
                <div className={cx.hdr}>Formato de expresión de formaciones</div>
                <div className="p-3 flex flex-col gap-2 bg-surface-a10">
                  {FORMATOS.map(f => {
                    const activo = formatoActivo === f.id
                    return (
                      <button
                        key={f.id}
                        onClick={() => actualizarProyecto(proyecto.id, { nombre: proyecto.nombre, descripcion: proyecto.descripcion, formato_formacion: f.id })}
                        className={`w-full text-left flex flex-col gap-0.5 px-3 py-2.5 rounded-[7px] border cursor-pointer transition-colors ${
                          activo
                            ? 'border-info-a10 bg-info-a0/10'
                            : 'border-surface-tonal-a20 bg-surface-tonal-a0 hover:bg-surface-tonal-a10'
                        }`}
                      >
                        <span className={`text-[13px] font-medium ${activo ? 'text-info-a10' : 'text-font-a0'}`}>
                          {activo ? '● ' : '○ '}{f.label}
                        </span>
                        <span className="text-[11px] text-surface-tonal-a40 font-mono">{f.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={cx.section}>
                <div className={cx.hdr}>Nomenclatura de fases</div>
                <div className="p-3 flex flex-col gap-2 bg-surface-a10">
                  {NOMENCLATURAS.map(n => {
                    const activo = nomenclaturaActiva === n.id
                    return (
                      <button
                        key={n.id}
                        onClick={() => actualizarProyecto(proyecto.id, { nombre: proyecto.nombre, descripcion: proyecto.descripcion, nomenclatura_fases: n.id })}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[7px] border cursor-pointer transition-colors ${
                          activo
                            ? 'border-info-a10 bg-info-a0/10'
                            : 'border-surface-tonal-a20 bg-surface-tonal-a0 hover:bg-surface-tonal-a10'
                        }`}
                      >
                        <span className={`text-[13px] font-medium w-16 shrink-0 ${activo ? 'text-info-a10' : 'text-font-a0'}`}>
                          {activo ? '● ' : '○ '}{n.label}
                        </span>
                        <span className="text-[12px] font-mono text-font-a0 w-24 shrink-0">{n.fases}</span>
                        <span className="text-[11px] text-surface-tonal-a40">{n.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>)}

            {seccion === 'cables' && (
              <div className={cx.section}>
                <div className={cx.hdr}>Cables del proyecto</div>
                <div className="p-3 flex flex-col gap-2 bg-surface-a10">
                  {todasLasFamilias.length === 0 && (
                    <p className="text-xs text-surface-tonal-a40 py-2">No hay familias de cables cargadas.</p>
                  )}
                  {todasLasFamilias.map(f => {
                    const asignada = familiaIds.includes(f.id)
                    return (
                      <div key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-[7px] border border-surface-tonal-a20 bg-surface-tonal-a0">
                        <span className="text-[13px] text-font-a0">{f.nombre}</span>
                        <button
                          onClick={() => asignada ? quitarFamiliaProyecto(f.id) : agregarFamiliaProyecto(f.id)}
                          className={`h-[28px] px-3 rounded-[6px] text-[12px] font-medium cursor-pointer border-none transition-colors ${
                            asignada
                              ? 'bg-danger-a0/15 text-danger-a10 hover:bg-danger-a0/25'
                              : 'bg-info-a0/15 text-info-a10 hover:bg-info-a0/25'
                          }`}
                        >
                          {asignada ? '− Quitar' : '+ Agregar'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {seccion === 'participantes' && (
              <div className={cx.section}>
                <div className={cx.hdr}>Participantes</div>
                <div className="p-3 flex flex-col gap-2 bg-surface-a10">
                  <div className="px-3 py-2 rounded-[7px] border border-surface-tonal-a20 bg-surface-tonal-a0 text-[13px] text-font-a0">
                    Dueño: {proyecto.usuario?.email}
                  </div>
                  {proyecto.participantes.map(({ usuario: p }) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-[7px] border border-surface-tonal-a20 bg-surface-tonal-a0">
                      <span className="text-[13px] text-font-a0">{p.email}</span>
                      {esDueño && (
                        <button
                          onClick={() => quitarParticipante(p.id)}
                          className="h-[28px] px-3 rounded-[6px] text-[12px] font-medium cursor-pointer border-none transition-colors bg-danger-a0/15 text-danger-a10 hover:bg-danger-a0/25"
                        >
                          − Quitar
                        </button>
                      )}
                    </div>
                  ))}
                  {proyecto.participantes.length === 0 && (
                    <p className="text-xs text-surface-tonal-a40 py-2">Todavía no hay participantes agregados.</p>
                  )}
                  {esDueño && (
                    <div className="flex gap-2 mt-2">
                      <input
                        className={cx.input}
                        value={emailNuevo}
                        onChange={e => { setEmailNuevo(e.target.value); setErrorParticipante(null) }}
                        placeholder="email@ejemplo.com"
                        autoComplete="off"
                      />
                      <button
                        onClick={handleAgregarParticipante}
                        disabled={!emailNuevo.trim() || agregandoParticipante}
                        className="h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border-none transition-colors bg-info-a0/15 text-info-a10 hover:bg-info-a0/25 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {agregandoParticipante ? 'Agregando…' : '+ Agregar'}
                      </button>
                    </div>
                  )}
                  {errorParticipante && <p className="text-xs text-danger-a10">{errorParticipante}</p>}
                </div>
              </div>
            )}

            {seccion === 'eliminar' && (
              <div className={cx.section} style={{ borderColor: 'var(--clr-danger-a10)' }}>
                <div className={cx.hdr} style={{ color: 'var(--clr-danger-a10)' }}>Eliminar proyecto</div>
                <div className="p-4 flex flex-col gap-3.5 bg-surface-a10">
                  <p className="text-[13px] text-font-a0 leading-relaxed">
                    Esta acción elimina el proyecto <b>{proyecto.nombre}</b> junto con todos sus tableros y circuitos
                    asociados. <b className="text-danger-a10">No se puede deshacer.</b>
                  </p>
                  <div className={cx.field}>
                    <label className={cx.label}>
                      Para confirmar, escribí <b className="text-font-a0">{proyecto.nombre}</b> abajo:
                    </label>
                    <input
                      className={cx.input}
                      value={confirmText}
                      onChange={e => setConfirmText(e.target.value)}
                      placeholder={proyecto.nombre}
                      autoComplete="off"
                    />
                  </div>
                  <button
                    onClick={handleEliminar}
                    disabled={confirmText !== proyecto.nombre || eliminando}
                    className="self-start h-[36px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border-none bg-danger-a0 text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {eliminando ? 'Eliminando…' : `Eliminar ${proyecto.nombre}`}
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
