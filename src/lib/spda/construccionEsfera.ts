/**
 * Construcción geométrica de la esfera rodante con varias puntas.
 *
 * Las posiciones de apoyo relevantes son las que dejan a la esfera "calzada"
 * (≥ 3 contactos):
 *   - 2 puntas + suelo: esfera tangente al plano de tierra (centro a cota + r) y
 *     a las dos puntas. Existen si d ≤ 2·rp, hasta dos por par (una a cada lado
 *     de la recta que une las puntas). Definen dónde se juntan las zonas de dos
 *     puntas a nivel del suelo — son las más importantes.
 *   - 3 puntas: esfera tangente a las tres.
 *
 * (Una esfera apoyada SOLO en dos puntas no es una posición de apoyo: rodaría
 * hasta tocar el suelo o una tercera punta.)
 *
 * De cada esfera se dibuja el SEGMENTO ESFÉRICO entre el suelo y el nivel de las
 * puntas que la sostienen: esa franja es el borde protector.
 *
 *   rp = √(2·r·h − h²)   (h = altura de la punta sobre el suelo)
 *   penetración entre dos puntas iguales:  p = r − √(r² − (d/2)²)
 */

import { distPointSegment, v, type Vec3 } from "./geometry";

const EPS = 1e-6;

/** Plano de recorte: se conserva el semiespacio `normal·(x − punto) ≥ 0`. */
export interface PlanoRecorte {
  punto: Vec3;
  normal: Vec3;
}

export type TipoApoyo = "2p+suelo" | "3p";

export interface EsferaContacto {
  centro: Vec3;
  radio: number;
  /** Piso del segmento (normalmente la cota de tierra). */
  zMin: number;
  /** Techo del segmento: altura de las puntas de apoyo (acota el sólido por arriba). */
  zMax: number;
  tipo: TipoApoyo;
  puntas: number[];
  /**
   * Vértices del POLÍGONO esférico a conservar, en orden perimetral: las puntas
   * de apoyo y, para "2p+suelo", el punto de tangencia con el suelo (que coincide
   * con una de las intersecciones de las bases de los conos).
   *
   * Casi siempre son 3 (triángulo), pero pueden ser más: si varias puntas son
   * CONCÍCLICAS (p. ej. las 4 esquinas de un rectángulo), una sola esfera se
   * apoya en todas a la vez y el recinto es un cuadrilátero, no un triángulo.
   * Quedarse con 3 de esos apoyos deja el casquete chico y abre un hueco.
   */
  vertices: Vec3[];
  /**
   * Por cada vértice, el índice de la punta de apoyo, o -1 si es el punto de
   * tangencia con el suelo. Permite saber si una arista es punta–punta (limita
   * con otro segmento) o punta–tangencia (limita con un cono).
   */
  verticePunta: number[];
}

/** Intersección de dos círculos coplanares. Devuelve 0..2 puntos (x, y). */
function interseccionCirculos(
  ax: number, ay: number, ra: number,
  bx: number, by: number, rb: number,
): [number, number][] {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  if (d < EPS || d > ra + rb || d < Math.abs(ra - rb)) return [];
  const a = (ra * ra - rb * rb + d * d) / (2 * d);
  const h2 = ra * ra - a * a;
  if (h2 < 0) return [];
  const h = Math.sqrt(h2);
  const xm = ax + (a * dx) / d;
  const ym = ay + (a * dy) / d;
  if (h < EPS) return [[xm, ym]];
  return [
    [xm + (h * dy) / d, ym - (h * dx) / d],
    [xm - (h * dy) / d, ym + (h * dx) / d],
  ];
}

/** Esferas tangentes al suelo (centro a cota + r) y a las dos puntas A, B. */
export function esferasDosPuntasSuelo(
  A: Vec3,
  B: Vec3,
  r: number,
  cota: number,
  iA: number,
  iB: number,
): EsferaContacto[] {
  const cz = cota + r;
  const raA = r * r - (cz - A[2]) ** 2;
  const raB = r * r - (cz - B[2]) ** 2;
  if (raA <= 0 || raB <= 0) return [];
  const zMax = Math.max(A[2], B[2]);
  return interseccionCirculos(
    A[0], A[1], Math.sqrt(raA),
    B[0], B[1], Math.sqrt(raB),
  ).map(([x, y]) => ({
    centro: [x, y, cz] as Vec3,
    radio: r,
    zMin: cota,
    zMax,
    tipo: "2p+suelo" as const,
    puntas: [iA, iB],
    // El tercer vértice es el punto de tangencia con el suelo (bajo el centro).
    vertices: [A, B, [x, y, cota] as Vec3],
    verticePunta: [iA, iB, -1],
  }));
}

function circuncirculo(
  A: Vec3,
  B: Vec3,
  C: Vec3,
): { centro: Vec3; radio: number; normal: Vec3 } | null {
  const a = v.sub(A, C);
  const b = v.sub(B, C);
  const n = v.cross(a, b);
  const n2 = v.dot(n, n);
  if (n2 < EPS) return null;
  const a2 = v.dot(a, a);
  const b2 = v.dot(b, b);
  const p = v.sub(v.scale(b, a2), v.scale(a, b2));
  const rel = v.scale(v.cross(p, n), 1 / (2 * n2));
  return { centro: v.add(C, rel), radio: v.len(rel), normal: v.normalize(n) };
}

/** Esfera de radio r apoyada en las tres puntas (casquete superior). */
export function esferaTresPuntas(
  A: Vec3,
  B: Vec3,
  C: Vec3,
  r: number,
  cota: number,
  idx: [number, number, number],
): EsferaContacto | null {
  const cc = circuncirculo(A, B, C);
  if (!cc || cc.radio >= r - EPS) return null;
  const off = Math.sqrt(r * r - cc.radio * cc.radio);
  const nUp = cc.normal[2] >= 0 ? cc.normal : v.scale(cc.normal, -1);
  const centro = v.add(cc.centro, v.scale(nUp, off));
  if (centro[2] - r < cota - EPS) return null;
  return {
    centro,
    radio: r,
    zMin: cota,
    zMax: Math.max(A[2], B[2], C[2]),
    tipo: "3p",
    puntas: [...idx],
    vertices: [A, B, C],
    verticePunta: [...idx],
  };
}

/** Todas las esferas de apoyo (2 puntas + suelo, y 3 puntas) de un juego de puntas. */
export function construccionMultiPunta(
  puntas: Vec3[],
  r: number,
  cota: number,
  maxPuntasParaTernas = 16,
): EsferaContacto[] {
  const out: EsferaContacto[] = [];

  const noPenetraOtraPunta = (e: EsferaContacto) =>
    !puntas.some(
      (q, k) => !e.puntas.includes(k) && v.dist(q, e.centro) < r - 1e-3,
    );

  for (let i = 0; i < puntas.length; i++) {
    for (let j = i + 1; j < puntas.length; j++) {
      for (const e of esferasDosPuntasSuelo(puntas[i], puntas[j], r, cota, i, j)) {
        if (noPenetraOtraPunta(e)) out.push(e);
      }
    }
  }

  if (puntas.length <= maxPuntasParaTernas) {
    for (let i = 0; i < puntas.length; i++) {
      for (let j = i + 1; j < puntas.length; j++) {
        for (let k = j + 1; k < puntas.length; k++) {
          const e = esferaTresPuntas(
            puntas[i], puntas[j], puntas[k], r, cota, [i, j, k],
          );
          if (e && noPenetraOtraPunta(e)) out.push(e);
        }
      }
    }
  }

  return fusionarCoincidentes(out, r);
}

/**
 * Junta las esferas de apoyo casi coincidentes en una sola, UNIENDO sus puntos
 * de apoyo en vez de descartar las repetidas.
 *
 * Cuando varias puntas son concíclicas (las 4 esquinas de un rectángulo, por
 * ejemplo) una única esfera se apoya en todas, y cada terna de esas puntas la
 * "redescubre" con el mismo centro. Quedarse con la primera terna y tirar el
 * resto perdía las puntas de apoyo sobrantes: el recinto salía triangular
 * cuando en realidad es un cuadrilátero, y quedaba un hueco sin cubrir (se veía
 * como superficies faltantes entre puntas, tanto en el visor como en el STEP).
 */
function fusionarCoincidentes(esferas: EsferaContacto[], r: number): EsferaContacto[] {
  const grupos: EsferaContacto[][] = [];
  for (const e of esferas) {
    const g = grupos.find((g) => v.dist(g[0].centro, e.centro) < r * 0.03);
    if (g) g.push(e);
    else grupos.push([e]);
  }

  return grupos.map((grupo) => {
    const base = grupo[0];
    if (grupo.length === 1) return base;

    // Unión de apoyos: cada punta una sola vez, más la tangencia con el suelo
    // (una sola, porque todas las del grupo comparten centro y por lo tanto nadir).
    const porPunta = new Map<number, Vec3>();
    let tangencia: Vec3 | null = null;
    for (const e of grupo) {
      e.vertices.forEach((vert, i) => {
        const p = e.verticePunta[i];
        if (p < 0) tangencia ??= vert;
        else if (!porPunta.has(p)) porPunta.set(p, vert);
      });
    }

    const vertices: Vec3[] = [];
    const verticePunta: number[] = [];
    for (const [p, vert] of porPunta) {
      vertices.push(vert);
      verticePunta.push(p);
    }
    if (tangencia) {
      vertices.push(tangencia);
      verticePunta.push(-1);
    }

    const orden = ordenPerimetral(base.centro, vertices);
    return {
      ...base,
      tipo: grupo.some((e) => e.tipo === "2p+suelo") ? ("2p+suelo" as const) : ("3p" as const),
      zMax: Math.max(...grupo.map((e) => e.zMax)),
      puntas: [...porPunta.keys()].sort((a, b) => a - b),
      vertices: orden.map((i) => vertices[i]),
      verticePunta: orden.map((i) => verticePunta[i]),
    };
  });
}

/**
 * Orden perimetral de los vértices de un polígono esférico: los ordena por
 * azimut alrededor del eje que va del centro de la esfera al centroide de los
 * vértices. Así las aristas del polígono son su perímetro real y no diagonales
 * (una diagonal no limita con ningún vecino: recortar por ella deja una pared
 * plana que no existe).
 */
function ordenPerimetral(centro: Vec3, vertices: Vec3[]): number[] {
  const idx = vertices.map((_, i) => i);
  if (vertices.length <= 3) return idx;

  const centroide = v.scale(
    vertices.reduce((acc, p) => v.add(acc, p), [0, 0, 0] as Vec3),
    1 / vertices.length,
  );
  const eje = v.sub(centroide, centro);
  if (v.len(eje) < EPS) return idx;
  const n = v.normalize(eje);
  // Un vector cualquiera no paralelo a n, para armar la base del plano.
  const aux: Vec3 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = v.normalize(v.cross(n, aux));
  const w = v.cross(n, u);

  const angulo = (i: number) => {
    const d = v.sub(vertices[i], centro);
    return Math.atan2(v.dot(d, w), v.dot(d, u));
  };
  return idx.sort((a, b) => angulo(a) - angulo(b));
}

// ---------------------------------------------------------------------------
// Planos de recorte (compartidos por el visor 3D y el exportador CAD)
// ---------------------------------------------------------------------------

/** Centroide de los vértices: referencia de "lado de adentro" del polígono. */
function centroide(verts: Vec3[]): Vec3 {
  return v.scale(
    verts.reduce((acc, p) => v.add(acc, p), [0, 0, 0] as Vec3),
    1 / verts.length,
  );
}

/**
 * Plano VERTICAL que contiene una arista del polígono de apoyos, conservando
 * el lado de adentro (`referenciaInterior`, en planta).
 */
function planoVerticalPorArista(a: Vec3, b: Vec3, referenciaInterior: Vec3): PlanoRecorte | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null; // arista vertical en planta: no define plano
  let n: Vec3 = [-dy / len, dx / len, 0];
  if (n[0] * (referenciaInterior[0] - a[0]) + n[1] * (referenciaInterior[1] - a[1]) < 0) {
    n = [-n[0], -n[1], 0];
  }
  return { punto: [a[0], a[1], a[2]], normal: n };
}

/**
 * Planos de recorte de una esfera de apoyo: piso, techo, y un plano VERTICAL
 * por cada arista del polígono de apoyos.
 *
 * Verticales, y no inclinados, para que cada prisma sea exactamente la
 * extrusión vertical de su polígono. Como los polígonos en planta no se
 * solapan entre sí, las piezas tampoco: el reparto es limpio por construcción.
 * Con planos inclinados el prisma deja de ser esa extrusión y a ciertas alturas
 * se mete en el territorio del vecino — medido: 786 m³ de solape entre
 * segmentos en un triángulo de 3 puntas, 6% del volumen.
 *
 * El precio es que las piezas quedan exactamente pegadas por caras coplanares,
 * y con eso el `fuse` de OCCT falla feo (trunca el sólido por arriba y se come
 * ~117 m³; no lo salvan `commonFace`/`sameFace` ni correr los planos una
 * fracción de milímetro). Por eso el exportador NO fusiona: entrega el volumen
 * en piezas, que además es lo que se quiere para poder identificarlas.
 *
 * Solo se recorta por las aristas del PERÍMETRO. Una diagonal (dos apoyos de
 * la misma esfera que no son consecutivos) no limita con nada: recortar por
 * ella partiría el recinto al medio y dejaría una pared plana inexistente.
 */
export function separadoresDeEsfera(e: EsferaContacto): PlanoRecorte[] {
  const planos: PlanoRecorte[] = [
    { punto: [e.centro[0], e.centro[1], e.zMin], normal: [0, 0, 1] },
    { punto: [e.centro[0], e.centro[1], e.zMax], normal: [0, 0, -1] },
  ];
  const n = e.vertices.length;
  if (n < 3) return planos;
  const centro = centroide(e.vertices);
  for (let k = 0; k < n; k++) {
    const plano = planoVerticalPorArista(e.vertices[k], e.vertices[(k + 1) % n], centro);
    if (plano) planos.push(plano);
  }
  return planos;
}

/** Datos mínimos de una punta para el recorte de conos por azimut. */
export interface ConoInfo {
  x: number;
  y: number;
  h: number;
  rp: number;
}

/**
 * Semiángulo de la cuña de azimut del cono `c` que debe recortarse por culpa de
 * la punta `o`: la esfera rodante generadora del cono (centro a `rp` de la
 * punta, en tierra + R) empieza a penetrar `o` justo en ese ángulo. Se resuelve
 * por bisección sobre `dist(centro generador, mástil o) = R`. 0 → no hay cuña.
 */
export function semianguloRecorte(c: ConoInfo, o: ConoInfo, R: number, cota: number): number {
  const angO = Math.atan2(o.y - c.y, o.x - c.x);
  const g = (ang: number) => {
    const C: Vec3 = [c.x + c.rp * Math.cos(ang), c.y + c.rp * Math.sin(ang), cota + R];
    return distPointSegment(C, [o.x, o.y, cota], [o.x, o.y, cota + o.h]) - R;
  };
  if (g(angO) >= -1e-6) return 0;
  if (g(angO + Math.PI) < 0) return Math.PI;
  let lo = 0;
  let hi = Math.PI;
  for (let k = 0; k < 44; k++) {
    const mid = (lo + hi) / 2;
    if (g(angO + mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Los dos planos verticales por la punta `c` que acotan la cuña de azimut a
 * quitarle al cono por culpa de la punta `o` (null si no hace falta recorte).
 * Cada plano conserva el lado que mira hacia adentro de la cuña (hacia `o`);
 * la cuña a recortar es la intersección de ambos semiespacios.
 */
export function planosRecorteCono(
  c: ConoInfo,
  o: ConoInfo,
  R: number,
  cota: number,
): [PlanoRecorte, PlanoRecorte] | null {
  const half = semianguloRecorte(c, o, R, cota);
  if (half <= 1e-4) return null;
  const angO = Math.atan2(o.y - c.y, o.x - c.x);
  const a1 = angO - half;
  const a2 = angO + half;
  const punto: Vec3 = [c.x, c.y, cota];
  return [
    { punto, normal: [-Math.sin(a1), Math.cos(a1), 0] },
    { punto, normal: [Math.sin(a2), -Math.cos(a2), 0] },
  ];
}
