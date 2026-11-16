// Verificación de cortocircuito de UN circuito de un tablero: corrientes de falla en
// el extremo del cable, solicitación térmica del cable y aptitud de la protección.
// Función pura (sin React) para poder testearla con valores calculados a mano —
// antes esta lógica vivía dentro de cortocircuitos/page.tsx.
//
// Modelo: la barra del tablero es una red equivalente con la Icc ya derivada por
// calcularIccTablero; el circuito es el único tramo entre la barra y la falla.
//
// Qué se compara contra qué (y por qué):
//   - Icu ≥ Icc MÁXIMA DE BARRA. El interruptor está montado en la barra: la falla
//     más severa que tiene que cortar es la de sus propios bornes de salida, no la
//     del extremo del cable (que es menor por la impedancia del cable).
//   - Im ≤ I"k MÍNIMA EN EL EXTREMO. Para garantizar el disparo magnético hay que
//     tomar el extremo SUPERIOR de la banda de la curva (ej. curva C: 10·In): entre
//     5 y 10·In el disparo instantáneo no está asegurado.
//   - I"k mínima: falla fase-neutro en el extremo si el circuito lleva neutro (lazo
//     fase + neutro, cada uno con su sección); si no lleva neutro, falla bifásica.
//     Conductores a la temperatura máxima de servicio del cable y c = c_mín
//     (IEC 60909-0 Tabla 1). La falla fase-PE no se evalúa: depende del esquema de
//     conexión a tierra (en TT la limita la resistencia de puesta a tierra y la
//     despeja el diferencial), que la app todavía no modela.
import type { Circuito, Cable } from '@/context/types'
import { calcularProyecto, impedanciaRed, impedanciaConductor, obtenerC, type Conductor, type EntradaProyecto } from '@/utils/cortocircuito'
import { calcReactancia, calcSminCable, seccionEnMm2 } from '@/utils/electricidad'
import { CURVA_MULTIPLICADOR } from '@/utils/protecciones'

export type BarraCC = {
  Icc_max_A: number | null   // I"k3 máxima en la barra
  Icc_min_A: number | null   // I"k3 mínima en la barra
  Un: number | null          // V — tensión de línea de la barra
  U0: number | null          // V — tensión fase-neutro (tension_mono del tablero, o Un/√3)
  frecuencia_hz: 50 | 60
}

export type TipoFallaMin = 'FASE_NEUTRO' | 'BIFASICA'

export type ResultadoCircuitoCC = {
  S_real_mm2:   number | null
  R_cable_mOhm: number | null
  X_cable_mOhm: number | null
  Z1_mOhm:      number | null
  kappa:        number | null
  Ik_kA_max:    number | null
  ip_kA:        number | null
  Ik_kA_min:    number | null
  tipoFallaMin: TipoFallaMin | null
  S_min_002:    number | null
  S_min_02:     number | null
  cable_ok_002: boolean | null
  cable_ok_02:  boolean | null
  Icu_kA:  number | null
  Im_A:    number | null
  Icu_ok:  boolean | null
  Im_ok:   boolean | null
}

const materialDe = (cable: Cable | null): 'COBRE' | 'ALUMINIO' =>
  (cable?.familia?.material ?? '').toLowerCase().includes('alu') ? 'ALUMINIO' : 'COBRE'

// Conductor de retorno de la falla fase-neutro: sección y cantidad en paralelo.
//   - Cable multipolar que ya trae el neutro adentro: su seccion_n, un neutro por cable.
//   - Neutro suelto: el cable de neutro de la formación (o el mismo de fase si no se
//     eligió otro), Nneutro conductores.
// null = el circuito no lleva neutro.
function neutroDe(c: Circuito): { seccion: number; n: number; cable: Cable } | null {
  const f = c.formacion
  if (!f) return null
  if ((f.cable.Nfases ?? 1) > 1 && (f.cable.Nneutro ?? 0) > 0) {
    const S = seccionEnMm2(f.cable.seccion_n ?? f.cable.seccion_f, f.cable.calibre_tipo)
    return S ? { seccion: S, n: f.cond_por_fase || 1, cable: f.cable } : null
  }
  if (f.Nneutro > 0) {
    const cable = f.cable_neutro ?? f.cable
    const S = seccionEnMm2(cable.seccion_f, cable.calibre_tipo)
    return S ? { seccion: S, n: f.Nneutro, cable } : null
  }
  return null
}

export function verificarCircuitoCC(c: Circuito, barra: BarraCC): ResultadoCircuitoCC {
  const cable = c.formacion?.cable ?? null
  const familia = cable?.familia ?? null
  const S_real = cable ? seccionEnMm2(cable.seccion_f, cable.calibre_tipo) : null

  const r: ResultadoCircuitoCC = {
    S_real_mm2: S_real != null && !isNaN(S_real) ? S_real : null,
    R_cable_mOhm: null, X_cable_mOhm: null, Z1_mOhm: null, kappa: null,
    Ik_kA_max: null, ip_kA: null, Ik_kA_min: null, tipoFallaMin: null,
    S_min_002: null, S_min_02: null, cable_ok_002: null, cable_ok_02: null,
    Icu_kA: null, Im_A: null, Icu_ok: null, Im_ok: null,
  }

  let Ith_002_A: number | null = null, Ith_02_A: number | null = null

  if (cable && S_real && c.Largo) {
    // Reactancia propia de la formación (disposición y geometría real del cable).
    // calcReactancia devuelve Ω/km, el motor espera Ω/m; sin dato usa su default.
    const xKm = calcReactancia(cable.diametro, cable.seccion_f, cable.calibre_tipo, c.formacion?.disposicion ?? null, cable.Nfases)
    const conductor: Conductor = {
      id: String(c.id), longitud: c.Largo, seccion: S_real,
      // conductores en paralelo por fase (Formacion.cond_por_fase), no el Nfases del
      // cable (que en un multipolar cuenta núcleos internos).
      n_conductores_por_fase: c.formacion?.cond_por_fase ?? 1,
      material: materialDe(cable),
      reactancia_unitaria: xKm != null ? xKm / 1000 : undefined,
      // Para el escenario MÍNIMO el motor corrige R a esta temperatura (IEC 60909-0:
      // conductor caliente → más resistencia → menos corriente).
      temperatura_servicio: familia?.temperatura ?? undefined,
      nodo_a: 'BARRA', nodo_b: 'FIN',
    }

    try {
      const z = impedanciaConductor(conductor, 'MAXIMO')
      r.R_cable_mOhm = z.Z1.re * 1000
      r.X_cable_mOhm = z.Z1.im * 1000
    } catch { /* datos insuficientes para este circuito puntual */ }

    // ── Máxima: trifásica franca en el extremo, cable a 20 °C ──
    if (barra.Icc_max_A && barra.Un) {
      try {
        const entrada: EntradaProyecto = {
          proyecto: { nombre: 'cortocircuitos', frecuencia_hz: barra.frecuencia_hz },
          red_alimentacion: { id: 'BARRA', nodo: 'BARRA', tension_nominal: barra.Un, corriente_cc: barra.Icc_max_A },
          transformadores: [], generadores: [], motores: [],
          conductores: [conductor],
          puntos_falla: [
            { id: 'F002', nodo: 'FIN', tension_nominal: barra.Un, tipos_falla: ['TRIFASICA'], escenario: 'MAXIMO', duracion_falla: 0.02 },
            { id: 'F02', nodo: 'FIN', tension_nominal: barra.Un, tipos_falla: ['TRIFASICA'], escenario: 'MAXIMO', duracion_falla: 0.2 },
          ],
        }
        const [r002, r02] = calcularProyecto(entrada)
        r.Z1_mOhm = Math.hypot(r002.Z1.re, r002.Z1.im) * 1000
        r.kappa = r002.kappa
        r.Ik_kA_max = r002.corrientes.Ik_inicial_A / 1000
        r.ip_kA = r002.corrientes.ip_A / 1000
        Ith_002_A = r002.corrientes.Ith_A
        Ith_02_A = r02.corrientes.Ith_A
      } catch { /* datos inconsistentes: se deja en blanco, no rompe la tabla */ }
    }

    // ── Mínima: fase-neutro (o bifásica sin neutro) en el extremo, cable caliente ──
    if (barra.Icc_min_A && barra.Un) {
      try {
        const c_min = obtenerC(barra.Un, 'MINIMO')
        // Fuente: se aproxima Z0 = Z1 (misma simplificación documentada del motor),
        // así que en el lazo fase-neutro la fuente aporta (2·Z1 + Z0)/3 = Z1.
        const Zs = impedanciaRed(
          { id: 'BARRA', nodo: 'BARRA', tension_nominal: barra.Un, corriente_cc: barra.Icc_min_A }, 'MINIMO', barra.Un,
        ).Z1
        const Zf = impedanciaConductor(conductor, 'MINIMO').Z1
        const neutro = neutroDe(c)
        if (neutro) {
          const U0 = barra.U0 ?? barra.Un / Math.sqrt(3)
          const Zn = impedanciaConductor({
            ...conductor, seccion: neutro.seccion, n_conductores_por_fase: neutro.n,
            material: materialDe(neutro.cable),
            temperatura_servicio: neutro.cable.familia?.temperatura ?? conductor.temperatura_servicio,
          }, 'MINIMO').Z1
          // I"k1 = c_mín · U0 / |Zs + Z_fase + Z_neutro|
          r.Ik_kA_min = (c_min * U0) / Math.hypot(Zs.re + Zf.re + Zn.re, Zs.im + Zf.im + Zn.im) / 1000
          r.tipoFallaMin = 'FASE_NEUTRO'
        } else {
          // I"k2 = c_mín · Un / (2 · |Z1|), con Z2 = Z1 (IEC 60909-0)
          r.Ik_kA_min = (c_min * barra.Un) / (2 * Math.hypot(Zs.re + Zf.re, Zs.im + Zf.im)) / 1000
          r.tipoFallaMin = 'BIFASICA'
        }
      } catch { /* ídem */ }
    }
  }

  // Solicitación térmica del cable (adiabática) con la falla en el extremo y dos
  // tiempos fijos. Es una verificación orientativa: la rigurosa compara el I²t que
  // deja pasar el dispositivo contra k²S², dato que el catálogo todavía no tiene.
  const mat = familia?.material ?? null, ais = familia?.aislamiento ?? null
  r.S_min_002 = Ith_002_A ? calcSminCable(Ith_002_A, 0.02, mat, ais) : null
  r.S_min_02  = Ith_02_A  ? calcSminCable(Ith_02_A, 0.2, mat, ais) : null
  r.cable_ok_002 = r.S_min_002 != null && S_real != null ? S_real >= r.S_min_002 : null
  r.cable_ok_02  = r.S_min_02  != null && S_real != null ? S_real >= r.S_min_02  : null

  const p = c.proteccion
  r.Icu_kA = p?.Icu ?? null
  r.Icu_ok = r.Icu_kA != null && barra.Icc_max_A != null ? r.Icu_kA >= barra.Icc_max_A / 1000 : null
  const banda = p?.curva ? CURVA_MULTIPLICADOR[p.curva] : null
  r.Im_A = banda && p?.In != null ? banda[1] * p.In : null
  r.Im_ok = r.Im_A != null && r.Ik_kA_min != null ? r.Im_A <= r.Ik_kA_min * 1000 : null

  return r
}
