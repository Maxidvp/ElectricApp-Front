'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useProyectos } from '@/context/ProyectosContext'
import CeldaEditable from '@/components/CeldaEditable'
import ConfirmModal from '@/components/ConfirmModal'
import type { Local } from '@/context/types'

// Locales del proyecto: los ambientes con sus puntos de utilización, condiciones de
// uso y materiales. Es la carga de datos de la "Planilla de Locales" de COPAIPA
// (CTM-002, ver Docs COPAIPA/); el documento imprimible está en /memorias/locales.
// Sirve igual para una vivienda (dormitorio, cocina…) que para una planta industrial
// (nave, sala de tableros, depósito…): la unidad funcional agrupa los ambientes.

type Columna = {
  campo: keyof Local; titulo: string; ancho: number
  tipo: 'texto' | 'numero' | 'entero'; grupo?: string; alinear?: 'left' | 'center'; ayuda?: string
}

const COLUMNAS: Columna[] = [
  { campo: 'unidad_funcional', titulo: 'Unidad funcional', ancho: 150, tipo: 'texto', alinear: 'left', ayuda: 'Agrupa locales: Depto. 1, Local comercial, Nave de producción…' },
  { campo: 'tablero', titulo: 'Tablero', ancho: 100, tipo: 'texto', ayuda: 'Tablero(s) que lo alimentan, ej. TSG o TSCO / TSGr' },
  { campo: 'planta', titulo: 'Planta', ancho: 60, tipo: 'texto' },
  { campo: 'numero', titulo: 'N°', ancho: 50, tipo: 'texto' },
  { campo: 'nombre', titulo: 'Ambiente / función', ancho: 170, tipo: 'texto', alinear: 'left' },
  { campo: 'area', titulo: 'Área (m²)', ancho: 70, tipo: 'numero' },
  { campo: 'largo', titulo: 'Largo (m)', ancho: 70, tipo: 'numero', ayuda: 'Para pasillos y similares' },
  { campo: 'iug', titulo: 'IUG', ancho: 50, tipo: 'entero', grupo: 'Puntos de utilización' },
  { campo: 'tug', titulo: 'TUG', ancho: 50, tipo: 'entero', grupo: 'Puntos de utilización' },
  { campo: 'tue', titulo: 'TUE', ancho: 50, tipo: 'entero', grupo: 'Puntos de utilización' },
  { campo: 'otros', titulo: 'Otros', ancho: 55, tipo: 'entero', grupo: 'Puntos de utilización' },
  { campo: 'cap_personas', titulo: 'Personas', ancho: 90, tipo: 'texto', grupo: 'Condiciones de utilización', ayuda: 'Capacidad de las personas, ej. BA1, BA2' },
  { campo: 'evacuacion', titulo: 'Evacuación', ancho: 80, tipo: 'texto', grupo: 'Condiciones de utilización', ayuda: 'ej. BD1' },
  { campo: 'materiales', titulo: 'Materiales', ancho: 80, tipo: 'texto', grupo: 'Condiciones de utilización', ayuda: 'ej. BE1' },
  { campo: 'otras', titulo: 'Otras', ancho: 80, tipo: 'texto', grupo: 'Condiciones de utilización' },
  { campo: 'canalizacion', titulo: 'Canalización', ancho: 150, tipo: 'texto', grupo: 'Materiales permitidos', ayuda: 'ej. (pR) IEC 61386-21' },
  { campo: 'conductores', titulo: 'Conductores / cables', ancho: 170, tipo: 'texto', grupo: 'Materiales permitidos', ayuda: 'ej. Cu/PVC - IRAM NM 247-3' },
]

// Grupos de encabezado contiguos: [título, cantidad de columnas].
const GRUPOS = COLUMNAS.reduce<[string, number][]>((acc, c) => {
  const g = c.grupo ?? ''
  if (acc.length && acc[acc.length - 1][0] === g) acc[acc.length - 1][1]++
  else acc.push([g, 1])
  return acc
}, [])

export default function LocalesPage() {
  const { locales, agregarLocal, actualizarLocal, eliminarLocal, proyectoActivo, tableros } = useProyectos()
  const [aEliminar, setAEliminar] = useState<Local | null>(null)

  const ordenados = useMemo(() => [...locales].sort((a, b) => a.orden - b.orden || a.id - b.id), [locales])
  const totales = useMemo(() => ({
    area: locales.reduce((s, l) => s + (l.area ?? 0), 0),
    iug: locales.reduce((s, l) => s + (l.iug ?? 0), 0),
    tug: locales.reduce((s, l) => s + (l.tug ?? 0), 0),
    tue: locales.reduce((s, l) => s + (l.tue ?? 0), 0),
    otros: locales.reduce((s, l) => s + (l.otros ?? 0), 0),
  }), [locales])

  if (!proyectoActivo) return <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>Sin proyecto activo.</p>

  const guardar = (l: Local, c: Columna, texto: string) => {
    const t = texto.trim()
    if (c.tipo === 'texto') {
      if (c.campo === 'nombre' && !t) return   // el nombre es obligatorio
      return actualizarLocal(l.id, { [c.campo]: t || null })
    }
    const n = Number(t.replace(',', '.'))
    if (t && isNaN(n)) return
    actualizarLocal(l.id, { [c.campo]: t ? (c.tipo === 'entero' ? Math.round(n) : n) : null })
  }

  // Un local nuevo hereda del último la unidad funcional, el tablero, la planta, las
  // condiciones y los materiales: en una misma zona se repiten casi siempre.
  const agregar = () => {
    const u = ordenados[ordenados.length - 1]
    agregarLocal(u ? {
      unidad_funcional: u.unidad_funcional, tablero: u.tablero, planta: u.planta,
      cap_personas: u.cap_personas, evacuacion: u.evacuacion, materiales: u.materiales,
      canalizacion: u.canalizacion, conductores: u.conductores,
    } : { tablero: tableros[0]?.tag ?? null })
  }

  return (
    <div className="subcontainer px-4 py-4 flex flex-col gap-3 min-h-dvh">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[16px] font-semibold text-font-a0 m-0">Locales</h1>
          <p className="text-[12px] text-surface-tonal-a40 mt-0.5">
            {proyectoActivo.nombre} · {locales.length} local(es) · {totales.area.toFixed(1)} m² ·{' '}
            {totales.iug} IUG · {totales.tug} TUG · {totales.tue} TUE · {totales.otros} otros
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/memorias/locales" className="rounded-md border border-surface-tonal-a30 px-3 py-1 text-[12px] text-font-a0 no-underline hover:bg-surface-tonal-a10">
            Planilla de Locales →
          </Link>
          <button onClick={agregar} className="rounded-md border border-info-a10 bg-info-a0 px-3 py-1 text-[12px] text-white cursor-pointer hover:opacity-90">
            + Agregar local
          </button>
        </div>
      </div>

      <div className="datatable-container">
        {ordenados.length === 0 ? (
          <p className="px-3.5 py-4 text-[13px] text-surface-tonal-a40">
            Todavía no hay locales cargados. Cada local es un ambiente del proyecto (dormitorio, oficina, nave, sala de
            tableros…) con sus puntos de utilización, sus condiciones de uso y los materiales permitidos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="datatable" style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, width: COLUMNAS.reduce((s, c) => s + c.ancho, 40) }}>
              <thead>
                <tr>
                  {GRUPOS.map(([g, n], i) => <th key={i} colSpan={n} style={{ textAlign: 'center', fontSize: 11 }}>{g}</th>)}
                  <th style={{ width: 40 }} />
                </tr>
                <tr>
                  {COLUMNAS.map(c => <th key={c.campo} title={c.ayuda} style={{ width: c.ancho, textAlign: 'center' }}>{c.titulo}</th>)}
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {ordenados.map(l => (
                  <tr key={l.id}>
                    {COLUMNAS.map(c => (
                      <td key={c.campo} style={{ fontSize: 12, textAlign: c.alinear ?? 'center' }}>
                        <CeldaEditable
                          valor={l[c.campo] != null ? String(l[c.campo]) : ''}
                          align={c.alinear ?? 'center'}
                          onGuardar={v => guardar(l, c, v)}
                        />
                      </td>
                    ))}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => setAEliminar(l)} title="Eliminar local"
                        className="bg-transparent border-none cursor-pointer text-surface-tonal-a40 hover:text-danger-a10 leading-none p-0.5"
                      >
                        <i className="material-icons text-[16px]">delete</i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-surface-tonal-a40 leading-relaxed">
        Clic en una celda para editarla. Las columnas siguen la «Planilla de Locales» de COPAIPA (CTM-002): puntos de
        utilización por tipo, condiciones de utilización (capacidad de las personas BA, evacuación BD, materiales BE) y
        materiales permitidos. Las cantidades de puntos son las del local; la cantidad de bocas o tomas de cada circuito se
        carga aparte, en Cargas.
      </p>

      {aEliminar && (
        <ConfirmModal
          mensaje={`¿Eliminar el local «${aEliminar.nombre}»? No se puede deshacer.`}
          onConfirmar={() => { eliminarLocal(aEliminar.id); setAEliminar(null) }}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </div>
  )
}
