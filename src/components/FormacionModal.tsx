'use client'
import { useEffect, useState } from 'react'
import { useCables, type CableItem } from '@/context/CablesContext'

type FormacionForm = {
  familia_id: string
  cable_fase_id: string
  cond_por_fase: string
  Nfases: string
  familia_neutro_id: string
  cable_neutro_id: string
  Nneutro: string
  familia_tierra_id: string
  cable_tierra_id: string
  disposicion: string
}

export type FormacionCables = {
  fase: CableItem
  neutro: CableItem | null
  tierra: CableItem | null
}

const initialState: FormacionForm = {
  familia_id: '',
  cable_fase_id: '', cond_por_fase: '1', Nfases: '3',
  familia_neutro_id: '', cable_neutro_id: '', Nneutro: '1',
  familia_tierra_id: '', cable_tierra_id: '',
  disposicion: '',
}

type Props = {
  formacionInicial?: FormacionForm
  tipoTension?: string | null
  onGuardar: (data: FormacionForm, cables: FormacionCables) => void | Promise<void>
  onCerrar: () => void
}

let globalClipboard: FormacionForm | null = null
let globalLastParams: { familia_id: string; familia_neutro_id: string; familia_tierra_id: string; disposicion: string } | null = null

function nfasesFromTension(tipo: string | null | undefined): string {
  if (tipo === 'mono') return '1'
  if (tipo === 'bi')   return '2'
  return '3'
}

function buildInitialForm(formacionInicial: FormacionForm | undefined, tipoTension: string | null | undefined): FormacionForm {
  if (formacionInicial?.cable_fase_id) return formacionInicial
  const base = formacionInicial ?? initialState
  return {
    ...base,
    Nfases: nfasesFromTension(tipoTension),
    ...(globalLastParams ? {
      familia_id:        globalLastParams.familia_id,
      familia_neutro_id: globalLastParams.familia_neutro_id,
      familia_tierra_id: globalLastParams.familia_tierra_id,
      disposicion:       globalLastParams.disposicion,
    } : {}),
  }
}

// En una formación multipolar, Nfases siempre pasa a representar "un solo mazo".
// El neutro/tierra sueltos (cable unipolar aparte) solo se anulan cuando el propio
// cable multipolar elegido ya los trae incluidos — si no, son conductores reales
// y deben conservarse (caso real: fases en multipolar + PE suelto, por ejemplo).
function normalizarSegunTipo(f: FormacionForm, faseCable: CableItem | null): FormacionForm {
  if (f.disposicion !== 'multipolar') return f
  const out: FormacionForm = { ...f, Nfases: '1' }
  if ((faseCable?.Nneutro ?? 0) > 0) {
    out.familia_neutro_id = ''; out.cable_neutro_id = ''; out.Nneutro = '0'
  }
  if ((faseCable?.Ntierra ?? 0) > 0) {
    out.familia_tierra_id = ''; out.cable_tierra_id = ''
  }
  return out
}

const cx = {
  input: 'h-[34px] border border-surface-tonal-a30 rounded-[7px] px-[10px] text-[13px] bg-surface-a10 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10 focus:shadow-[0_0_0_3px_rgba(64,119,209,0.2)] disabled:opacity-40 disabled:cursor-not-allowed',
  label: 'text-xs text-font-a20',
  field: 'flex flex-col gap-[5px]',
  section: 'border border-surface-tonal-a20 rounded-[10px] overflow-hidden',
  sectionHdr: 'flex items-center gap-2 px-[14px] py-2 bg-surface-tonal-a0 border-b border-surface-tonal-a20 text-xs font-medium text-font-a20',
  grid: 'p-3 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-[10px] bg-surface-a10',
  btn: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 transition-colors hover:bg-surface-tonal-a10 hover:text-font-a0 disabled:opacity-50 disabled:cursor-not-allowed',
  btnPrimary: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 transition-colors hover:bg-info-a10 hover:border-info-a10 disabled:opacity-50 disabled:cursor-not-allowed',
  toggle: 'flex-1 h-[34px] rounded-[7px] text-[13px] font-medium cursor-pointer border transition-colors',
  toggleOn: 'bg-info-a0 border-info-a0 text-font-a0',
  toggleOff: 'bg-transparent border-surface-tonal-a30 text-font-a20 hover:bg-surface-tonal-a10',
  check: 'h-[34px] flex items-center gap-1.5 text-[13px] text-font-a0',
}

export default function FormacionModal({ formacionInicial, tipoTension, onGuardar, onCerrar }: Props) {
  const { familiasFiltradas: familias, getCablesDeFamilia } = useCables()

  const initialFormSnapshot = buildInitialForm(formacionInicial, tipoTension)

  const [cablesFase,      setCablesFase]      = useState<CableItem[]>([])
  const [cablesNeutro,    setCablesNeutro]    = useState<CableItem[]>([])
  const [cablesNeutroExt, setCablesNeutroExt] = useState<CableItem[]>([])
  const [cablesTierra,    setCablesTierra]    = useState<CableItem[]>([])
  const [form, setForm] = useState<FormacionForm>(() => initialFormSnapshot)
  const [modoTipo, setModoTipo] = useState<'unipolar' | 'multipolar'>(() =>
    initialFormSnapshot.disposicion === 'multipolar' ? 'multipolar' : 'unipolar')
  const [loading, setLoading] = useState(false)
  const [clipboardSnapshot, setClipboardSnapshot] = useState<FormacionForm | null>(globalClipboard)
  const [copiadoReciente, setCopiadoReciente] = useState(false)

  // Filtros del desplegable de cable multipolar
  const [filtroFases, setFiltroFases] = useState<string>(() => nfasesFromTension(tipoTension))
  const [filtroNeutro, setFiltroNeutro] = useState(false)
  const [filtroTierra, setFiltroTierra] = useState(false)
  const [filtroSeccion, setFiltroSeccion] = useState('')
  const [filtrosDesactivados, setFiltrosDesactivados] = useState<boolean>(() =>
    !!formacionInicial?.cable_fase_id && initialFormSnapshot.disposicion === 'multipolar')

  const handleTipoChange = (nuevo: 'unipolar' | 'multipolar') => {
    if (nuevo === modoTipo) return
    setModoTipo(nuevo)
    setForm(prev => ({
      ...initialState,
      familia_id: prev.familia_id,
      Nfases: nuevo === 'multipolar' ? '1' : nfasesFromTension(tipoTension),
      disposicion: nuevo === 'multipolar' ? 'multipolar' : '',
    }))
    setFiltroFases(nfasesFromTension(tipoTension))
    setFiltroNeutro(false)
    setFiltroTierra(false)
    setFiltroSeccion('')
    setFiltrosDesactivados(false)
  }

  // Cualquier cambio de filtro invalida la selección de cable actual
  const handleFiltroChange = () => setForm(prev => ({ ...prev, cable_fase_id: '' }))

  const handleCopiar = () => {
    globalClipboard = { ...form }
    setClipboardSnapshot(globalClipboard)
    setCopiadoReciente(true)
    setTimeout(() => setCopiadoReciente(false), 1500)
  }

  const handlePegar = async () => {
    if (!clipboardSnapshot) return
    const raw = clipboardSnapshot
    const modoSnap: 'unipolar' | 'multipolar' = raw.disposicion === 'multipolar' ? 'multipolar' : 'unipolar'
    if (!raw.cable_fase_id || !raw.familia_id) return
    const cablesF = await getCablesDeFamilia(Number(raw.familia_id))
    const fase    = cablesF.find(c => String(c.id) === raw.cable_fase_id)
    if (!fase) return

    const snap = normalizarSegunTipo(raw, fase)
    setForm({ ...snap })
    setModoTipo(modoSnap)
    setFiltrosDesactivados(modoSnap === 'multipolar')

    const neutroFamiliaId = modoSnap === 'multipolar' ? snap.familia_neutro_id : snap.familia_id
    const cablesN = snap.cable_neutro_id
      ? (modoSnap === 'multipolar' ? await getCablesDeFamilia(Number(neutroFamiliaId)) : cablesF)
      : []
    const neutro  = cablesN.find(c => String(c.id) === snap.cable_neutro_id) ?? null
    const cablesT = snap.familia_tierra_id ? await getCablesDeFamilia(Number(snap.familia_tierra_id)) : []
    const tierra  = cablesT.find(c => String(c.id) === snap.cable_tierra_id) ?? null
    globalLastParams = { familia_id: snap.familia_id, familia_neutro_id: snap.familia_neutro_id, familia_tierra_id: snap.familia_tierra_id, disposicion: snap.disposicion }
    await onGuardar(snap, { fase, neutro, tierra })
    onCerrar()
  }

  useEffect(() => {
    if (!form.familia_id) { setCablesFase([]); setCablesNeutro([]); return }
    getCablesDeFamilia(Number(form.familia_id)).then(cables => {
      setCablesFase(cables)
      setCablesNeutro(cables)
    })
  }, [form.familia_id])

  // Auto-setea disposición según tipo de cable seleccionado
  useEffect(() => {
    if (!form.cable_fase_id) return
    const cable = cablesFase.find(c => String(c.id) === form.cable_fase_id)
    if (!cable) return
    if (cable.Nfases > 1) {
      setForm(prev => ({ ...prev, disposicion: 'multipolar' }))
    } else if (!form.disposicion || form.disposicion === 'multipolar') {
      setForm(prev => ({ ...prev, disposicion: 'trefoil' }))
    }
  }, [form.cable_fase_id, cablesFase])

  useEffect(() => {
    if (!form.familia_tierra_id) { setCablesTierra([]); return }
    getCablesDeFamilia(Number(form.familia_tierra_id)).then(setCablesTierra)
  }, [form.familia_tierra_id])

  // Neutro suelto de una formación multipolar: familia independiente de la del fase.
  useEffect(() => {
    if (!form.familia_neutro_id) { setCablesNeutroExt([]); return }
    getCablesDeFamilia(Number(form.familia_neutro_id)).then(setCablesNeutroExt)
  }, [form.familia_neutro_id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === 'familia_id') {
      setForm(prev => ({ ...prev, familia_id: value, cable_fase_id: '', cable_neutro_id: '' }))
      return
    }
    if (name === 'familia_neutro_id') {
      setForm(prev => ({ ...prev, familia_neutro_id: value, cable_neutro_id: '' }))
      return
    }
    if (name === 'familia_tierra_id') {
      setForm(prev => ({ ...prev, familia_tierra_id: value, cable_tierra_id: '' }))
      return
    }
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleGuardar = async () => {
    if (!form.cable_fase_id || !form.familia_id) return
    const fase   = cablesFase.find(c => String(c.id) === form.cable_fase_id)
    if (!fase) return
    let datos = normalizarSegunTipo(form, fase)
    if (!neutroHabilitado) datos = { ...datos, familia_neutro_id: '', cable_neutro_id: '', Nneutro: '0' }
    if (!tierraHabilitado) datos = { ...datos, familia_tierra_id: '', cable_tierra_id: '' }
    const cablesNeutroFuente = modoTipo === 'multipolar' ? cablesNeutroExt : cablesNeutro
    const neutro = cablesNeutroFuente.find(c => String(c.id) === datos.cable_neutro_id) ?? null
    const tierra = cablesTierra.find(c => String(c.id) === datos.cable_tierra_id) ?? null
    globalLastParams = { familia_id: datos.familia_id, familia_neutro_id: datos.familia_neutro_id, familia_tierra_id: datos.familia_tierra_id, disposicion: datos.disposicion }
    setLoading(true)
    try {
      await onGuardar(datos, { fase, neutro, tierra })
    } finally {
      setLoading(false)
    }
  }

  const seccionesDisponibles = Array.from(new Set(cablesFase.map(c => c.seccion_f)))
    .sort((a, b) => parseFloat(a) - parseFloat(b))

  const cablesFiltrados = modoTipo !== 'multipolar' || filtrosDesactivados
    ? cablesFase
    : cablesFase.filter(c =>
        c.Nfases === Number(filtroFases || 0) &&
        (filtroNeutro ? c.Nneutro > 0 : c.Nneutro === 0) &&
        (filtroTierra ? c.Ntierra > 0 : c.Ntierra === 0) &&
        (!filtroSeccion || c.seccion_f === filtroSeccion)
      )

  // En multipolar, "Lleva neutro"/"Lleva tierra" tildado significa que el propio
  // cable multipolar ya los trae incluidos → el cable suelto aparte se deshabilita.
  // Destildado = el multipolar no los trae → se habilita el neutro/tierra sueltos.
  const neutroHabilitado = modoTipo === 'unipolar' || !filtroNeutro
  const tierraHabilitado = modoTipo === 'unipolar' || !filtroTierra

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-100" onClick={onCerrar}>
      <div className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl w-140 max-w-[95vw] max-h-[90vh] overflow-y-auto flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-tonal-a20 bg-surface-tonal-a0 rounded-t-xl gap-2">
          <span className="text-[14px] font-medium text-font-a0">Formación</span>
          <button className={cx.btn} onClick={handleCopiar}>
            {copiadoReciente ? '¡Copiado!' : 'Copiar'}
          </button>
          <button className={cx.btn} onClick={handlePegar} disabled={!clipboardSnapshot}>
            Pegar
          </button>
          <button className="bg-transparent border-none cursor-pointer text-font-a20 flex items-center p-1 rounded-md hover:bg-surface-tonal-a10 hover:text-font-a0" onClick={onCerrar}>
            <i className="material-icons">close</i>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 bg-surface-a0">

          <div className={cx.section}>
            <div className={cx.sectionHdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#378ADD' }} />
              <span>Conductores</span>
            </div>

            <div className="px-3 pt-3">
              <div className={cx.field}>
                <label className={cx.label}>Familia <span className="text-danger-a10 ml-0.5">*</span></label>
                <select className={cx.input} name="familia_id" value={form.familia_id} onChange={handleChange}>
                  <option value="">— Seleccioná —</option>
                  {familias.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-3 pt-3">
              <div className={cx.field}>
                <label className={cx.label}>Tipo</label>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => handleTipoChange('unipolar')}
                    className={`${cx.toggle} ${modoTipo === 'unipolar' ? cx.toggleOn : cx.toggleOff}`}>
                    Unipolar
                  </button>
                  <button type="button" onClick={() => handleTipoChange('multipolar')}
                    className={`${cx.toggle} ${modoTipo === 'multipolar' ? cx.toggleOn : cx.toggleOff}`}>
                    Multipolar
                  </button>
                </div>
              </div>
            </div>

            <div className="mx-3 mt-3 border-t border-surface-tonal-a20" />

            <div className="px-3 pt-2">
              <span className="text-[11px] font-medium text-font-a20 tracking-[0.04em]">FASE</span>
            </div>

            {modoTipo === 'unipolar' ? (
              <div className={cx.grid}>
                <div className={cx.field}>
                  <label className={cx.label}>Conductores por fase <span className="text-danger-a10 ml-0.5">*</span></label>
                  <input className={cx.input} name="cond_por_fase" type="number" min="1" max="4" value={form.cond_por_fase} onChange={handleChange} />
                </div>
                <div className={cx.field}>
                  <label className={cx.label}>N° fases <span className="text-danger-a10 ml-0.5">*</span></label>
                  <input className={cx.input} name="Nfases" type="number" min="1" max="3" value={form.Nfases} onChange={handleChange} />
                </div>
                <div className={cx.field}>
                  <label className={cx.label}>Cable <span className="text-danger-a10 ml-0.5">*</span></label>
                  <select className={cx.input} name="cable_fase_id" value={form.cable_fase_id} onChange={handleChange} disabled={!form.familia_id}>
                    <option value="">— Seleccioná —</option>
                    {cablesFase.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div className={cx.grid}>
                  <div className={cx.field}>
                    <label className={cx.label}>Cables en paralelo <span className="text-danger-a10 ml-0.5">*</span></label>
                    <input className={cx.input} name="cond_por_fase" type="number" min="1" max="4" value={form.cond_por_fase} onChange={handleChange} />
                  </div>
                </div>

                <div className="mx-3 border-t border-surface-tonal-a20" />

                <div className="px-3 pt-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-font-a20 tracking-[0.04em]">FILTROS</span>
                  <label className="flex items-center gap-1.5 text-[11px] text-font-a20 cursor-pointer">
                    <input type="checkbox" checked={filtrosDesactivados}
                      onChange={e => { setFiltrosDesactivados(e.target.checked); handleFiltroChange() }} />
                    Desactivar filtros
                  </label>
                </div>
                <div className={cx.grid}>
                  <div className={cx.field}>
                    <label className={cx.label}>N° fases</label>
                    <input className={cx.input} type="number" min="1" max="3" value={filtroFases} disabled={filtrosDesactivados}
                      onChange={e => { setFiltroFases(e.target.value); handleFiltroChange() }} />
                  </div>
                  <div className={cx.field}>
                    <label className={cx.label}>Sección principal (mm²)</label>
                    <select className={cx.input} value={filtroSeccion} disabled={filtrosDesactivados}
                      onChange={e => { setFiltroSeccion(e.target.value); handleFiltroChange() }}>
                      <option value="">— Todas —</option>
                      {seccionesDisponibles.map(s => (
                        <option key={s} value={s}>{s} mm²</option>
                      ))}
                    </select>
                  </div>
                  <div className={`${cx.field} col-span-full`}>
                    <label className={cx.label}>&nbsp;</label>
                    <div className="h-[34px] flex items-center gap-4">
                      <label className={cx.check}>
                        <input type="checkbox" checked={filtroNeutro} disabled={filtrosDesactivados}
                          onChange={e => { setFiltroNeutro(e.target.checked); handleFiltroChange() }} />
                        Lleva neutro
                      </label>
                      <label className={cx.check}>
                        <input type="checkbox" checked={filtroTierra} disabled={filtrosDesactivados}
                          onChange={e => { setFiltroTierra(e.target.checked); handleFiltroChange() }} />
                        Lleva tierra
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mx-3 border-t border-surface-tonal-a20" />

                <div className={`${cx.grid} pb-3`}>
                  <div className={`${cx.field} col-span-full`}>
                    <label className={cx.label}>Cable <span className="text-danger-a10 ml-0.5">*</span></label>
                    <select className={cx.input} name="cable_fase_id" value={form.cable_fase_id} onChange={handleChange} disabled={!form.familia_id}>
                      <option value="">— Seleccioná —</option>
                      {cablesFiltrados.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    {form.familia_id && cablesFiltrados.length === 0 && (
                      <span className="text-[11px] text-danger-a10">No hay cables que cumplan con los filtros seleccionados.</span>
                    )}
                  </div>
                </div>
              </>
            )}

            {modoTipo === 'unipolar' && (
              <>
                <div className="mx-3 mt-2 border-t border-surface-tonal-a20" />

                <div className="px-3 pt-2">
                  <span className="text-[11px] font-medium text-font-a20 tracking-[0.04em]">NEUTRO</span>
                </div>
                <div className={`${cx.grid} pb-3`}>
                  <div className={cx.field}>
                    <label className={cx.label}>N° neutros</label>
                    <input className={cx.input} name="Nneutro" type="number" min="0" max="2" value={form.Nneutro} onChange={handleChange} />
                  </div>
                  <div className={cx.field}>
                    <label className={cx.label}>Cable</label>
                    <select className={cx.input} name="cable_neutro_id" value={form.cable_neutro_id} onChange={handleChange} disabled={!form.familia_id || form.Nneutro === '0'}>
                      <option value="">— Sin neutro —</option>
                      {cablesNeutro.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {modoTipo === 'multipolar' && (
            <div className={`${cx.section} ${!neutroHabilitado ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className={cx.sectionHdr}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#888780' }} />
                <span>Neutro (cable suelto)</span>
              </div>
              <div className={cx.grid}>
                <div className={cx.field}>
                  <label className={cx.label}>N° neutros</label>
                  <input className={cx.input} name="Nneutro" type="number" min="0" max="2" value={form.Nneutro} onChange={handleChange}
                    disabled={!neutroHabilitado || !form.familia_neutro_id} />
                </div>
                <div className={cx.field}>
                  <label className={cx.label}>Familia</label>
                  <select className={cx.input} name="familia_neutro_id" value={form.familia_neutro_id} onChange={handleChange} disabled={!neutroHabilitado}>
                    <option value="">— Sin neutro —</option>
                    {familias.map((f) => (
                      <option key={f.id} value={f.id}>{f.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className={cx.field}>
                  <label className={cx.label}>Cable</label>
                  <select className={cx.input} name="cable_neutro_id" value={form.cable_neutro_id} onChange={handleChange}
                    disabled={!neutroHabilitado || !form.familia_neutro_id || form.Nneutro === '0'}>
                    <option value="">— Sin neutro —</option>
                    {cablesNeutroExt.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className={`${cx.section} ${!tierraHabilitado ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className={cx.sectionHdr}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#888780' }} />
              <span>Tierra{modoTipo === 'multipolar' ? ' (cable suelto)' : ''}</span>
            </div>
            <div className={cx.grid}>
              <div className={cx.field}>
                <label className={cx.label}>Familia</label>
                <select className={cx.input} name="familia_tierra_id" value={form.familia_tierra_id} onChange={handleChange} disabled={!tierraHabilitado}>
                  <option value="">— Sin tierra —</option>
                  {familias.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>
              <div className={cx.field}>
                <label className={cx.label}>Cable</label>
                <select className={cx.input} name="cable_tierra_id" value={form.cable_tierra_id} onChange={handleChange} disabled={!tierraHabilitado || !form.familia_tierra_id}>
                  <option value="">— Sin tierra —</option>
                  {cablesTierra.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {modoTipo === 'unipolar' && (
            <div className={cx.section}>
              <div className={cx.sectionHdr}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#7D6B9E' }} />
                <span>Disposición</span>
              </div>
              <div className={cx.grid}>
                <div className={`${cx.field} col-span-full`}>
                  <label className={cx.label}>Disposición de los conductores</label>
                  {(() => {
                    const cable = cablesFase.find(c => String(c.id) === form.cable_fase_id)
                    const isUnipolar = !cable || cable.Nfases === 1
                    return (
                      <select className={cx.input} name="disposicion" value={form.disposicion} onChange={handleChange} disabled={!form.cable_fase_id}>
                        <option value="">— Sin especificar —</option>
                        {isUnipolar ? <>
                          <option value="trefoil">Trébol compacto — cables tocando, equilátero</option>
                          <option value="plana">Plana compacta — cables tocando en línea</option>
                          <option value="trefoil_sep">Trébol espaciado — 1 diámetro de separación</option>
                          <option value="plana_sep">Plana espaciada — 1 diámetro de separación</option>
                        </> : (
                          <option value="multipolar">Multipolar — geometría interna del cable</option>
                        )}
                      </select>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="px-4 py-3 border-t border-surface-tonal-a20 flex gap-2 justify-end bg-surface-tonal-a0 rounded-b-xl">
          <button className={cx.btn} onClick={onCerrar}>Cancelar</button>
          <button className={cx.btnPrimary} onClick={handleGuardar} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar formación'}
          </button>
        </div>

      </div>
    </div>
  )
}
