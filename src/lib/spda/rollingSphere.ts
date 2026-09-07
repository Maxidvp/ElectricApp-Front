/**
 * Método de la esfera rodante (IEC 62305-3, Anexo A).
 *
 * Idea: una esfera de radio r (según NPR) rueda sobre el sistema de captación
 * (mástiles, conductores) y sobre el plano de tierra sin penetrarlos. Todo punto
 * que la esfera *puede tocar* es susceptible de impacto directo; todo punto que
 * la esfera *no puede alcanzar* está protegido.
 *
 * Formulación discreta que usamos:
 *   Un punto P está EXPUESTO si existe un centro de esfera C con |C − P| = r tal
 *   que C no penetra ningún elemento captador ni el suelo, es decir
 *   distanciaASistema(C) >= r.  Si toda esfera que toca P penetra el SEP, P está
 *   PROTEGIDO.
 *
 *   scoreExposicion(P) = max sobre direcciones d de  distanciaASistema(P + r·d)
 *   margenProteccion(P) = r − scoreExposicion(P)      ( >0 protegido, <=0 expuesto )
 */

import {
  distanciaASistema,
  segmentosDeCaptacion,
  type SegmentoCaptador,
  type SistemaCaptacion,
  type Vec3,
} from "./geometry";

export interface ConfigCalculo {
  /** Radio de la esfera rodante (m). */
  radio: number;
  /** Nº de direcciones muestreadas alrededor de cada punto. */
  direcciones: number;
  /** Pasos de refinamiento local sobre la mejor dirección. */
  refinamiento: number;
  /** z mínimo permitido para el centro de la esfera (viene "del cielo"). */
  cotaTierra: number | null;
}

export const CONFIG_POR_DEFECTO: Omit<ConfigCalculo, "radio" | "cotaTierra"> = {
  direcciones: 320,
  refinamiento: 12,
};

export interface ResultadoPunto {
  punto: Vec3;
  /** r − scoreExposicion. >0 protegido, <=0 expuesto. */
  margen: number;
  protegido: boolean;
  /** Elemento captador que "domina" la protección de este punto, si aplica. */
  elementoDominante: string | null;
}

/**
 * Direcciones sobre una semiesfera superior ampliada (permite un poco de
 * componente hacia abajo para modelar la esfera apoyada lateralmente).
 * Distribución de Fibonacci para cobertura uniforme.
 */
export function direccionesFibonacci(n: number, zMin = -0.25): Vec3[] {
  const dirs: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = 1 - (i / (n - 1)) * (1 - zMin);
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const theta = golden * i;
    dirs.push([Math.cos(theta) * r, Math.sin(theta) * r, z]);
  }
  return dirs;
}

const DIRS_CACHE = new Map<string, Vec3[]>();
function dirsFor(n: number): Vec3[] {
  const key = String(n);
  let d = DIRS_CACHE.get(key);
  if (!d) {
    d = direccionesFibonacci(n);
    DIRS_CACHE.set(key, d);
  }
  return d;
}

function scoreParaDireccion(
  p: Vec3,
  dir: Vec3,
  radio: number,
  segs: SegmentoCaptador[],
  cotaTierra: number | null,
): { score: number; elementoId: string | null } {
  const c: Vec3 = [p[0] + dir[0] * radio, p[1] + dir[1] * radio, p[2] + dir[2] * radio];
  // La esfera llega desde arriba: su centro no puede quedar bajo tierra.
  if (cotaTierra != null && c[2] < cotaTierra) {
    return { score: -Infinity, elementoId: null };
  }
  const { dist, elementoId } = distanciaASistema(c, segs, cotaTierra);
  return { score: dist, elementoId };
}

/** Evalúa un único punto contra el sistema de captación. */
export function evaluarPunto(
  p: Vec3,
  segs: SegmentoCaptador[],
  cfg: ConfigCalculo,
): ResultadoPunto {
  const dirs = dirsFor(cfg.direcciones);
  let mejor = -Infinity;
  let mejorDir: Vec3 = [0, 0, 1];
  let elementoDominante: string | null = null;

  for (const d of dirs) {
    const { score, elementoId } = scoreParaDireccion(p, d, cfg.radio, segs, cfg.cotaTierra);
    if (score > mejor) {
      mejor = score;
      mejorDir = d;
      elementoDominante = elementoId;
    }
  }

  // Refinamiento local: perturba la mejor dirección buscando aumentar el score
  // (peor caso de exposición). Descenso de coordenadas simple.
  let paso = 0.35;
  for (let it = 0; it < cfg.refinamiento; it++) {
    let mejoró = false;
    for (const eje of [0, 1, 2] as const) {
      for (const signo of [1, -1] as const) {
        const cand: Vec3 = [mejorDir[0], mejorDir[1], mejorDir[2]];
        (cand as unknown as number[])[eje] += signo * paso;
        const l = Math.hypot(cand[0], cand[1], cand[2]) || 1;
        const dn: Vec3 = [cand[0] / l, cand[1] / l, cand[2] / l];
        const { score, elementoId } = scoreParaDireccion(p, dn, cfg.radio, segs, cfg.cotaTierra);
        if (score > mejor) {
          mejor = score;
          mejorDir = dn;
          elementoDominante = elementoId;
          mejoró = true;
        }
      }
    }
    if (!mejoró) paso *= 0.5;
  }

  const margen = cfg.radio - mejor;
  return {
    punto: p,
    margen,
    protegido: margen > 0,
    elementoDominante: margen > 0 ? elementoDominante : null,
  };
}

export interface ResultadoModelo {
  puntos: ResultadoPunto[];
  total: number;
  expuestos: number;
  cobertura: number; // fracción protegida 0..1
  margenMinimo: number;
  radio: number;
}

/** Evalúa una nube de puntos (vértices del modelo cargado). */
export function evaluarModelo(
  puntos: Vec3[],
  sistema: SistemaCaptacion,
  cfg: ConfigCalculo,
  onProgress?: (frac: number) => void,
): ResultadoModelo {
  const segs = segmentosDeCaptacion(sistema);
  const res: ResultadoPunto[] = [];
  let expuestos = 0;
  let margenMinimo = Infinity;

  for (let i = 0; i < puntos.length; i++) {
    const r = evaluarPunto(puntos[i], segs, cfg);
    res.push(r);
    if (!r.protegido) expuestos++;
    if (r.margen < margenMinimo) margenMinimo = r.margen;
    if (onProgress && (i % 64 === 0 || i === puntos.length - 1)) {
      onProgress((i + 1) / puntos.length);
    }
  }

  return {
    puntos: res,
    total: puntos.length,
    expuestos,
    cobertura: puntos.length ? 1 - expuestos / puntos.length : 1,
    margenMinimo: margenMinimo === Infinity ? 0 : margenMinimo + 0, // normaliza -0

    radio: cfg.radio,
  };
}

/**
 * Campo escalar f(x,y,z) = r − scoreExposicion, para extraer la envolvente de
 * protección (isosuperficie f = 0) con marching cubes.
 */
export function campoEscalar(
  bounds: { min: Vec3; max: Vec3 },
  dims: readonly [number, number, number],
  sistema: SistemaCaptacion,
  cfg: ConfigCalculo,
  onProgress?: (frac: number) => void,
): Float32Array {
  const segs = segmentosDeCaptacion(sistema);
  const [nx, ny, nz] = dims;
  const field = new Float32Array(nx * ny * nz);
  const sx = (bounds.max[0] - bounds.min[0]) / (nx - 1);
  const sy = (bounds.max[1] - bounds.min[1]) / (ny - 1);
  const sz = (bounds.max[2] - bounds.min[2]) / (nz - 1);
  const dirs = dirsFor(cfg.direcciones);

  let idx = 0;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const p: Vec3 = [
          bounds.min[0] + i * sx,
          bounds.min[1] + j * sy,
          bounds.min[2] + k * sz,
        ];
        let mejor = -Infinity;
        for (const d of dirs) {
          const { score } = scoreParaDireccion(p, d, cfg.radio, segs, cfg.cotaTierra);
          if (score > mejor) mejor = score;
        }
        field[idx++] = cfg.radio - mejor;
      }
    }
    if (onProgress) onProgress((k + 1) / nz);
  }
  return field;
}

// ---------------------------------------------------------------------------
// Zona protegida por una punta captadora aislada (construcción geométrica)
// ---------------------------------------------------------------------------

/**
 * Radio, a nivel del pie de la punta, de la zona protegida por una punta
 * captadora vertical aislada de altura `altura`, por el método de la esfera
 * rodante: rp = √(2·r·h − h²) para h ≤ r, y rp = r para h ≥ r
 * (la esfera apoyada en el suelo toca la punta como mucho a la altura r).
 */
export function radioProteccionSuelo(radio: number, altura: number): number {
  const h = Math.max(0, altura);
  if (h >= radio) return radio;
  return Math.sqrt(2 * radio * h - h * h);
}

/**
 * Perfil (radio, altura) del borde de la zona protegida por una punta aislada:
 * tramo sobre el eje hasta la altura efectiva (mín(h, r)) y arco de la esfera
 * rodante hasta tocar el suelo a `radioProteccionSuelo`. Apto para revolución
 * (LatheGeometry en 3D) o para dibujar el contorno en 2D.
 *
 * Exacto solo para una punta aislada sobre suelo plano y sin otras estructuras;
 * el caso general lo da la envolvente global (`campoEscalar` + marching cubes).
 */
/**
 * Datos exactos del arco (círculo de radio `radio`, centro a (rp, radio) en
 * coordenadas (r, z)) entre la punta efectiva y el borde en el suelo: el
 * ángulo de inicio/fin y un punto interior, listos para definir el arco con
 * solo 3 puntos (p. ej. en un exportador CAD, sin discretizar).
 */
export function arcoZonaPunta(radio: number, altura: number) {
  const hEff = Math.max(1e-3, Math.min(altura, radio));
  const rp = radioProteccionSuelo(radio, altura);
  const cz = radio; // altura del centro de la esfera apoyada en el suelo
  const aPunta = Math.atan2(hEff - cz, -rp);
  const aSuelo = -Math.PI / 2;
  const aMedio = (aPunta + aSuelo) / 2;
  return {
    hEff,
    rp,
    inicio: { r: 0, z: hEff },
    fin: { r: rp, z: 0 },
    medio: {
      r: rp + radio * Math.cos(aMedio),
      z: Math.max(0, cz + radio * Math.sin(aMedio)),
    },
    aPunta,
    aSuelo,
  };
}

/**
 * Perfil (radio, altura) del borde de la zona protegida por una punta aislada:
 * tramo sobre el eje hasta la altura efectiva (mín(h, r)) y arco de la esfera
 * rodante hasta tocar el suelo a `radioProteccionSuelo`. Apto para revolución
 * (LatheGeometry en 3D) o para dibujar el contorno en 2D.
 *
 * Exacto solo para una punta aislada sobre suelo plano y sin otras estructuras;
 * el caso general lo da la envolvente global (`campoEscalar` + marching cubes).
 */
export function perfilZonaPunta(
  radio: number,
  altura: number,
  segmentos = 28,
): { r: number; z: number }[] {
  const { hEff, rp, aPunta, aSuelo } = arcoZonaPunta(radio, altura);
  const cz = radio;
  const perfil: { r: number; z: number }[] = [
    { r: 0, z: 0 },
    { r: 0, z: hEff },
  ];
  for (let i = 1; i <= segmentos; i++) {
    const a = aPunta + (aSuelo - aPunta) * (i / segmentos);
    perfil.push({
      r: Math.max(0, rp + radio * Math.cos(a)),
      z: Math.max(0, cz + radio * Math.sin(a)),
    });
  }
  return perfil;
}
