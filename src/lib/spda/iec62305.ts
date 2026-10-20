/**
 * IEC 62305-1 / 62305-3 — parámetros del método de la esfera rodante.
 *
 * El radio de la esfera rodante r depende del Nivel de Protección contra el Rayo
 * (NPR / LPL). También se tabula la corriente de rayo mínima interceptada Imin
 * y la probabilidad de intercepción asociada.
 *
 * Ref.: IEC 62305-1 Tabla 5, IEC 62305-3 Tabla 2.
 */

export type NPR = "I" | "II" | "III" | "IV";

export interface NivelProteccion {
  npr: NPR;
  /** Radio de la esfera rodante en metros. */
  radioEsfera: number;
  /** Corriente de rayo mínima interceptada (kA). */
  corrienteMinima: number;
  /** Probabilidad de que la corriente real sea >= corrienteMinima. */
  probabilidadIntercepcion: number;
  /** Ancho de malla recomendado (m) para el método de malla. */
  anchoMalla: number;
}

export const NIVELES_PROTECCION: Record<NPR, NivelProteccion> = {
  I: { npr: "I", radioEsfera: 20, corrienteMinima: 3, probabilidadIntercepcion: 0.99, anchoMalla: 5 },
  II: { npr: "II", radioEsfera: 30, corrienteMinima: 5, probabilidadIntercepcion: 0.97, anchoMalla: 10 },
  III: { npr: "III", radioEsfera: 45, corrienteMinima: 10, probabilidadIntercepcion: 0.91, anchoMalla: 15 },
  IV: { npr: "IV", radioEsfera: 60, corrienteMinima: 16, probabilidadIntercepcion: 0.84, anchoMalla: 20 },
};

export const NPR_ORDEN: NPR[] = ["I", "II", "III", "IV"];

/**
 * Modelo electrogeométrico (IEC 62305-1 A.1): la distancia de cebado y la
 * corriente de pico se relacionan por r = 10 · I^0.65. Acá solo se usa la
 * inversa (de radio de esfera a corriente), para mostrar a qué corriente
 * mínima equivale el NPR elegido.
 */
export function corrienteDesdeRadio(radioM: number): number {
  return Math.pow(radioM / 10, 1 / 0.65);
}

