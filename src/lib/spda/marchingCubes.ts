/**
 * Marching Cubes mínimo para extraer la isosuperficie de un campo escalar 3D.
 * Basado en las tablas clásicas de Paul Bourke (dominio público).
 *
 * field: valores en una grilla regular nx·ny·nz, índice = i + nx*(j + ny*k).
 * Devuelve posiciones (x,y,z por vértice) e índices de triángulos.
 */

import type { Vec3 } from "./geometry";
import { TRI_TABLE } from "./marchingCubesTables";

/** Máscara de 12 bits de aristas usadas por cada caso, derivada de TRI_TABLE. */
const EDGE_TABLE: readonly number[] = TRI_TABLE.map((tri) => {
  let mask = 0;
  for (let t = 0; tri[t] !== -1; t++) mask |= 1 << tri[t];
  return mask;
});

export interface MallaISO {
  positions: Float32Array;
  indices: Uint32Array;
}

const CORNER_OFFSET: readonly Vec3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];

const EDGE_CORNERS: readonly [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export function marchingCubes(
  field: Float32Array,
  dims: readonly [number, number, number],
  bounds: { min: Vec3; max: Vec3 },
  iso = 0,
): MallaISO {
  const [nx, ny, nz] = dims;
  const sx = (bounds.max[0] - bounds.min[0]) / (nx - 1);
  const sy = (bounds.max[1] - bounds.min[1]) / (ny - 1);
  const sz = (bounds.max[2] - bounds.min[2]) / (nz - 1);
  const at = (i: number, j: number, k: number) => field[i + nx * (j + ny * k)];

  const positions: number[] = [];
  const indices: number[] = [];
  const vertCache = new Map<string, number>();
  const cornerVal = new Float32Array(8);

  const lerpVert = (
    edge: number,
    ci: number, cj: number, ck: number,
  ): number => {
    const [ca, cb] = EDGE_CORNERS[edge];
    const oa = CORNER_OFFSET[ca];
    const ob = CORNER_OFFSET[cb];
    const ax = ci + oa[0], ay = cj + oa[1], az = ck + oa[2];
    const bx = ci + ob[0], by = cj + ob[1], bz = ck + ob[2];
    const key = `${Math.min(ax + nx * (ay + ny * az), bx + nx * (by + ny * bz))}_${Math.max(
      ax + nx * (ay + ny * az),
      bx + nx * (by + ny * bz),
    )}`;
    const cached = vertCache.get(key);
    if (cached !== undefined) return cached;

    const va = cornerVal[ca];
    const vb = cornerVal[cb];
    let t = (iso - va) / (vb - va);
    if (!isFinite(t)) t = 0.5;
    t = Math.min(1, Math.max(0, t));

    const x = bounds.min[0] + (ax + (bx - ax) * t) * sx;
    const y = bounds.min[1] + (ay + (by - ay) * t) * sy;
    const z = bounds.min[2] + (az + (bz - az) * t) * sz;
    const id = positions.length / 3;
    positions.push(x, y, z);
    vertCache.set(key, id);
    return id;
  };

  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let cubeIndex = 0;
        for (let c = 0; c < 8; c++) {
          const o = CORNER_OFFSET[c];
          const val = at(i + o[0], j + o[1], k + o[2]);
          cornerVal[c] = val;
          if (val < iso) cubeIndex |= 1 << c;
        }
        const edges = EDGE_TABLE[cubeIndex];
        if (edges === 0) continue;

        const edgeVerts: number[] = new Array(12).fill(-1);
        for (let e = 0; e < 12; e++) {
          if (edges & (1 << e)) edgeVerts[e] = lerpVert(e, i, j, k);
        }
        const tri = TRI_TABLE[cubeIndex];
        for (let t = 0; tri[t] !== -1; t += 3) {
          indices.push(edgeVerts[tri[t]], edgeVerts[tri[t + 1]], edgeVerts[tri[t + 2]]);
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}
