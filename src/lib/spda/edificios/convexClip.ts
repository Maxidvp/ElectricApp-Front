/**
 * Delimitación de edificios por intersección de semiespacios: cada cara que el
 * usuario clickea sobre la malla de referencia define un plano (punto + normal
 * saliente); el volumen del edificio es la intersección de los semiespacios
 * "hacia adentro" de cada plano — un poliedro CONVEXO por construcción (ver
 * memoria del proyecto: por eso "Delimitar edificio" soporta varias piezas
 * convexas por edificio, para plantas en L/U/T).
 *
 * Algoritmo: arrancar de una caja grande (`cajaInicial`, cubre de sobra el
 * sitio importado) e ir recortándola contra cada plano (`recortarPoliedro`),
 * una variante 3D de Sutherland-Hodgman. Cada corte parcial de una cara genera
 * un segmento en el plano de corte; encadenar esos segmentos por POSICIÓN
 * (no por índice — dos caras vecinas generan cada una su propio vértice nuevo
 * en la misma arista compartida) arma el polígono de la nueva cara expuesta.
 */
import type { Vec3 } from "../geometry";

/** Plano de corte: se conserva el lado `dot(normal, x - punto) <= 0` ("adentro"). */
export interface Plano {
  punto: Vec3;
  normal: Vec3;
}

/** Poliedro convexo como lista de caras planas (polígonos, índices en orden). */
export interface Poliedro {
  vertices: Vec3[];
  caras: number[][];
}

const EPS = 1e-4; // metros — tolerancia para clasificar dentro/fuera de un plano
const EPS_MATCH = 1e-4; // metros — tolerancia para reconocer el mismo punto de corte entre caras vecinas

function resta(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function suma(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function escala(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function distanciaAPlano(p: Plano, v: Vec3): number {
  return dot(p.normal, resta(v, p.punto));
}
function cercano(a: Vec3, b: Vec3): boolean {
  return Math.abs(a[0] - b[0]) < EPS_MATCH && Math.abs(a[1] - b[1]) < EPS_MATCH && Math.abs(a[2] - b[2]) < EPS_MATCH;
}

/** Normal de un polígono plano por el método de Newell (no depende de que sea un triángulo). */
function normalDeCara(vertices: Vec3[], cara: number[]): Vec3 {
  let nx = 0,
    ny = 0,
    nz = 0;
  for (let i = 0; i < cara.length; i++) {
    const a = vertices[cara[i]];
    const b = vertices[cara[(i + 1) % cara.length]];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/**
 * Caja de arranque para el recorte: cubre `min..max` (el sitio importado, ya
 * con margen). Se auto-corrige el sentido de cada cara (comparando contra el
 * centro de la caja) para no depender de haber tabulado a mano el winding
 * correcto de cada una.
 */
export function cajaInicial(min: Vec3, max: Vec3): Poliedro {
  const vertices: Vec3[] = [
    [min[0], min[1], min[2]],
    [max[0], min[1], min[2]],
    [max[0], max[1], min[2]],
    [min[0], max[1], min[2]],
    [min[0], min[1], max[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], max[2]],
    [min[0], max[1], max[2]],
  ];
  const centro: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const carasBase = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];
  const caras = carasBase.map((cara) => {
    const n = normalDeCara(vertices, cara);
    let cx = 0,
      cy = 0,
      cz = 0;
    for (const i of cara) {
      cx += vertices[i][0];
      cy += vertices[i][1];
      cz += vertices[i][2];
    }
    const centroCara: Vec3 = [cx / cara.length, cy / cara.length, cz / cara.length];
    return dot(n, resta(centroCara, centro)) < 0 ? [...cara].reverse() : cara;
  });
  return { vertices, caras };
}

/** Recorta `poli` contra un plano. Devuelve `null` si el resultado queda vacío o degenerado. */
export function recortarPoliedro(poli: Poliedro, plano: Plano): Poliedro | null {
  const { vertices, caras } = poli;
  const dist = vertices.map((v) => distanciaAPlano(plano, v));

  if (dist.every((d) => d > EPS)) return null; // todo afuera
  if (dist.every((d) => d <= EPS)) return poli; // todo adentro, sin cambios

  const nuevosVertices: Vec3[] = [...vertices];
  const nuevasCaras: number[][] = [];
  const segmentosCorte: [number, number][] = []; // [entrada, salida] por cara cortada

  for (const cara of caras) {
    const n = cara.length;
    const dentro = cara.map((i) => dist[i] <= EPS);
    if (dentro.every(Boolean)) {
      nuevasCaras.push(cara);
      continue;
    }
    if (dentro.every((x) => !x)) continue; // toda afuera, se descarta

    const nuevaCara: number[] = [];
    let entrada: number | null = null;
    let salida: number | null = null;
    for (let i = 0; i < n; i++) {
      const ia = cara[i];
      const ib = cara[(i + 1) % n];
      const da = dist[ia];
      const db = dist[ib];
      const aDentro = da <= EPS;
      const bDentro = db <= EPS;
      if (aDentro) nuevaCara.push(ia);
      if (aDentro !== bDentro) {
        const t = da / (da - db);
        const p = suma(vertices[ia], escala(resta(vertices[ib], vertices[ia]), t));
        const idx = nuevosVertices.length;
        nuevosVertices.push(p);
        nuevaCara.push(idx);
        if (aDentro) salida = idx;
        else entrada = idx;
      }
    }
    if (nuevaCara.length >= 3) nuevasCaras.push(nuevaCara);
    if (entrada != null && salida != null) segmentosCorte.push([entrada, salida]);
  }

  if (segmentosCorte.length < 3) return null; // no alcanza a cerrar un polígono de corte válido

  // Encadenar los segmentos de corte en un anillo, matcheando por POSICIÓN.
  const usados = new Array(segmentosCorte.length).fill(false);
  const anillo: number[] = [segmentosCorte[0][0]];
  usados[0] = true;
  let siguientePunto = segmentosCorte[0][1];
  for (let k = 1; k < segmentosCorte.length; k++) {
    anillo.push(siguientePunto);
    let encontrado = -1;
    for (let j = 0; j < segmentosCorte.length; j++) {
      if (usados[j]) continue;
      if (cercano(nuevosVertices[segmentosCorte[j][0]], nuevosVertices[siguientePunto])) {
        encontrado = j;
        break;
      }
    }
    if (encontrado === -1) return null; // corte degenerado — no cerró un anillo simple
    usados[encontrado] = true;
    siguientePunto = segmentosCorte[encontrado][1];
  }
  if (!cercano(nuevosVertices[siguientePunto], nuevosVertices[anillo[0]])) return null;

  nuevasCaras.push(anillo);
  return { vertices: nuevosVertices, caras: nuevasCaras };
}

/** Aplica una lista de planos, en orden, sobre una caja inicial. `null` si el resultado queda vacío. */
export function poliedroDesdePlanos(planos: Plano[], bbox: { min: Vec3; max: Vec3 }): Poliedro | null {
  let poli: Poliedro | null = cajaInicial(bbox.min, bbox.max);
  for (const plano of planos) {
    if (!poli) return null;
    poli = recortarPoliedro(poli, plano);
  }
  return poli;
}

/** Triangula (fan por cara, válido porque cada cara es un polígono convexo) para render/guardado. */
export function poliedroAMalla(p: Poliedro): { positions: Float32Array; indices: Uint32Array } {
  const positions = new Float32Array(p.vertices.length * 3);
  p.vertices.forEach((v, i) => {
    positions[i * 3] = v[0];
    positions[i * 3 + 1] = v[1];
    positions[i * 3 + 2] = v[2];
  });
  const idx: number[] = [];
  for (const cara of p.caras) {
    for (let i = 1; i < cara.length - 1; i++) idx.push(cara[0], cara[i], cara[i + 1]);
  }
  return { positions, indices: Uint32Array.from(idx) };
}
