/**
 * Primitivas geométricas y utilidades de distancia usadas por el método de la
 * esfera rodante. Coordenadas en metros, eje Z vertical (Z = 0 → nivel del suelo).
 */

export type Vec3 = readonly [number, number, number];

export const v = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a: Vec3): number => Math.hypot(a[0], a[1], a[2]),
  dist: (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  normalize: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  cross: (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
};

/** Distancia de un punto p a un segmento [a, b]. */
export function distPointSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = v.sub(b, a);
  const t0 = v.dot(v.sub(p, a), ab);
  const len2 = v.dot(ab, ab);
  const t = len2 <= 1e-12 ? 0 : Math.min(1, Math.max(0, t0 / len2));
  const proj = v.add(a, v.scale(ab, t));
  return v.dist(p, proj);
}

/** Distancia de un punto p a una polilínea (lista de vértices). */
export function distPointPolyline(p: Vec3, pts: Vec3[]): number {
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) return v.dist(p, pts[0]);
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, distPointSegment(p, pts[i], pts[i + 1]));
  }
  return d;
}

// ---------------------------------------------------------------------------
// Elementos del Sistema Externo de Protección (captación) + entorno
// ---------------------------------------------------------------------------

export type ElementoCaptacionTipo = "mastil" | "conductor" | "malla";

/** Mástil / punta captadora vertical: base + altura. */
export interface Mastil {
  id: string;
  tipo: "mastil";
  base: Vec3;
  altura: number;
}

/** Conductor aéreo / cable de guarda / cordón de malla: polilínea 3D. */
export interface Conductor {
  id: string;
  tipo: "conductor";
  puntos: Vec3[];
}

export type ElementoCaptacion = Mastil | Conductor;

/** Conjunto de elementos que "capturan" el rayo, más el plano de tierra. */
export interface SistemaCaptacion {
  elementos: ElementoCaptacion[];
  /** Cota del plano de tierra (normalmente 0). null → sin plano de tierra. */
  cotaTierra: number | null;
}

/** Segmentos que representan a cada elemento captador para el cálculo de distancias. */
export interface SegmentoCaptador {
  a: Vec3;
  b: Vec3;
  elementoId: string;
}

export function segmentosDeCaptacion(sistema: SistemaCaptacion): SegmentoCaptador[] {
  const segs: SegmentoCaptador[] = [];
  for (const el of sistema.elementos) {
    if (el.tipo === "mastil") {
      segs.push({
        a: el.base,
        b: [el.base[0], el.base[1], el.base[2] + el.altura],
        elementoId: el.id,
      });
    } else {
      for (let i = 0; i < el.puntos.length - 1; i++) {
        segs.push({ a: el.puntos[i], b: el.puntos[i + 1], elementoId: el.id });
      }
    }
  }
  return segs;
}

/**
 * Distancia mínima de un punto c (centro de esfera candidato) al sistema de
 * captación: mínimo entre todos los segmentos captadores y el plano de tierra.
 * Devuelve también qué elemento fue el más cercano (para diagnóstico).
 */
export function distanciaASistema(
  c: Vec3,
  segs: SegmentoCaptador[],
  cotaTierra: number | null,
): { dist: number; elementoId: string | null } {
  let best = Infinity;
  let id: string | null = null;
  for (const s of segs) {
    const d = distPointSegment(c, s.a, s.b);
    if (d < best) {
      best = d;
      id = s.elementoId;
    }
  }
  if (cotaTierra != null) {
    const d = Math.abs(c[2] - cotaTierra);
    if (d < best) {
      best = d;
      id = "__tierra__";
    }
  }
  return { dist: best, elementoId: id };
}
