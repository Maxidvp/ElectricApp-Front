'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useProyectos } from '@/context/ProyectosContext'
import { evaluarProyecto } from '@/utils/verificacionProyecto'
import { leerParametrosSitio, SITIO_DEFAULT } from '@/utils/parametrosSitio'
import type { FormatoFormacion } from '@/utils/electricidad'

// Hoja imprimible común a todos los documentos de /memorias. Se muestra como una hoja
// blanca también en pantalla: lo que se ve es lo que sale impreso (Imprimir → Guardar
// como PDF). Ningún documento calcula nada propio: todos leen evaluarProyecto.

const ESTILOS = `
.mem-fondo { background: var(--clr-surface-a10); padding: 20px 16px 60px; min-height: 100dvh; }
.mem-barra { max-width: 1100px; margin: 0 auto 14px; display: flex; align-items: center; gap: 12px; justify-content: space-between; font-size: 12px; color: var(--clr-surface-tonal-a40); }
.mem-barra a { color: var(--clr-font-a0); text-decoration: none; white-space: nowrap; }
.mem-barra a:hover { text-decoration: underline; }
.mem-btn { background: var(--clr-info-a0); color: #fff; border: 1px solid var(--clr-info-a10); border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.mem-hoja { max-width: 1100px; margin: 0 auto; background: #fff; color: #111; padding: 36px 40px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.45; }
.mem-hoja h1 { font-size: 20px; margin: 0 0 4px; }
.mem-hoja h2 { font-size: 14px; margin: 26px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #111; }
.mem-hoja h3 { font-size: 12px; margin: 16px 0 6px; break-after: avoid; }
.mem-hoja p { margin: 0 0 6px; }
.mem-hoja table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; }
.mem-hoja th, .mem-hoja td { border: 1px solid #999; padding: 3px 5px; text-align: center; vertical-align: middle; }
.mem-hoja th { background: #e9e9e9; font-weight: 700; }
.mem-hoja td.izq, .mem-hoja th.izq { text-align: left; }
.mem-hoja tr.mem-total td { font-weight: 700; background: #f4f4f4; }
.mem-datos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 18px; margin-bottom: 8px; }
.mem-datos span b { font-weight: 700; }
.mem-mal { color: #b00020; font-weight: 700; }
.mem-bien { color: #1b6e1b; }
.mem-nota { color: #555; font-size: 10px; }
.mem-tablero { break-before: page; }
.mem-hoja tr { break-inside: avoid; }
@media print {
  nav, .mem-barra { display: none !important; }
  html, body { background: #fff !important; }
  .mem-fondo { background: #fff; padding: 0; }
  .mem-hoja { max-width: none; padding: 0; }
  @page { size: A4 landscape; margin: 12mm; }
}
`

// Datos que usan todos los documentos.
export function useMemoria() {
  const { tableros, segmentos, proyectoActivo } = useProyectos()
  const [sitio] = useState(() => typeof window === 'undefined' ? SITIO_DEFAULT : leerParametrosSitio())
  const evaluado = useMemo(() => evaluarProyecto(tableros, segmentos, sitio), [tableros, segmentos, sitio])
  const formato = (proyectoActivo?.formato_formacion as FormatoFormacion) ?? 'ingles'
  return { proyectoActivo, evaluado, sitio, formato }
}

export function Hoja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const { proyectoActivo } = useProyectos()
  const [fecha] = useState(() => new Date().toLocaleDateString('es-AR'))
  if (!proyectoActivo) return <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>Sin proyecto activo.</p>

  return (
    <div className="mem-fondo">
      <style>{ESTILOS}</style>
      <div className="mem-barra">
        <Link href="/memorias">← Memorias</Link>
        <span>Vista previa. Para obtener el PDF: Imprimir → Guardar como PDF (A4 apaisado).</span>
        <button className="mem-btn" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
      </div>
      <div className="mem-hoja">
        <h1>{titulo}</h1>
        <p style={{ fontSize: 13 }}><b>{proyectoActivo.nombre}</b>{proyectoActivo.descripcion ? ` — ${proyectoActivo.descripcion}` : ''}</p>
        <p className="mem-nota">Emitida el {fecha} · Generada con ElectricApp</p>
        {children}
      </div>
    </div>
  )
}

export const n = (v: number | null | undefined, d = 2) => v == null || isNaN(v) ? '—' : v.toFixed(d)

export function Veredicto({ v }: { v: boolean | null }) {
  return <span className={v === false ? 'mem-mal' : v === true ? 'mem-bien' : undefined}>{v == null ? '—' : v ? 'Cumple' : 'NO CUMPLE'}</span>
}
