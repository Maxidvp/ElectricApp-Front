// Verificación de ampacidad de un circuito — funciones puras (los factores FC/FT/FH
// están en electricidad.ts).
import type { Cable, Circuito, Proteccion } from '@/context/types'
import { calcFC, calcFH, calcFT, contarAgrupamiento } from '@/utils/electricidad'

// ── Corriente admisible del cable según la forma de instalación ────────────────
//
// La corriente admisible de un mismo cable cambia con la forma de instalación
// (en cañería disipa peor que al aire). El catálogo guarda la que da el fabricante
// para cada una; Circuito.metodo_instalacion elige cuál corresponde:
//   conduit_emb / conduit_sup               → Iadm_canio
//   bandeja_perf / bandeja_esc / aire_libre → Iadm_aire
//   enterrado                               → Iadm_enterrado
// Si el cable no tiene cargada la del método (o el circuito no tiene método), se usa
// la `Iadm` genérica y se informa con `generica: true` — no se cambia en silencio.

type CampoIadm = 'Iadm_canio' | 'Iadm_aire' | 'Iadm_enterrado'

const CAMPO_POR_METODO: Record<string, CampoIadm> = {
  conduit_emb: 'Iadm_canio', conduit_sup: 'Iadm_canio',
  bandeja_perf: 'Iadm_aire', bandeja_esc: 'Iadm_aire', aire_libre: 'Iadm_aire',
  enterrado: 'Iadm_enterrado',
}

export const ETIQUETA_IADM: Record<CampoIadm, string> = {
  Iadm_canio: 'en cañería', Iadm_aire: 'al aire / bandeja', Iadm_enterrado: 'enterrado',
}

export type IadmCable = {
  valor: number | null
  generica: boolean           // true = no había dato para el método y se usó Iadm
  campo: CampoIadm | null     // el dato que correspondía al método (aunque falte)
}

type CableIadm = Pick<Cable, 'Iadm' | 'Iadm_canio' | 'Iadm_aire' | 'Iadm_enterrado'>

export function iadmPorMetodo(cable: CableIadm | null | undefined, metodo: string | null): IadmCable {
  const campo = metodo ? (CAMPO_POR_METODO[metodo] ?? null) : null
  if (!cable) return { valor: null, generica: false, campo }
  const propio = campo ? cable[campo] : null
  if (propio != null && propio > 0) return { valor: propio, generica: false, campo }
  return { valor: cable.Iadm ?? null, generica: true, campo }
}

// ── Coordinación cable–protección contra sobrecarga ────────────────────────────
//
//   Ib ≤ In ≤ Iz
//
// Ib = corriente de diseño del circuito, In = corriente nominal (o de regulación) de
// la protección, Iz = corriente admisible del cable ya corregida (Iadm × FH × FC × FT).
//   - In < Ib: la protección dispara en servicio normal.
//   - In > Iz: el cable puede sobrecargarse sin que la protección lo vea.
//
// La segunda condición de la norma (I2 ≤ 1,45·Iz, con I2 = corriente convencional de
// disparo) no se evalúa aparte: el catálogo no guarda I2.
//
// Guardamotor: no tiene In fija sino un rango de regulación. Cumple si existe algún
// ajuste Ir dentro del rango con Ib ≤ Ir ≤ Iz, es decir si el rango y [Ib, Iz] se
// solapan; se informa el intervalo de ajuste válido.
// Diferencial: no protege contra sobrecarga, no aplica.

export type EstadoCoordinacion =
  | 'ok'
  | 'dispara_en_servicio'   // In < Ib
  | 'cable_desprotegido'    // In > Iz
  | 'sin_datos'
  | 'no_aplica'

export type Coordinacion = {
  estado: EstadoCoordinacion
  In: number | null                       // nominal fija, o null si es regulable
  ajuste: [number, number] | null         // guardamotor: rango de regulación válido
  detalle: string
}

type ProteccionCoord = Pick<Proteccion, 'In' | 'rango_regulacion_min' | 'rango_regulacion_max'> & { familia?: { tipo: string } | null }

const fmt = (n: number) => n.toFixed(1)

export function coordinarProteccion(Ib: number | null, Iz: number | null, p: ProteccionCoord | null | undefined): Coordinacion {
  if (!p) return { estado: 'sin_datos', In: null, ajuste: null, detalle: 'Sin protección asignada' }
  const tipo = p.familia?.tipo ?? ''
  if (tipo === 'diferencial')
    return { estado: 'no_aplica', In: p.In ?? null, ajuste: null, detalle: 'Un diferencial no protege contra sobrecarga' }
  if (tipo === 'seccionador')
    return { estado: 'no_aplica', In: p.In ?? null, ajuste: null, detalle: 'Un interruptor-seccionador no protege contra sobrecarga' }
  if (Ib == null || Iz == null)
    return { estado: 'sin_datos', In: p.In ?? null, ajuste: null, detalle: 'Falta la corriente de diseño o la admisible del cable' }
  if (Ib > Iz)
    return { estado: 'cable_desprotegido', In: p.In ?? null, ajuste: null, detalle: `No hay In posible: Ib ${fmt(Ib)} A > Iz ${fmt(Iz)} A` }

  if (tipo === 'guardamotor') {
    const min = p.rango_regulacion_min, max = p.rango_regulacion_max
    if (min == null || max == null) return { estado: 'sin_datos', In: null, ajuste: null, detalle: 'Guardamotor sin rango de regulación cargado' }
    if (max < Ib) return { estado: 'dispara_en_servicio', In: null, ajuste: null, detalle: `Regulación máxima ${fmt(max)} A < Ib ${fmt(Ib)} A` }
    if (min > Iz) return { estado: 'cable_desprotegido', In: null, ajuste: null, detalle: `Regulación mínima ${fmt(min)} A > Iz ${fmt(Iz)} A` }
    const ajuste: [number, number] = [Math.max(min, Ib), Math.min(max, Iz)]
    return { estado: 'ok', In: null, ajuste, detalle: `Regular entre ${fmt(ajuste[0])} y ${fmt(ajuste[1])} A` }
  }

  const In = p.In
  if (In == null) return { estado: 'sin_datos', In: null, ajuste: null, detalle: 'Protección sin In cargada' }
  if (In < Ib) return { estado: 'dispara_en_servicio', In, ajuste: null, detalle: `In ${fmt(In)} A < Ib ${fmt(Ib)} A: dispara en servicio normal` }
  if (In > Iz) return { estado: 'cable_desprotegido', In, ajuste: null, detalle: `In ${fmt(In)} A > Iz ${fmt(Iz)} A: el cable queda sin protección de sobrecarga` }
  return { estado: 'ok', In, ajuste: null, detalle: `Ib ${fmt(Ib)} A ≤ In ${fmt(In)} A ≤ Iz ${fmt(Iz)} A` }
}

// ── Verificación completa de ampacidad de un circuito ──────────────────────────
//
// Iz = Iadm(método) × conductores por fase × FH × FC × FT, y se compara con la
// corriente de diseño Ib. FC/FT: el valor manual del circuito pisa al sugerido; sin
// ninguno de los dos se usa 1.

export type ParametrosSitio = {
  altitud: number               // m.s.n.m.
  tempAmbiente: number | null   // °C
}

export type AmpacidadCircuito = {
  metodo:     string
  iadm:       number | null     // Iadm del cable × conductores en paralelo por fase
  iadmAviso:  string | null     // se usó la Iadm genérica porque falta la del método
  fh:         number
  fcManual:   number | null
  ftManual:   number | null
  fcAuto:     number | null
  ftAuto:     number | null
  nAgrupados: number | null
  fcEfectivo: number
  ftEfectivo: number
  iadm_corr:  number | null     // Iz
  cumple:     boolean | null    // Iz ≥ Ib
  coord:      Coordinacion
}

type SegmentoAgrup = { tipo: string; circuitos: { id: number }[] }

export function evaluarAmpacidad(
  c: Circuito, corriente: number | null, segmentos: SegmentoAgrup[], sitio: ParametrosSitio,
): AmpacidadCircuito {
  const metodo = c.metodo_instalacion ?? ''
  const formacion = c.formacion

  const iadmCable = iadmPorMetodo(formacion?.cable, metodo || null)
  // Con N conductores en paralelo por fase cada uno lleva I/N: la capacidad total
  // se multiplica por N.
  const iadm = iadmCable.valor !== null ? iadmCable.valor * (formacion?.cond_por_fase ?? 1) : null
  // No se cambia de dato en silencio: si el cable no tiene la Iadm del método
  // elegido se usa la genérica y se avisa.
  const iadmAviso = iadmCable.valor !== null && iadmCable.generica && iadmCable.campo
    ? `El cable no tiene cargada la Iadm ${ETIQUETA_IADM[iadmCable.campo]}: se usó la Iadm genérica del catálogo`
    : null

  const fh = calcFH(sitio.altitud)
  const fcManual = c.fc_manual ?? null
  const ftManual = c.ft_manual ?? null
  const nAgrupados = contarAgrupamiento(c.id, segmentos)
  const fcAuto = calcFC(metodo || null, nAgrupados)
  const ftAuto = calcFT(sitio.tempAmbiente, formacion?.cable?.familia?.temperatura ?? null, metodo || null)
  const fcEfectivo = fcManual ?? fcAuto ?? 1
  const ftEfectivo = ftManual ?? ftAuto ?? 1

  const iadm_corr = iadm !== null ? iadm * fh * fcEfectivo * ftEfectivo : null
  const cumple = iadm_corr !== null && corriente !== null ? iadm_corr >= corriente : null

  return {
    metodo, iadm, iadmAviso, fh, fcManual, ftManual, fcAuto, ftAuto, nAgrupados, fcEfectivo, ftEfectivo,
    iadm_corr, cumple, coord: coordinarProteccion(corriente, iadm_corr, c.proteccion),
  }
}
