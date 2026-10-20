/**
 * ARREGLO DE PLANOS: partir el espacio con los planos picados y quedarse con
 * las celdas encerradas.
 *
 * Es el paso previo a decidir qué es el edificio. La delimitación por celdas
 * (`carasPicadas.ts`) fallaba porque cada plano es infinito y recorta caras que
 * no toca — el plano del techo de un anexo parte al medio una pared que está a
 * diez metros. Acá el problema se da vuelta: en vez de preguntarse hasta dónde
 * llega cada CARA, se parte el espacio entero en celdas convexas y después se
 * decide qué CELDAS son el edificio. La superficie sale sola: es el borde entre
 * lo que quedó adentro y lo que quedó afuera, y puede ser todo lo cóncava que
 * haga falta.
 *
 * Construcción: se arranca de una caja que cubre el sitio y se la va cortando
 * con cada plano, quedándose con LOS DOS lados (a diferencia de
 * `poliedroDesdePlanos`, que se queda con la intersección). Con n planos salen
 * a lo sumo O(n³) celdas, pero los planos de un edificio están lejos de
 * posición general (muchos paralelos y ortogonales) y quedan bastantes menos.
 *
 * Las celdas que tocan la caja son las que en realidad son infinitas: esas no
 * son volúmenes encerrados y quedan marcadas `abierta`.
 */
import type { Vec3 } from "../geometry";
import { cajaInicial, recortarPoliedro, type Plano, type Poliedro } from "./convexClip";

// ---------------------------------------------------------------------------
// Constantes ajustables
// ---------------------------------------------------------------------------

/** Diámetro (m) del círculo que marca en el visor cada punto clickeado. */
export const DIAMETRO_MARCADOR = 1;

/**
 * Tolerancia angular (grados) para considerar que dos clicks cayeron sobre EL
 * MISMO PLANO. Absorbe el ruido de normales de una malla que no venga de CAD.
 */
export const ANGULO_MISMA_CARA = 5;

/**
 * Separación máxima (m) entre los planos de dos clicks para considerarlos el
 * mismo. Tiene que absorber ruido sin comerse dos muros distintos: en
 * `EDIFICIO 1.stl` la pared exterior y la interior están a 1,2 m, así que con
 * 0,3 m siguen siendo caras separadas y clickeables por separado.
 */
export const DIST_MISMA_CARA = 0.3;

/** m² — caras más chicas que esto son restos del recorte, no caras reales. */
const AREA_MIN = 1e-6;
/** m³ — celdas más chicas que esto son slivers entre planos casi coincidentes. */
const VOLUMEN_MIN = 1e-6;
/** m — tolerancia para decidir que un vértice está sobre un plano o sobre la caja. */
const EPS = 1e-4;

function resta(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function normalizar(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/**
 * ¿Los dos clicks cayeron sobre la misma cara?
 *
 * Tres condiciones, y las tres hacen falta:
 *
 *  - Las normales apuntan para el MISMO lado (`dot > 0`, no `|dot|`). Dos caras
 *    coplanares con normales opuestas son caras distintas: el sofito de un alero
 *    mira para abajo y el techo que tiene encima mira para arriba, y fusionarlos
 *    borra una de las dos.
 *  - Casi paralelas, para absorber el ruido de normales de una malla que no
 *    venga de CAD.
 *  - Casi a la misma altura: el punto de una cae sobre el plano de la otra. Sin
 *    esto, dos paredes paralelas del edificio darían "la misma".
 */
export function esMismaCara(a: Plano, b: Plano): boolean {
  const na = normalizar(a.normal);
  const nb = normalizar(b.normal);
  if (dot(na, nb) < Math.cos((ANGULO_MISMA_CARA * Math.PI) / 180)) return false;
  return Math.abs(dot(na, resta(b.punto, a.punto))) <= DIST_MISMA_CARA;
}

/**
 * Una cara del edificio: UN plano y TODOS los puntos que se clickearon sobre él.
 *
 * La separación importa. El plano es lo único que corta el espacio, y meterlo
 * dos veces rompe el arreglo (el segundo corte cae sobre una cara que ya existe
 * y desaparece la celda vecina, dejando un agujero). Los puntos, en cambio, son
 * evidencia de qué celdas están adentro, y ahí sí hacen falta varios: los dos
 * aleros de un techo comparten el plano pero son dos trozos separados, cada uno
 * en su propia celda del arreglo. Con un punto solo se sembraría uno y el otro
 * quedaría afuera.
 */
export interface CaraDeClicks {
  normal: Vec3;
  puntos: Vec3[];
}

/**
 * Agrupa los clicks por plano, conservando el orden en que se hicieron. Cada
 * click nuevo se suma a la cara que ya tenga su mismo plano, o abre una nueva.
 */
export function agruparClicks(clicks: Plano[]): CaraDeClicks[] {
  const caras: CaraDeClicks[] = [];
  for (const c of clicks) {
    const ya = caras.find((f) => esMismaCara({ punto: f.puntos[0], normal: f.normal }, c));
    if (ya) ya.puntos.push(c.punto);
    else caras.push({ normal: c.normal, puntos: [c.punto] });
  }
  return caras;
}

/**
 * `recortarPoliedro` arrastra todos los vértices originales aunque las caras ya
 * no los usen. Sin compactar, el centroide y el test de "toca la caja" miran
 * puntos que no son parte de la celda.
 */
function compactar(p: Poliedro): Poliedro {
  const mapa = new Map<number, number>();
  const vertices: Vec3[] = [];
  const caras = p.caras.map((cara) =>
    cara.map((i) => {
      let n = mapa.get(i);
      if (n === undefined) {
        n = vertices.length;
        mapa.set(i, n);
        vertices.push(p.vertices[i]);
      }
      return n;
    }),
  );
  return { vertices, caras };
}

/** Normal (por Newell), área y centro de un polígono plano. */
export function geometriaDeCara(vertices: Vec3[], cara: number[]): { n: Vec3; area: number; centro: Vec3 } {
  let nx = 0,
    ny = 0,
    nz = 0,
    cx = 0,
    cy = 0,
    cz = 0;
  for (let i = 0; i < cara.length; i++) {
    const a = vertices[cara[i]];
    const b = vertices[cara[(i + 1) % cara.length]];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
    cx += a[0] / cara.length;
    cy += a[1] / cara.length;
    cz += a[2] / cara.length;
  }
  const largo = Math.hypot(nx, ny, nz);
  return {
    n: largo > 0 ? [nx / largo, ny / largo, nz / largo] : [0, 0, 1],
    area: largo / 2,
    centro: [cx, cy, cz],
  };
}

/** Centro de la celda: promedio de sus vértices, que en un convexo cae adentro. */
function centroDePoliedro(p: Poliedro): Vec3 {
  let x = 0,
    y = 0,
    z = 0;
  for (const v of p.vertices) {
    x += v[0] / p.vertices.length;
    y += v[1] / p.vertices.length;
    z += v[2] / p.vertices.length;
  }
  return [x, y, z];
}

/**
 * Volumen por el teorema de la divergencia. El sentido de cada cara se corrige
 * contra el centro de la celda, así no depende del winding que haya quedado
 * (`recortarPoliedro` arma la cara de corte encadenando segmentos, y el sentido
 * de ese anillo puede salir para cualquier lado).
 */
export function volumenDePoliedro(p: Poliedro): number {
  const c = centroDePoliedro(p);
  let v = 0;
  for (const cara of p.caras) {
    const { n, area, centro } = geometriaDeCara(p.vertices, cara);
    const h = dot(n, resta(centro, c));
    v += (area * Math.abs(h)) / 3;
  }
  return v;
}

export interface Celda {
  poli: Poliedro;
  /**
   * Lado de la celda respecto de cada plano: `-1` del lado interior del plano
   * (`dot(n, x - punto) <= 0`, o sea hacia donde mira el edificio) y `+1` del
   * exterior. Dos celdas son vecinas cuando difieren en UN solo plano.
   */
  signos: number[];
  centro: Vec3;
  volumen: number;
  /**
   * La celda llega al borde de la caja de trabajo: en el espacio real es
   * infinita, así que no es un volumen encerrado y está afuera del edificio sí
   * o sí.
   */
  abierta: boolean;
}

/** El plano dado vuelta, para quedarse con el otro lado del corte. */
function invertir(p: Plano): Plano {
  return { punto: p.punto, normal: [-p.normal[0], -p.normal[1], -p.normal[2]] };
}

function tocaLaCaja(p: Poliedro, min: Vec3, max: Vec3): boolean {
  return p.vertices.some((v) =>
    v.some((x, k) => Math.abs(x - min[k]) < EPS || Math.abs(x - max[k]) < EPS),
  );
}

/**
 * Parte la caja con todos los planos y devuelve las celdas convexas resultantes.
 *
 * Se cortan los dos lados de cada plano, así que el resultado cubre toda la
 * caja sin huecos ni superposiciones.
 */
export function construirArreglo(planos: Plano[], bbox: { min: Vec3; max: Vec3 }): Celda[] {
  let celdas: { poli: Poliedro; signos: number[] }[] = [
    { poli: cajaInicial(bbox.min, bbox.max), signos: [] },
  ];

  for (const plano of planos) {
    const siguiente: { poli: Poliedro; signos: number[] }[] = [];
    for (const c of celdas) {
      for (const [lado, corte] of [
        [-1, plano],
        [1, invertir(plano)],
      ] as const) {
        const trozo = recortarPoliedro(c.poli, corte);
        if (!trozo) continue;
        const poli = compactar(trozo);
        if (poli.caras.length < 4) continue;
        if (volumenDePoliedro(poli) < VOLUMEN_MIN) continue;
        siguiente.push({ poli, signos: [...c.signos, lado] });
      }
    }
    celdas = siguiente;
  }

  return celdas.map((c) => ({
    ...c,
    centro: centroDePoliedro(c.poli),
    volumen: volumenDePoliedro(c.poli),
    abierta: tocaLaCaja(c.poli, bbox.min, bbox.max),
  }));
}

/** Índice de la celda que contiene un punto, o -1. */
export function celdaDelPunto(celdas: Celda[], planos: Plano[], p: Vec3): number {
  const signos = planos.map((pl) => (dot(pl.normal, resta(p, pl.punto)) <= 0 ? -1 : 1));
  return celdas.findIndex((c) => c.signos.every((s, k) => s === signos[k]));
}

export interface CaraCompartida {
  /** Celda del lado `-n` del plano: la que estaría ADENTRO si esta cara es del edificio. */
  adentro: number;
  /** Celda del lado `+n`: la que estaría AFUERA. */
  afuera: number;
  plano: number;
  area: number;
  poligono: Vec3[];
}

/**
 * Caras internas del arreglo: los polígonos donde dos celdas se tocan.
 *
 * Cada una viene orientada por el plano que la produjo, y ese orden es lo que
 * después hace decidible el problema: una cara solo puede ser del edificio con
 * `adentro` adentro y `afuera` afuera, nunca al revés.
 */
export function carasCompartidas(celdas: Celda[], planos: Plano[]): CaraCompartida[] {
  const out: CaraCompartida[] = [];
  // Índice por firma de los planos que NO son el candidato, para no comparar
  // todas las celdas contra todas.
  const porFirma = new Map<string, number[]>();
  celdas.forEach((c, i) => {
    for (let k = 0; k < planos.length; k++) {
      const clave = `${k}|${c.signos.map((s, j) => (j === k ? "?" : s)).join(",")}`;
      const lista = porFirma.get(clave);
      if (lista) lista.push(i);
      else porFirma.set(clave, [i]);
    }
  });

  for (const [clave, grupo] of porFirma) {
    if (grupo.length !== 2) continue; // sin pareja del otro lado: no hay cara interna
    const k = Number(clave.slice(0, clave.indexOf("|")));
    const [a, b] = grupo;
    const adentro = celdas[a].signos[k] === -1 ? a : b;
    const afuera = adentro === a ? b : a;

    // El polígono compartido es la cara de la celda que se apoya en el plano k.
    const p = planos[k];
    const celda = celdas[adentro];
    let mejor: { area: number; poligono: Vec3[] } | null = null;
    for (const cara of celda.poli.caras) {
      if (!cara.every((i) => Math.abs(dot(p.normal, resta(celda.poli.vertices[i], p.punto))) < EPS)) continue;
      const { area } = geometriaDeCara(celda.poli.vertices, cara);
      if (!mejor || area > mejor.area) mejor = { area, poligono: cara.map((i) => celda.poli.vertices[i]) };
    }
    if (!mejor || mejor.area < AREA_MIN) continue;
    out.push({ adentro, afuera, plano: k, area: mejor.area, poligono: mejor.poligono });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Qué celdas son el edificio
// ---------------------------------------------------------------------------

export type Etiqueta = "adentro" | "afuera";

export interface Reconstruccion {
  etiquetas: Etiqueta[];
  /** Caras del edificio: las que separan una celda de adentro de una de afuera. */
  superficie: CaraCompartida[];
  volumen: number;
  /**
   * Puntos clickeados cuyo lado interior se escapa al infinito: por ahí el
   * volumen todavía no cierra. Van los puntos y no las caras porque una cara
   * puede tener varios, y en el visor lo útil es señalar CUÁL marcador es el que
   * quedó suelto.
   */
  puntosSueltos: Vec3[];
}

/**
 * Decide qué celdas son el edificio con UNA sola regla, sin propagar nada:
 *
 * **Una celda es del edificio si y solo si es el lado `-n` (el que la
 * convención marca como interior) de ALGÚN punto clickeado.** Si una celda es
 * siempre lado `+n`, o no es vecina de ningún punto, queda afuera.
 *
 * Que la evidencia sean los PUNTOS y no las caras es lo que permite que una
 * misma cara aporte varias celdas: los dos aleros de un techo están en el mismo
 * plano pero en celdas distintas del arreglo, y cada uno necesita su punto.
 *
 * Y eso es lo que hace que no haga falta propagar. Una cara cóncava se parte en
 * varias celdas —las celdas son convexas siempre— y antes las que no tocaba
 * ningún click quedaban afuera: un anillo alrededor de un patio perdía las
 * cuatro esquinas, un bloque con un anexo perdía los tramos de arriba. Con
 * varios puntos por plano se arreglan clickeando esa misma cara una vez por
 * trozo, que es lo que uno hace naturalmente al ver el pedazo que falta.
 * Medido: el patio pasa de 1008 a 2184 m³ (exacto) agregando 3 puntos al techo,
 * y el bloque con anexo de 980 a 1280 m³ (exacto) agregando 2.
 */
export function reconstruir(
  celdas: Celda[],
  caras: CaraDeClicks[],
  compartidas: CaraCompartida[],
  eps = 1e-3,
): Reconstruccion {
  const planos = planosDeCaras(caras);
  const adentro = new Set<number>();
  const puntosSueltos: Vec3[] = [];

  for (const cara of caras) {
    const n = normalizar(cara.normal);
    for (const p of cara.puntos) {
      const dentro: Vec3 = [p[0] - n[0] * eps, p[1] - n[1] * eps, p[2] - n[2] * eps];
      const i = celdaDelPunto(celdas, planos, dentro);
      if (i >= 0 && !celdas[i].abierta) adentro.add(i);
      else puntosSueltos.push(p);
    }
  }

  const etiquetas: Etiqueta[] = celdas.map((_, i) => (adentro.has(i) ? "adentro" : "afuera"));
  const superficie = compartidas.filter(
    (c) => etiquetas[c.adentro] === "adentro" && etiquetas[c.afuera] === "afuera",
  );
  let volumen = 0;
  celdas.forEach((c, i) => {
    if (etiquetas[i] === "adentro") volumen += c.volumen;
  });
  return { etiquetas, superficie, volumen, puntosSueltos };
}

/** El plano que corta el espacio por cada cara: uno solo, con su primer punto de ancla. */
export function planosDeCaras(caras: CaraDeClicks[]): Plano[] {
  return caras.map((c) => ({ punto: c.puntos[0], normal: c.normal }));
}

/**
 * Malla de la superficie reconstruida, con las caras orientadas hacia afuera.
 *
 * El winding del polígono que devuelve el arreglo es el que haya quedado del
 * recorte, así que se lo compara contra la normal del plano y se lo da vuelta
 * si hace falta. Cada cara es convexa (es una celda de un arreglo de rectas en
 * su plano), así que el abanico desde el primer vértice es válido.
 */
export function superficieAMalla(
  superficie: CaraCompartida[],
  planos: Plano[],
): { positions: Float32Array; indices: Uint32Array } {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const cara of superficie) {
    const vertices = cara.poligono;
    if (vertices.length < 3) continue;
    const { n } = geometriaDeCara(
      vertices,
      vertices.map((_, i) => i),
    );
    const orden = dot(n, planos[cara.plano].normal) < 0 ? [...vertices].reverse() : vertices;
    const base = pos.length / 3;
    for (const v of orden) pos.push(v[0], v[1], v[2]);
    for (let i = 1; i < orden.length - 1; i++) idx.push(base, base + i, base + i + 1);
  }
  return { positions: new Float32Array(pos), indices: Uint32Array.from(idx) };
}

/**
 * Punto de entrada único: de los clicks al sólido cerrado.
 *
 * Lo usan tanto el visor (vista previa) como el guardado, así que lo que se ve
 * es exactamente lo que se persiste. Devuelve `null` mientras los clicks no
 * encierren ningún volumen — que es la señal de "todavía falta picar caras", no
 * un error.
 */
export interface VolumenDeClicks {
  celdas: Celda[];
  /** Los clicks agrupados por plano — cuántas caras distintas resultaron. */
  caras: CaraDeClicks[];
  reconstruccion: Reconstruccion;
  positions: Float32Array;
  indices: Uint32Array;
  volumen: number;
}

/**
 * Recibe los clicks CRUDOS, en el orden en que se hicieron, y los agrupa por
 * plano acá adentro. Así el que llama no tiene que preocuparse por los
 * coplanares: dos clicks sobre la misma cara aportan un plano y dos puntos, que
 * es exactamente lo que hace falta para los dos aleros de un techo.
 */
export function volumenDeClicks(
  clicks: Plano[],
  bbox: { min: Vec3; max: Vec3 },
): VolumenDeClicks | null {
  const caras = agruparClicks(clicks);
  // Con menos de 4 planos distintos no hay nada que encerrar.
  if (caras.length < 4) return null;
  const planos = planosDeCaras(caras);
  const celdas = construirArreglo(planos, bbox);
  const compartidas = carasCompartidas(celdas, planos);
  const reconstruccion = reconstruir(celdas, caras, compartidas);
  if (reconstruccion.superficie.length === 0 || reconstruccion.volumen <= 0) return null;
  const { positions, indices } = superficieAMalla(reconstruccion.superficie, planos);
  if (positions.length < 9) return null;
  return { celdas, caras, reconstruccion, positions, indices, volumen: reconstruccion.volumen };
}
