'use client'
import { useMemo, useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'
import type { Circuito } from '@/context/types'
import { getLastTableroId, setLastTableroId } from '@/utils/cookies'
import { buildUnifilarModel } from './_model'
import { buildPlanillaModel, computeColumnLayout, GROUP_COL_W_MIN, LABEL_COL_W_MIN } from './_planilla'
import { mergeElementosManuales } from './_elementos'
import { exportUnifilarLisp } from './_export'
import UnifilarCanvas from './UnifilarCanvas'
import LspInfoModal from './LspInfoModal'

export default function UnifilaresPage() {
  const { tableros, getTablero, loading, error } = useProyectos()

  const [tableroId, setTableroId] = useState<number | null>(getLastTableroId)

  // Los unifilares por ahora solo modelan la parte de potencia (barra + interruptores
  // termomagnéticos de los circuitos terminales) — CONTROL/DATOS quedan afuera, igual
  // criterio que Cortocircuitos.
  const tablerosPotencia = tableros.filter(t => t.categoria !== 'CONTROL' && t.categoria !== 'DATOS')

  const idEfectivo = tableroId != null && tablerosPotencia.some(t => t.id === tableroId)
    ? tableroId
    : tablerosPotencia[0]?.id ?? null
  const tablero = idEfectivo !== null ? getTablero(idEfectivo) : undefined

  const cambiarTablero = (id: number) => {
    setLastTableroId(id)
    setTableroId(id)
  }

  // Circuitos principales del tablero (sin subcircuitos de retorno/combinación),
  // en el mismo orden que se muestran en el resto de la app. El circuito marcado
  // es_acometida es la entrada del tablero (aguas arriba de la barra) — no es un
  // circuito terminal más, así que se separa del resto para dibujarse arriba.
  const { entrada, circuitos } = useMemo(() => {
    if (!tablero) return { entrada: null as Circuito | null, circuitos: [] as Circuito[] }
    const principales = [...tablero.circuitos]
      .filter(c => c.parent_id === null)
      .sort((a, b) => a.orden - b.orden)
    return {
      entrada: principales.find(c => c.es_acometida) ?? null,
      circuitos: principales.filter(c => !c.es_acometida),
    }
  }, [tablero])

  // Ancho de columnas — mínimos que crecen según el tag del tablero y las etiquetas
  // de fila (ver computeColumnLayout en _planilla.ts). Se calcula una sola vez y se
  // comparte entre el unifilar y la planilla para que las columnas queden alineadas.
  const columnLayout = useMemo(
    () => tablero ? computeColumnLayout(tablero) : { groupColW: GROUP_COL_W_MIN, labelColW: LABEL_COL_W_MIN },
    [tablero],
  )

  // Modelo automático (derivado de Circuito/Formacion/Proteccion) + lo que el
  // usuario agregó a mano sobre este tablero (ElementoUnifilar) — ver _elementos.ts.
  const modelAuto = useMemo(() => buildUnifilarModel(circuitos, entrada, columnLayout), [circuitos, entrada, columnLayout])
  const model = useMemo(
    () => mergeElementosManuales(modelAuto, tablero?.elementos_unifilar ?? [], circuitos, entrada, columnLayout),
    [modelAuto, tablero, circuitos, entrada, columnLayout],
  )
  const planillaModel = useMemo(
    () => (tablero && circuitos.length > 0 ? buildPlanillaModel(circuitos, tablero, columnLayout) : null),
    [circuitos, tablero, columnLayout],
  )

  const [mostrarInfoLsp, setMostrarInfoLsp] = useState(false)

  const exportarLisp = () => {
    if (!tablero) return
    const lisp = exportUnifilarLisp(model, planillaModel, tablero.tag)
    const blob = new Blob([lisp], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `unifilar_${tablero.tag}.lsp`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading && !tablero) return <p style={{ padding: 24 }}>Cargando...</p>
  if (error) return <p style={{ padding: 24, color: 'red' }}>Error: {error}</p>

  return (
    <div className="subcontainer flex flex-col h-[calc(100dvh-48px)] overflow-hidden">
      <div className="flex gap-1.5 px-3 pt-3 pb-2 flex-wrap shrink-0">
        {tablerosPotencia.map(t => (
          <button
            key={t.id}
            onClick={() => cambiarTablero(t.id)}
            className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
              idEfectivo === t.id
                ? 'bg-info-a0 border-info-a10 opacity-100 font-medium'
                : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
            }`}
          >
            {t.nombre || t.tag}
          </button>
        ))}
      </div>

      {!tablero ? (
        <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>Sin tablero activo.</p>
      ) : (
        <div className="datatable-container flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--dt-border-color)] shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-[14px] font-semibold text-font-a0">{tablero.tag}</span>
              {tablero.nombre && <span className="text-[13px] text-surface-tonal-a40">{tablero.nombre}</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={exportarLisp}
                disabled={circuitos.length === 0}
                className="h-[28px] px-3 rounded-md text-xs cursor-pointer border border-info-a10 bg-info-a0 text-font-a0 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Exportar a AutoCAD
              </button>
              <button
                onClick={() => setMostrarInfoLsp(true)}
                title="Cómo usar el archivo .lsp"
                className="h-[28px] w-[28px] rounded-full text-xs cursor-pointer border border-surface-tonal-a30 bg-transparent text-surface-tonal-a40 hover:text-font-a0 hover:bg-surface-tonal-a10"
              >
                ?
              </button>
            </div>
          </div>

          {/* Unifilar y planilla comparten el mismo canvas (mismo zoom/pan) — ver
              UnifilarCanvas.tsx, que dibuja la planilla como una capa más adentro de su
              propio Stage en vez de un componente aparte. flex-1 para que el canvas
              ocupe todo el alto disponible hasta abajo (el mensaje de "sin circuitos"
              ya lo muestra el canvas mismo, no hace falta repetirlo acá). */}
          <UnifilarCanvas model={model} planilla={planillaModel} />
        </div>
      )}

      {mostrarInfoLsp && <LspInfoModal onCerrar={() => setMostrarInfoLsp(false)} />}
    </div>
  )
}
