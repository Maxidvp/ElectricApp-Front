'use client'
import { useMemo, useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'
import type { Circuito } from '@/context/types'
import type { FormatoFormacion } from '@/utils/electricidad'
import { useTableroSeleccionado } from '@/hooks/useTableroSeleccionado'
import { buildUnifilarModel, separarEntradas, type EntradaUnifilar } from './_model'
import { buildPlanillaModel, computeColumnLayout, GROUP_COL_W_MIN, LABEL_COL_W_MIN } from './_planilla'
import { mergeElementosManuales } from './_elementos'
import { exportUnifilarLisp } from './_export'
import UnifilarCanvas from './UnifilarCanvas'
import LspInfoModal from './LspInfoModal'
import { datosTableroUnifilar } from './_datosTablero'
import { calcularIccTablero } from '@/utils/calcularIccTablero'
import { resolverCargaCircuito, tensionesDe, type CargaCircuito } from '@/utils/cargas'
import DiferencialesModal from './DiferencialesModal'

export default function UnifilaresPage() {
  const { tableros, getTablero, loading, error, guardarGruposDiferenciales, proyectoActivo } = useProyectos()
  const formato = (proyectoActivo?.formato_formacion ?? 'ingles') as FormatoFormacion


  // Los unifilares por ahora solo modelan la parte de potencia (barra + interruptores
  // termomagnéticos de los circuitos terminales) — CONTROL/DATOS quedan afuera, igual
  // criterio que Cortocircuitos.
  const tablerosPotencia = tableros.filter(t => t.categoria !== 'CONTROL' && t.categoria !== 'DATOS')

  const { tablero, idEfectivo, seleccionarTablero } = useTableroSeleccionado(tablerosPotencia)

  const cambiarTablero = (id: number) => {
    seleccionarTablero(id)
  }

  // Circuitos principales del tablero (sin subcircuitos de retorno/combinación),
  // en el mismo orden que se muestran en el resto de la app. El circuito marcado
  // es_acometida es la entrada del tablero (aguas arriba de la barra) — no es un
  // circuito terminal más, así que se separa del resto para dibujarse arriba.
  // Puede haber más de una acometida (emergencia + principal): se dibujan todas, cada
  // una sobre la barra de los circuitos que alimenta — ver armarBarras en _model.ts.
  const { entrada, entradas, circuitos } = useMemo(() => {
    if (!tablero) return { entrada: null as Circuito | null, entradas: [] as EntradaUnifilar[], circuitos: [] as Circuito[] }
    const principales = [...tablero.circuitos]
      .filter(c => c.parent_id === null)
      .sort((a, b) => a.orden - b.orden)
    const sep = separarEntradas(principales)
    // De dónde viene cada acometida: el alimentador de otro tablero que llega a ella
    // (vinculado a ella, o sin indicar acometida si es la principal, la última), o las
    // fuentes propias del tablero para la principal.
    const alimentadores = tableros.flatMap(t => t.circuitos.map(c => ({ c, origen: t })))
      .filter(({ c }) => c.tipo === 'ALIMENTADOR' && c.tablero_destino_id === tablero.id)
    sep.entradas.forEach((e, i) => {
      const esPrincipal = i === sep.entradas.length - 1
      const origenes = alimentadores
        .filter(({ c }) => c.acometida_destino_id === e.circuito.id || (esPrincipal && !sep.entradas.some(x => x.circuito.id === c.acometida_destino_id)))
        .map(({ origen }) => origen.tag)
      // Sin alimentador de otro tablero: las fuentes propias. Con más de una acometida,
      // la principal toma la red/transformador y las demás las fuentes de respaldo
      // (generador, UPS, solar).
      if (origenes.length === 0) {
        const respaldo = (f: { tipo: string }) => ['GENERADOR', 'UPS', 'PANEL_SOLAR'].includes(f.tipo)
        const propias = sep.entradas.length === 1 ? tablero.fuentes : tablero.fuentes.filter(f => respaldo(f) !== esPrincipal)
        origenes.push(...propias.map(f => f.nombre || f.tipo.replace('_', ' ')))
      }
      if (origenes.length) e.desde = [...new Set(origenes)].join(' / ')
    })
    // `entrada` (la primera) queda solo como ancla de los elementos manuales pegados a "la entrada".
    return { entrada: sep.entradas[0]?.circuito ?? null, ...sep }
  }, [tablero, tableros])

  // Ancho de columnas — mínimos que crecen según el tag del tablero y las etiquetas
  // de fila (ver computeColumnLayout en _planilla.ts). Se calcula una sola vez y se
  // comparte entre el unifilar y la planilla para que las columnas queden alineadas.
  const columnLayout = useMemo(
    () => tablero ? computeColumnLayout(tablero, formato) : { groupColW: GROUP_COL_W_MIN, labelColW: LABEL_COL_W_MIN },
    [tablero, formato],
  )

  // Modelo automático (derivado de Circuito/Formacion/Proteccion) + lo que el
  // usuario agregó a mano sobre este tablero (ElementoUnifilar) — ver _elementos.ts.
  const modelAuto = useMemo(
    () => buildUnifilarModel(circuitos, entrada, columnLayout, entradas,
      tablero ? datosTableroUnifilar(tablero, calcularIccTablero(tablero, tableros)) : undefined),
    [circuitos, entrada, columnLayout, entradas, tablero, tableros],
  )
  const model = useMemo(
    () => mergeElementosManuales(modelAuto, tablero?.elementos_unifilar ?? [], circuitos, entrada, columnLayout),
    [modelAuto, tablero, circuitos, entrada, columnLayout],
  )
  // Carga efectiva de cada circuito, la misma que usan Cargas, Ampacidad y Caídas.
  const cargas = useMemo(() => {
    const m = new Map<number, CargaCircuito>()
    if (!tablero) return m
    const principales = [...tablero.circuitos].filter(c => c.parent_id === null).sort((a, b) => a.orden - b.orden)
    principales.forEach((c, i) => m.set(c.id, resolverCargaCircuito(c, principales.slice(0, i), tensionesDe(tablero), tableros)))
    return m
  }, [tablero, tableros])

  const planillaModel = useMemo(
    () => (tablero && circuitos.length > 0 ? buildPlanillaModel(circuitos, tablero, columnLayout, formato, cargas) : null),
    [circuitos, tablero, columnLayout, formato, cargas],
  )

  const [mostrarInfoLsp, setMostrarInfoLsp] = useState(false)
  const [mostrarDiferenciales, setMostrarDiferenciales] = useState(false)

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
                onClick={() => setMostrarDiferenciales(true)}
                disabled={circuitos.length === 0}
                className="h-[28px] px-3 rounded-md text-xs cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a0 hover:bg-surface-tonal-a10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Diferenciales
              </button>
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
      {mostrarDiferenciales && tablero && (
        <DiferencialesModal
          tablero={tablero}
          circuitos={circuitos}
          onGuardar={guardarGruposDiferenciales}
          onCerrar={() => setMostrarDiferenciales(false)}
        />
      )}
    </div>
  )
}
