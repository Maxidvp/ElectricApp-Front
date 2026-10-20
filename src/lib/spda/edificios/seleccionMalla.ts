/**
 * Selección de partes de la malla REAL importada, para delimitar edificios que
 * no son convexos (una L, un patio, un alero) — a diferencia de
 * `convexClip.ts`, que construye un volumen convexo desde cero, acá el
 * resultado son los triángulos originales del archivo, con su forma exacta.
 *
 * Dos operaciones:
 *  - `seleccionarConectados`: flood fill de superficie desde la cara clickeada.
 *    Un STL pierde los nombres de los objetos pero NO la topología: cada sólido
 *    del CAD sigue siendo un "shell" desconectado (no comparte vértices con el
 *    terreno ni con los otros edificios, solo se interpenetra), así que un
 *    click suele bastar para llevarse el edificio entero.
 *  - `recortarMallaPorPlanos`: recorta la malla contra una región convexa
 *    (los planos que el usuario va clickeando). Es el fallback para archivos
 *    donde todo vino soldado en una sola superficie continua y el flood fill
 *    no tiene dónde frenar.
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MallaRender } from "../import/tipos";
import type { Plano } from "./convexClip";

/** Cuantización para soldar vértices por posición: 1e4 → 0.1 mm con coordenadas en metros. */
const ESCALA_SOLDADO = 1e4;
const EPS = 1e-6;

interface Topologia {
  nTri: number;
  /** Triángulos que comparten al menos una arista con cada triángulo. */
  vecinos: number[][];
  /** Normal unitaria por triángulo (3 floats por triángulo). */
  normales: Float32Array;
  /** Centroide por triángulo (3 floats por triángulo). */
  centroides: Float32Array;
}

// La topología es cara de construir (soldado + mapa de aristas) y la malla no
// cambia entre clicks: se cachea por identidad de objeto.
const cacheTopologia = new WeakMap<MallaRender, Topologia>();

function vertDe(m: MallaRender, k: number): number {
  return m.indices ? m.indices[k] : k;
}

export function topologiaDe(m: MallaRender): Topologia {
  const cacheada = cacheTopologia.get(m);
  if (cacheada) return cacheada;

  const total = m.indices ? m.indices.length : m.positions.length / 3;
  const nTri = Math.floor(total / 3);

  // Soldar por posición: un STL nunca viene indexado (cada triángulo trae sus
  // propios 3 vértices), así que sin esto no hay ninguna arista compartida y
  // el flood fill no avanzaría más allá del triángulo clickeado.
  const idPorClave = new Map<string, number>();
  const soldado = new Int32Array(total);
  for (let k = 0; k < total; k++) {
    const v = vertDe(m, k);
    const x = Math.round(m.positions[v * 3] * ESCALA_SOLDADO);
    const y = Math.round(m.positions[v * 3 + 1] * ESCALA_SOLDADO);
    const z = Math.round(m.positions[v * 3 + 2] * ESCALA_SOLDADO);
    const clave = `${x},${y},${z}`;
    let id = idPorClave.get(clave);
    if (id === undefined) {
      id = idPorClave.size;
      idPorClave.set(clave, id);
    }
    soldado[k] = id;
  }

  const trisPorArista = new Map<string, number[]>();
  for (let t = 0; t < nTri; t++) {
    const a = soldado[t * 3];
    const b = soldado[t * 3 + 1];
    const c = soldado[t * 3 + 2];
    const aristas: [number, number][] = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [u, v] of aristas) {
      const clave = u < v ? `${u}_${v}` : `${v}_${u}`;
      const lista = trisPorArista.get(clave);
      if (lista) lista.push(t);
      else trisPorArista.set(clave, [t]);
    }
  }

  const vecinos: number[][] = Array.from({ length: nTri }, () => []);
  for (const lista of trisPorArista.values()) {
    if (lista.length < 2) continue;
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        vecinos[lista[i]].push(lista[j]);
        vecinos[lista[j]].push(lista[i]);
      }
    }
  }

  const normales = new Float32Array(nTri * 3);
  const centroides = new Float32Array(nTri * 3);
  for (let t = 0; t < nTri; t++) {
    const i0 = vertDe(m, t * 3) * 3;
    const i1 = vertDe(m, t * 3 + 1) * 3;
    const i2 = vertDe(m, t * 3 + 2) * 3;
    const ax = m.positions[i0], ay = m.positions[i0 + 1], az = m.positions[i0 + 2];
    const bx = m.positions[i1], by = m.positions[i1 + 1], bz = m.positions[i1 + 2];
    const cx = m.positions[i2], cy = m.positions[i2 + 1], cz = m.positions[i2 + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    normales[t * 3] = nx;
    normales[t * 3 + 1] = ny;
    normales[t * 3 + 2] = nz;
    centroides[t * 3] = (ax + bx + cx) / 3;
    centroides[t * 3 + 1] = (ay + by + cy) / 3;
    centroides[t * 3 + 2] = (az + bz + cz) / 3;
  }

  const topo: Topologia = { nTri, vecinos, normales, centroides };
  cacheTopologia.set(m, topo);
  return topo;
}

/**
 * ¿El pliegue entre dos triángulos vecinos corta la selección?
 *
 * Solo frenan los pliegues CÓNCAVOS más abiertos que el umbral. La distinción
 * importa: un umbral de ángulo a secas frenaría también en las esquinas
 * propias del edificio (pared-pared y pared-techo son 90°, igual que la unión
 * pared-terreno), y un click sobre una pared seleccionaría solo esa pared. Las
 * esquinas propias de un volumen son convexas; el encuentro con el terreno es
 * cóncavo, un rincón interior. Un techo a dos aguas también es convexo en la
 * cumbrera, así que nunca frena ahí.
 */
function bloqueaPliegue(topo: Topologia, t1: number, t2: number, cosLimite: number): boolean {
  const n1x = topo.normales[t1 * 3], n1y = topo.normales[t1 * 3 + 1], n1z = topo.normales[t1 * 3 + 2];
  const n2x = topo.normales[t2 * 3], n2y = topo.normales[t2 * 3 + 1], n2z = topo.normales[t2 * 3 + 2];
  const cos = n1x * n2x + n1y * n2y + n1z * n2z;
  if (cos >= cosLimite) return false; // pliegue más suave que el umbral

  const dx = topo.centroides[t2 * 3] - topo.centroides[t1 * 3];
  const dy = topo.centroides[t2 * 3 + 1] - topo.centroides[t1 * 3 + 1];
  const dz = topo.centroides[t2 * 3 + 2] - topo.centroides[t1 * 3 + 2];
  // El vecino queda del lado de AFUERA del plano de t1 → el pliegue abre hacia
  // afuera, es cóncavo visto desde el exterior del sólido.
  return n1x * dx + n1y * dy + n1z * dz > EPS;
}

/**
 * Flood fill de superficie desde `triInicial`, cruzando aristas compartidas.
 * `anguloConcavoMax` en grados: si es `null` no frena nunca (toma el shell
 * conectado completo, que es lo correcto cuando cada edificio es un sólido
 * aparte en el archivo).
 */
export function seleccionarConectados(
  m: MallaRender,
  triInicial: number,
  anguloConcavoMax: number | null,
): number[] {
  const topo = topologiaDe(m);
  if (triInicial < 0 || triInicial >= topo.nTri) return [];
  const cosLimite = anguloConcavoMax == null ? null : Math.cos((anguloConcavoMax * Math.PI) / 180);

  const visitado = new Uint8Array(topo.nTri);
  const pila = [triInicial];
  visitado[triInicial] = 1;
  const seleccion: number[] = [];
  while (pila.length) {
    const t = pila.pop()!;
    seleccion.push(t);
    for (const v of topo.vecinos[t]) {
      if (visitado[v]) continue;
      if (cosLimite != null && bloqueaPliegue(topo, t, v, cosLimite)) continue;
      visitado[v] = 1;
      pila.push(v);
    }
  }
  return seleccion;
}

/** Arma una `MallaRender` indexada (soldada) a partir de un subconjunto de triángulos. */
export function mallaDeTriangulos(m: MallaRender, tris: number[], nombre: string): MallaRender {
  const soup = new Float32Array(tris.length * 9);
  let o = 0;
  for (const t of tris) {
    for (let k = 0; k < 3; k++) {
      const v = vertDe(m, t * 3 + k) * 3;
      soup[o++] = m.positions[v];
      soup[o++] = m.positions[v + 1];
      soup[o++] = m.positions[v + 2];
    }
  }
  // Soldar antes de guardar: un shell de edificio comparte casi todos sus
  // vértices entre triángulos vecinos, así que indexar achica bastante lo que
  // termina viajando a la base.
  let geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(soup, 3));
  geom = mergeVertices(geom, 1e-4);
  const pos = geom.getAttribute("position").array;
  const idx = geom.getIndex()!.array;
  return {
    nombre,
    positions: pos instanceof Float32Array ? pos : new Float32Array(pos),
    indices: idx instanceof Uint32Array ? idx : Uint32Array.from(idx as ArrayLike<number>),
  };
}

/** Recorta un polígono (lista de vértices) contra un plano, conservando `dot(n, x-p) <= 0`. */
function recortarPoligono(poly: number[][], plano: Plano): number[][] {
  if (poly.length === 0) return poly;
  const dist = poly.map(
    (v) =>
      plano.normal[0] * (v[0] - plano.punto[0]) +
      plano.normal[1] * (v[1] - plano.punto[1]) +
      plano.normal[2] * (v[2] - plano.punto[2]),
  );
  const out: number[][] = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const di = dist[i];
    const dj = dist[j];
    if (di <= 0) out.push(poly[i]);
    if (di <= 0 !== dj <= 0) {
      const t = di / (di - dj);
      out.push([
        poly[i][0] + (poly[j][0] - poly[i][0]) * t,
        poly[i][1] + (poly[j][1] - poly[i][1]) * t,
        poly[i][2] + (poly[j][2] - poly[i][2]) * t,
      ]);
    }
  }
  return out;
}

/** Zona de la región: un volumen convexo que se SUMA o se RESTA de la selección. */
export interface Subregion {
  planos: Plano[];
  resta: boolean;
}

function invertir(p: Plano): Plano {
  return { punto: p.punto, normal: [-p.normal[0], -p.normal[1], -p.normal[2]] };
}

/** m² — por debajo de esto el triángulo es un sliver del recorte, no geometría real. */
const AREA_MIN = 1e-10;

function areaTriangulo(a: number[], b: number[], c: number[]): number {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
}

/**
 * Partes de un polígono que quedan FUERA de una zona convexa.
 *
 * El complemento de un volumen convexo NO es convexo, así que no se puede
 * resolver con un solo recorte. Se descompone en tantas partes disjuntas como
 * planos tenga la zona: "afuera del plano 1", "adentro del 1 pero afuera del
 * 2", etc. Son disjuntas por construcción, así que no se duplica ningún
 * triángulo — que es lo que pasaría restando plano por plano a lo bruto.
 */
function fueraDeZona(poly: number[][], planos: Plano[]): number[][][] {
  const partes: number[][][] = [];
  let resto = poly;
  for (const plano of planos) {
    const afuera = recortarPoligono(resto, invertir(plano));
    if (afuera.length >= 3) partes.push(afuera);
    resto = recortarPoligono(resto, plano);
    if (resto.length < 3) break; // ya no queda nada adentro: el resto no aporta
  }
  return partes;
}

/**
 * Recorta la malla real contra una región formada por varias zonas convexas:
 * se conserva lo que cae en ALGUNA zona sumada y en NINGUNA zona restada. Con
 * eso la región puede ser no convexa (una L, un edificio con un vecino pegado
 * que hay que excluir, un patio interior), aunque cada zona por separado sí lo
 * sea. Los triángulos que cruzan un borde se recortan, no se descartan enteros.
 * El resultado conserva la forma REAL de la malla.
 */
export function recortarMallaPorSubregiones(m: MallaRender, subs: Subregion[]): MallaRender | null {
  const sumas = subs.filter((s) => !s.resta && s.planos.length > 0);
  const restas = subs.filter((s) => s.resta && s.planos.length > 0);
  if (sumas.length === 0) return null;

  const total = m.indices ? m.indices.length : m.positions.length / 3;
  const nTri = Math.floor(total / 3);
  const salida: number[] = [];

  for (let t = 0; t < nTri; t++) {
    const triangulo: number[][] = [];
    for (let k = 0; k < 3; k++) {
      const v = vertDe(m, t * 3 + k) * 3;
      triangulo.push([m.positions[v], m.positions[v + 1], m.positions[v + 2]]);
    }

    for (let s = 0; s < sumas.length; s++) {
      // Adentro de esta zona sumada.
      let poly = triangulo;
      for (const plano of sumas[s].planos) {
        poly = recortarPoligono(poly, plano);
        if (poly.length < 3) break;
      }
      if (poly.length < 3) continue;

      // Menos las zonas restadas Y menos las zonas sumadas ANTERIORES: si dos
      // zonas sumadas se solapan, el solape ya salió con la primera y volver a
      // emitirlo dejaría triángulos duplicados en la malla guardada.
      let partes: number[][][] = [poly];
      for (const otra of [...sumas.slice(0, s), ...restas]) {
        const siguiente: number[][][] = [];
        for (const parte of partes) siguiente.push(...fueraDeZona(parte, otra.planos));
        partes = siguiente;
        if (partes.length === 0) break;
      }

      for (const parte of partes) {
        for (let i = 1; i < parte.length - 1; i++) {
          // Un polígono que cae JUSTO sobre un plano de corte queda tanto del
          // lado de adentro como del de afuera (los dos tests incluyen la
          // igualdad), y sale como un sliver de área cero. No se ve, pero
          // engorda la malla guardada y el conteo de triángulos.
          if (areaTriangulo(parte[0], parte[i], parte[i + 1]) <= AREA_MIN) continue;
          salida.push(...parte[0], ...parte[i], ...parte[i + 1]);
        }
      }
    }
  }

  if (salida.length === 0) return null;
  let geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(salida), 3));
  geom = mergeVertices(geom, 1e-4);
  const pos = geom.getAttribute("position").array;
  const idx = geom.getIndex()!.array;
  return {
    nombre: m.nombre,
    positions: pos instanceof Float32Array ? pos : new Float32Array(pos),
    indices: idx instanceof Uint32Array ? idx : Uint32Array.from(idx as ArrayLike<number>),
  };
}
