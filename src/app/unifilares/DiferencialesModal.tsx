'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Tablero, Circuito, Proteccion } from '@/context/types'
import { useProtecciones } from '@/context/ProteccionesContext'
import { varianteLabel } from '@/utils/protecciones'
import { INTERRUPTOR_ABBR } from './_model'

type Row = { circuitoId: number; circuito: string; checked: boolean; proteccionId: number | null }

type Props = {
  tablero: Tablero
  circuitos: Circuito[]
  onGuardar: (tableroId: number, runs: { nombre: string; proteccionId: number | null; circuitoIds: number[] }[]) => Promise<void>
  onCerrar: () => void
}

const cx = {
  select: 'h-[30px] border border-surface-tonal-a30 rounded-[6px] px-2 text-[12px] bg-surface-a10 text-font-a0 outline-none hover:border-surface-tonal-a40 focus:border-info-a10',
  btn: 'h-[34px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 hover:bg-surface-tonal-a10 disabled:opacity-50 disabled:cursor-not-allowed',
  btnPrimary: 'h-[34px] px-4 rounded-[7px] text-[13px] font-medium cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 hover:bg-info-a10 disabled:opacity-50 disabled:cursor-not-allowed',
}

type Run = { nombre: string; proteccionId: number | null; circuitoIds: number[] }

// Calcula los tramos finales a partir del estado de filas: un tramo nuevo arranca en
// cada hueco (fila destildada) o cada vez que cambia el valor de protección respecto a
// la fila anterior — así, destildar el medio de un tramo lo separa en dos aunque ambos
// mitades sigan mostrando la misma protección (ver DiferencialesModal en la conversación).
// El tag (ID-01, ID-02, ...) se arma solo, en el mismo orden en que aparecen los tramos
// acá — que es el orden de las filas (de arriba a abajo, o sea de izquierda a derecha
// en el unifilar, ya que las columnas siguen ese mismo orden). El prefijo no está
// fijo a diferenciales: sale de INTERRUPTOR_ABBR según el tipo de la familia elegida
// (mismo mapeo que usa el resto del unifilar para ITM/ID/GM), así el sistema de
// tagueo sirve para cualquier tipo de protección, no solo para este modal.
function computeRuns(rows: Row[], tagPrefix: string): Run[] {
  const runs: Run[] = []
  let actual: Run | null = null
  for (const row of rows) {
    if (!row.checked) { actual = null; continue }
    if (actual && actual.proteccionId === row.proteccionId) {
      actual.circuitoIds.push(row.circuitoId)
    } else {
      actual = { nombre: `${tagPrefix}-${String(runs.length + 1).padStart(2, '0')}`, proteccionId: row.proteccionId, circuitoIds: [row.circuitoId] }
      runs.push(actual)
    }
  }
  return runs
}

export default function DiferencialesModal({ tablero, circuitos, onGuardar, onCerrar }: Props) {
  const { familias, loading: loadingFamilias, getProteccionesDeFamilia } = useProtecciones()
  const familiasDiferencial = familias.filter(f => f.tipo === 'diferencial')

  const familiaInicial = useMemo(() => {
    const grupoConProteccion = circuitos.map(c => c.grupo_diferencial).find(g => g?.proteccion != null)
    return grupoConProteccion?.proteccion?.familia_id ?? familiasDiferencial[0]?.id ?? null
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [familiaId, setFamiliaId] = useState<number | null>(familiaInicial)
  // Prefijo de tagueo (ID-01, ID-02, ...) — sale del tipo de la familia elegida, no
  // está fijo: si el día de mañana este modal (o el sistema de protecciones en
  // general) maneja otro tipo, el tag se arma solo con el prefijo correcto.
  const tagPrefix = INTERRUPTOR_ABBR[familias.find(f => f.id === familiaId)?.tipo ?? ''] ?? 'PROT'
  const [variantes, setVariantes] = useState<Proteccion[]>([])
  const [loadingVariantes, setLoadingVariantes] = useState(false)
  const [rows, setRows] = useState<Row[]>(() => circuitos.map(c => ({
    circuitoId: c.id,
    circuito: c.circuito,
    checked: c.grupo_diferencial_id != null,
    proteccionId: c.grupo_diferencial?.proteccion_id ?? null,
  })))
  // Filas donde se apretó "+ Agregar diferencial" pero todavía no se eligió nada —
  // solo controla si se muestra el desplegable, no viaja al guardar (eso sale de
  // `rows`, ver computeRuns).
  const [agregando, setAgregando] = useState<Set<number>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (familiaId == null) { setVariantes([]); return }
    setLoadingVariantes(true)
    getProteccionesDeFamilia(familiaId).then(vs => { setVariantes(vs); setLoadingVariantes(false) })
  }, [familiaId, getProteccionesDeFamilia])

  // Las variantes de protección son propias de cada familia — si el usuario cambia de
  // familia, los proteccionId elegidos hasta ahora pertenecen a la familia anterior y ya
  // no son válidos acá (el <select> los deja de listar, pero seguirían viajando tal cual
  // al guardar si no se limpian). No corre en el mount inicial: ahí `rows` ya viene
  // poblado desde los circuitos existentes y `familiaInicial` es justamente la familia de
  // esos valores, así que no hay nada que limpiar.
  const primerRender = useRef(true)
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return }
    setRows(prev => prev.map(r => ({ ...r, proteccionId: null })))
  }, [familiaId])

  const todosSeleccionados = rows.length > 0 && rows.every(r => r.checked)

  const toggleTodos = () => {
    setRows(prev => prev.map(r => ({ ...r, checked: !todosSeleccionados })))
  }

  const toggleChecked = (i: number) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, checked: !r.checked } : r))
  }

  // Al elegir una protección en la fila i, se propaga hacia abajo por todas las filas
  // tildadas consecutivas — así un solo cambio agrupa de una todo el tramo. Si más
  // abajo se vuelve a elegir otra, ese segundo cambio corta el tramo en dos desde ahí.
  const setProteccion = (i: number, proteccionId: number | null) => {
    setRows(prev => {
      const next = [...prev]
      next[i] = { ...next[i], proteccionId }
      for (let j = i + 1; j < next.length && next[j].checked; j++) next[j] = { ...next[j], proteccionId }
      return next
    })
  }

  // Abre el desplegable en blanco (no precarga el valor heredado por propagación —
  // este circuito se ve como "sin diferencial" hasta que se elige uno de verdad) y lo
  // deja abierto hasta que se guarde algo o se aprete "Quitar".
  const abrirAgregar = (i: number) => {
    setProteccion(i, null)
    setAgregando(prev => new Set(prev).add(i))
  }

  const quitarDiferencial = (i: number) => {
    setProteccion(i, null)
    setAgregando(prev => { const next = new Set(prev); next.delete(i); return next })
  }

  // Cabeza de tramo = primera fila tildada de un grupo (arranca en un hueco o en un
  // cambio de valor respecto a la fila anterior, mismo criterio que computeRuns) — solo
  // ella muestra el control para elegir protección. El resto del tramo se dibuja con
  // líneas (ver render más abajo), no repite el texto de la protección elegida.
  const esCabezaDeTramo = (i: number) =>
    rows[i].checked && (i === 0 || !rows[i - 1].checked || rows[i - 1].proteccionId !== rows[i].proteccionId)
  const esUltimaDelTramo = (i: number) =>
    rows[i].checked && (i === rows.length - 1 || !rows[i + 1].checked || rows[i + 1].proteccionId !== rows[i].proteccionId)

  // Tag en vivo por circuito, para mostrarlo en la fila mientras se arma el grupo —
  // mismos tramos que se van a guardar (ver computeRuns), recalculado en cada cambio.
  const tagPorCircuito = useMemo(() => {
    const m = new Map<number, string>()
    for (const run of computeRuns(rows, tagPrefix)) for (const cid of run.circuitoIds) m.set(cid, run.nombre)
    return m
  }, [rows, tagPrefix])

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await onGuardar(tablero.id, computeRuns(rows, tagPrefix))
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar. Probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-100" onClick={onCerrar}>
      <div className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl w-[520px] max-w-[95vw] max-h-[85vh] flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.6)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-tonal-a20 bg-surface-tonal-a0 rounded-t-xl gap-2 shrink-0">
          <span className="text-[14px] font-medium text-font-a0">Diferenciales</span>
          <button className="bg-transparent border-none cursor-pointer text-font-a20 flex items-center p-1 rounded-md hover:bg-surface-tonal-a10 hover:text-font-a0" onClick={onCerrar}>
            <i className="material-icons">close</i>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 overflow-y-auto">
          <div className="flex flex-col gap-[5px]">
            <label className="text-xs text-font-a20">Familia</label>
            <select
              className={`${cx.select} h-[34px] text-[13px] w-full`}
              value={familiaId ?? ''}
              onChange={e => setFamiliaId(e.target.value ? Number(e.target.value) : null)}
              disabled={loadingFamilias}
            >
              <option value="">{loadingFamilias ? 'Cargando...' : '— Seleccioná —'}</option>
              {familiasDiferencial.map(f => (
                <option key={f.id} value={f.id}>{[f.marca, f.modelo].filter(Boolean).join(' ') || `Familia #${f.id}`}</option>
              ))}
            </select>
            {!loadingFamilias && familiasDiferencial.length === 0 && (
              <span className="text-[11px] text-danger-a10">
                No hay familias de diferenciales cargadas — agregalas en la página Protecciones.
              </span>
            )}
          </div>

          <label className="flex items-center gap-2 pt-1 cursor-pointer w-fit">
            <input type="checkbox" checked={todosSeleccionados} onChange={toggleTodos} />
            <span className="text-xs text-font-a20">Seleccionar todo</span>
          </label>

          <div className="flex flex-col border border-surface-tonal-a20 rounded-[7px] p-2">
            {rows.length === 0 && <span className="text-[12px] text-surface-tonal-a40 p-2">Sin circuitos en este tablero.</span>}
            {rows.map((r, i) => {
              const cabeza = r.checked && esCabezaDeTramo(i)
              const ultima = r.checked && esUltimaDelTramo(i)
              const continuacion = r.checked && !cabeza
              const conContinuacionDebajo = cabeza && !ultima
              // El desplegable solo se ve si se apretó "+ Agregar diferencial" en ESTA
              // fila, o si es cabeza de tramo con un valor ya asignado (de antes, sin
              // clickear nada) — una fila que heredó el valor por propagación (continuación)
              // no lo muestra aunque `r.proteccionId` ya lo tenga adentro, para no repetir
              // el texto de la protección elegida (ver líneas del conector, abajo).
              const mostrarSelect = agregando.has(i) || (cabeza && r.proteccionId != null)

              return (
                <div key={r.circuitoId} className="flex items-center gap-1 px-1 h-[34px] hover:bg-surface-tonal-a10">
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input type="checkbox" checked={r.checked} onChange={() => toggleChecked(i)} />
                    <span className="text-[13px] text-font-a0 w-[180px] mr-2 truncate">{r.circuito}</span>
                  </label>

                  {/* Conector visual del grupo — une con una línea continua las filas que ya
                      heredaron la protección de la cabeza del tramo, en vez de repetir el
                      texto en cada una (ver referencia que pasó el usuario: un peine vertical
                      con una rama horizontal por circuito). Sin gap/padding vertical entre
                      filas (ver contenedor y fila arriba) para que el segmento de cada fila
                      empalme justo con el de la siguiente y se vea como una sola línea. */}
                  <div className="relative w-4 self-stretch shrink-0">
                    {conContinuacionDebajo && (
                      <div className="absolute left-1/2 top-1/2 bottom-0 w-0.5 bg-font-a20" />
                    )}
                    {continuacion && (
                      <>
                        <div className={`absolute left-1/2 top-0 w-0.5 bg-font-a20 ${ultima ? 'bottom-1/2' : 'bottom-0'}`} />
                        <div className="absolute top-1/2 -left-2 w-[18px] h-0.5 bg-font-a20" />
                      </>
                    )}
                  </div>

                  <div className="flex-1 flex items-center gap-2">
                    {/* Tag automático (ID-01, ID-02, ...) — uno por tramo, en el orden en
                        que aparecen las filas (ver computeRuns). Mismo tag para toda fila
                        del tramo, cabeza o continuación, para que se identifique a qué
                        grupo pertenece cada una incluso sin abrir su desplegable. */}
                    {r.checked && (
                      <span className="text-[11px] text-surface-tonal-a40 font-mono w-[34px] shrink-0">
                        {tagPorCircuito.get(r.circuitoId)}
                      </span>
                    )}
                    {/* Texto clickeable, no botón — disponible en CUALQUIER circuito
                        tildado (cabeza o continuación), no solo en la cabeza del tramo:
                        clickearlo en una continuación arranca un tramo nuevo desde ahí
                        (mismo criterio que elegir una protección corta el grupo en dos). */}
                    {r.checked && !mostrarSelect && (
                      <span
                        onClick={() => abrirAgregar(i)}
                        className="text-[12px] text-font-a20 hover:text-font-a0 hover:underline cursor-pointer select-none"
                      >
                        + Agregar diferencial
                      </span>
                    )}
                    {r.checked && mostrarSelect && (
                      <>
                        <select
                          className={`${cx.select} flex-1`}
                          value={r.proteccionId ?? ''}
                          disabled={familiaId == null}
                          onChange={e => setProteccion(i, e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">— Sin diferencial —</option>
                          {variantes.map(v => <option key={v.id} value={v.id}>{varianteLabel(v, 'diferencial')}</option>)}
                        </select>
                        <button
                          onClick={() => quitarDiferencial(i)}
                          className="text-[11px] px-2 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 cursor-pointer shrink-0"
                        >
                          Quitar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            {familiaId != null && loadingVariantes && <span className="text-[11px] text-surface-tonal-a40 px-1">Cargando variantes...</span>}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-surface-tonal-a20 flex items-center gap-2 justify-end bg-surface-tonal-a0 rounded-b-xl shrink-0">
          {error && <span className="text-[12px] text-danger-a10 mr-auto">{error}</span>}
          <button className={cx.btn} onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button className={cx.btnPrimary} onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
