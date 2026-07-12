// Validaciones obligatorias — spec §10.
// Las validaciones que dependen de una fórmula puntual (uRr < ukr, Z1 != 0, etc.)
// se hacen en el lugar donde se usan (elementos.ts, red.ts, motor.ts) para poder
// dar un mensaje de error específico. Acá van las validaciones generales de entrada.
import type { EntradaProyecto } from './tipos'

export function validarEntrada(entrada: EntradaProyecto): void {
  const errores: string[] = []

  const red = entrada.red_alimentacion
  if (red.tension_nominal <= 0) errores.push(`Red "${red.id}": tension_nominal debe ser > 0`)
  const tieneS = red.potencia_cc != null
  const tieneI = red.corriente_cc != null
  if (tieneS === tieneI) errores.push(`Red "${red.id}": debe venir exactamente uno de potencia_cc / corriente_cc`)
  if (tieneS && red.potencia_cc! <= 0) errores.push(`Red "${red.id}": potencia_cc debe ser > 0`)

  for (const t of entrada.transformadores) {
    if (t.potencia_nominal <= 0) errores.push(`Transformador "${t.id}": potencia_nominal debe ser > 0`)
    if (!(t.ukr_porcentaje > 0 && t.ukr_porcentaje < 100)) errores.push(`Transformador "${t.id}": ukr_porcentaje debe estar entre 0 y 100`)
    if (t.perdidas_cobre == null && t.uRr_porcentaje == null) errores.push(`Transformador "${t.id}": falta perdidas_cobre o uRr_porcentaje`)
  }

  for (const g of entrada.generadores) {
    if (g.potencia_nominal <= 0) errores.push(`Generador "${g.id}": potencia_nominal debe ser > 0`)
    if (!(g.factor_potencia > 0 && g.factor_potencia <= 1)) errores.push(`Generador "${g.id}": factor_potencia debe estar en (0, 1]`)
  }

  for (const cnd of entrada.conductores) {
    if (cnd.longitud <= 0) errores.push(`Conductor "${cnd.id}": longitud debe ser > 0`)
    if (cnd.seccion <= 0) errores.push(`Conductor "${cnd.id}": seccion debe ser > 0`)
  }

  for (const m of entrada.motores) {
    if (m.potencia_nominal <= 0) errores.push(`Motor "${m.id}": potencia_nominal debe ser > 0`)
    if (m.ilr_sobre_ir < 1) errores.push(`Motor "${m.id}": ilr_sobre_ir debe ser >= 1`)
  }

  if (entrada.puntos_falla.length === 0) errores.push('No hay puntos de falla definidos')
  for (const p of entrada.puntos_falla) {
    if (p.tension_nominal <= 0) errores.push(`Punto de falla "${p.id}": tension_nominal debe ser > 0`)
    if (p.tipos_falla.length === 0) errores.push(`Punto de falla "${p.id}": tipos_falla no puede estar vacío`)
  }

  if (errores.length > 0) throw new Error(`Entrada inválida:\n- ${errores.join('\n- ')}`)
}
