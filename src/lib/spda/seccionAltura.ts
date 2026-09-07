/**
 * Sección horizontal del volumen protegido a una altura dada (típicamente la
 * altura de circulación peatonal: 1.8 m o 2 m según el criterio de cada obra).
 *
 * A esa altura, la superficie protegida es MUCHO menor que la huella a nivel
 * del piso, y esa es la que interesa para verificar circulación de personas.
 * Para un cono aislado el radio protegido sale explícito: el perfil es
 * `z(r) = R − √(R² − (rp − r)²)`, así que despejando
 *
 *     r(z) = rp − √(2Rz − z²)
 *
 * es decir, el radio se achica en `√(2Rz − z²)`, que NO depende de la altura
 * del mástil — solo del radio de esfera y de la altura de corte. (Con R = 30 y
 * z = 1.8 son 10.24 m menos para todos los captadores.)
 *
 * El caso general con varias puntas no es un simple círculo: intervienen los
 * recortes entre conos y los casquetes, cuyo aporte es "lo de AFUERA" de la
 * circunferencia que la esfera de apoyo deja en el plano. Se resuelve
 * evaluando el mismo campo analítico que usa el exportador CAD (misma
 * descripción geométrica, así la línea que se ve coincide con la que se
 * exporta) y extrayendo el contorno por marching squares con refinamiento por
 * bisección — el error queda por debajo del micrómetro.
 */

import type { Vec3 } from "./geometry";
import type { PlanoRecorte } from "./construccionEsfera";
import type { ConstruccionExport } from "./exportCad/geometria";

export type Vec2 = readonly [number, number];

export interface Seccion {
  /** Contornos cerrados en planta (X, Y). Puede haber varios (islas y huecos). */
  contornos: Vec2[][];
  /** Área protegida a esa altura (m²), ya descontando los huecos. */
  area: number;
  /** Cota absoluta del plano de corte. */
  zAbs: number;
}

/**
 * Radio protegido de un cono aislado a la altura `z` sobre el suelo.
 * Negativo → la punta es más baja que el plano de corte y no aporta nada.
 */
export function radioConoAAltura(R: number, rp: number, z: number): number {
  if (z <= 0) return rp;
  if (z >= R) return -1;
  return rp - Math.sqrt(Math.max(0, 2 * R * z - z * z));
}

/** Distancia con signo de un punto a un plano de recorte (>0 = lado que se conserva). */
function distPlano(plano: PlanoRecorte, x: number, y: number, z: number): number {
  return (
    plano.normal[0] * (x - plano.punto[0]) +
    plano.normal[1] * (y - plano.punto[1]) +
    plano.normal[2] * (z - plano.punto[2])
  );
}

/**
 * Campo con signo del volumen protegido sobre el plano `zAbs`: > 0 adentro.
 * Reproduce exactamente las piezas del exportador — unión de conos recortados
 * y prismas de los casquetes, menos TODAS las bolas de contacto.
 */
export function campoSeccion(
  construccion: ConstruccionExport,
  R: number,
  cota: number,
  zAbs: number,
): (x: number, y: number) => number {
  const zRel = zAbs - cota;

  const conos = construccion.conos
    .map((c) => ({
      x: c.base[0],
      y: c.base[1],
      rc: radioConoAAltura(R, c.rp, zRel),
      cortes: c.cortes,
    }))
    .filter((c) => c.rc > 0);

  const prismas = construccion.segmentos.map((s) => s.planos);
  const bolas = construccion.segmentos.map((s) => ({ c: s.centro as Vec3, r: s.radio }));

  return (x, y) => {
    // Unión de las piezas "en bruto".
    let dentro = -Infinity;

    for (const c of conos) {
      let d = c.rc - Math.hypot(x - c.x, y - c.y);
      for (const [p1, p2] of c.cortes) {
        // La cuña quitada es {d1 ≥ 0 ∧ d2 ≥ 0}; lo que se conserva es su negado.
        const fuera = Math.max(-distPlano(p1, x, y, zAbs), -distPlano(p2, x, y, zAbs));
        if (fuera < d) d = fuera;
        if (d <= dentro) break;
      }
      if (d > dentro) dentro = d;
    }

    for (const planos of prismas) {
      let d = Infinity;
      for (const pl of planos) {
        const dp = distPlano(pl, x, y, zAbs);
        if (dp < d) d = dp;
        if (d <= dentro) break;
      }
      if (d > dentro) dentro = d;
    }

    // Menos todas las bolas: un punto dentro de cualquiera está expuesto.
    let fueraBolas = Infinity;
    for (const b of bolas) {
      const d = Math.hypot(x - b.c[0], y - b.c[1], zAbs - b.c[2]) - b.r;
      if (d < fueraBolas) fueraBolas = d;
      if (fueraBolas <= -Infinity) break;
    }

    return Math.min(dentro, fueraBolas);
  };
}

/** Caja envolvente en planta de toda la construcción, con margen. */
function cajaEnPlanta(construccion: ConstruccionExport): [number, number, number, number] | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of construccion.conos) {
    x0 = Math.min(x0, c.base[0] - c.rp);
    x1 = Math.max(x1, c.base[0] + c.rp);
    y0 = Math.min(y0, c.base[1] - c.rp);
    y1 = Math.max(y1, c.base[1] + c.rp);
  }
  if (!Number.isFinite(x0)) return null;
  const m = 1;
  return [x0 - m, y0 - m, x1 + m, y1 + m];
}

/**
 * Contorno de la superficie protegida a la altura `zRel` sobre el suelo.
 * `celdas` es la cantidad de celdas por lado de la grilla de muestreo (el
 * contorno se refina después por bisección, así que la grilla solo decide
 * cuántos detalles se capturan, no la precisión de cada punto).
 */
export function seccionAAltura(
  construccion: ConstruccionExport,
  R: number,
  cota: number,
  zRel: number,
  celdas = 320,
): Seccion {
  const zAbs = cota + zRel;
  const caja = cajaEnPlanta(construccion);
  if (!caja) return { contornos: [], area: 0, zAbs };

  const [x0, y0, x1, y1] = caja;
  const n = Math.max(16, Math.min(600, Math.round(celdas)));
  const dx = (x1 - x0) / n;
  const dy = (y1 - y0) / n;
  const f = campoSeccion(construccion, R, cota, zAbs);

  const px = (i: number) => x0 + i * dx;
  const py = (j: number) => y0 + j * dy;

  // Muestreo en los nodos.
  const val = new Float64Array((n + 1) * (n + 1));
  const at = (i: number, j: number) => val[j * (n + 1) + i];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) val[j * (n + 1) + i] = f(px(i), py(j));
  }

  // Cruce refinado por bisección sobre cada arista de la grilla (una sola vez
  // por arista, así las celdas vecinas comparten el punto exacto y el cosido
  // de tramos es exacto).
  const cruceH = new Map<number, Vec2>(); // arista (i,j)→(i+1,j)
  const cruceV = new Map<number, Vec2>(); // arista (i,j)→(i,j+1)

  const bisecar = (ax: number, ay: number, fa: number, bx: number, by: number): Vec2 => {
    let lo = 0;
    let hi = 1;
    let sa = fa;
    for (let k = 0; k < 40; k++) {
      const t = (lo + hi) / 2;
      const v = f(ax + (bx - ax) * t, ay + (by - ay) * t);
      if (v === 0) return [ax + (bx - ax) * t, ay + (by - ay) * t];
      if (v > 0 === sa > 0) {
        lo = t;
        sa = v;
      } else hi = t;
    }
    const t = (lo + hi) / 2;
    return [ax + (bx - ax) * t, ay + (by - ay) * t];
  };

  const puntoH = (i: number, j: number): Vec2 => {
    const key = j * (n + 1) + i;
    let p = cruceH.get(key);
    if (!p) {
      p = bisecar(px(i), py(j), at(i, j), px(i + 1), py(j));
      cruceH.set(key, p);
    }
    return p;
  };
  const puntoV = (i: number, j: number): Vec2 => {
    const key = j * (n + 1) + i;
    let p = cruceV.get(key);
    if (!p) {
      p = bisecar(px(i), py(j), at(i, j), px(i), py(j + 1));
      cruceV.set(key, p);
    }
    return p;
  };

  // Marching squares. Cada tramo se guarda como par de ids de arista, para
  // coserlos después sin comparar coordenadas.
  const idH = (i: number, j: number) => 2 * (j * (n + 1) + i);
  const idV = (i: number, j: number) => 2 * (j * (n + 1) + i) + 1;
  const tramos: [number, number][] = [];
  const puntoDe = new Map<number, Vec2>();

  const reg = (id: number, p: Vec2) => {
    if (!puntoDe.has(id)) puntoDe.set(id, p);
    return id;
  };

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const c0 = at(i, j) > 0;
      const c1 = at(i + 1, j) > 0;
      const c2 = at(i + 1, j + 1) > 0;
      const c3 = at(i, j + 1) > 0;
      const idx = (c0 ? 1 : 0) | (c1 ? 2 : 0) | (c2 ? 4 : 0) | (c3 ? 8 : 0);
      if (idx === 0 || idx === 15) continue;

      const B = () => reg(idH(i, j), puntoH(i, j)); // abajo
      const D = () => reg(idV(i + 1, j), puntoV(i + 1, j)); // derecha
      const T = () => reg(idH(i, j + 1), puntoH(i, j + 1)); // arriba
      const I = () => reg(idV(i, j), puntoV(i, j)); // izquierda

      // Los anillos salen con el interior a la derecha (exterior horario). No
      // importa: el área se resuelve por anidamiento par-impar, no por signo.
      switch (idx) {
        case 1: tramos.push([I(), B()]); break;
        case 2: tramos.push([B(), D()]); break;
        case 3: tramos.push([I(), D()]); break;
        case 4: tramos.push([D(), T()]); break;
        case 5: tramos.push([I(), T()]); tramos.push([D(), B()]); break;
        case 6: tramos.push([B(), T()]); break;
        case 7: tramos.push([I(), T()]); break;
        case 8: tramos.push([T(), I()]); break;
        case 9: tramos.push([T(), B()]); break;
        case 10: tramos.push([B(), I()]); tramos.push([T(), D()]); break;
        case 11: tramos.push([T(), D()]); break;
        case 12: tramos.push([D(), I()]); break;
        case 13: tramos.push([D(), B()]); break;
        case 14: tramos.push([B(), I()]); break;
      }
    }
  }

  // Cosido: cada tramo va de una arista a otra; se encadenan por id.
  const salida = new Map<number, number[]>();
  for (let k = 0; k < tramos.length; k++) {
    const [a] = tramos[k];
    const lista = salida.get(a);
    if (lista) lista.push(k);
    else salida.set(a, [k]);
  }

  const usado = new Array<boolean>(tramos.length).fill(false);
  const contornos: Vec2[][] = [];
  for (let k0 = 0; k0 < tramos.length; k0++) {
    if (usado[k0]) continue;
    const ciclo: Vec2[] = [];
    let k = k0;
    while (k >= 0 && !usado[k]) {
      usado[k] = true;
      const [a, b] = tramos[k];
      const pa = puntoDe.get(a);
      if (pa) ciclo.push(pa);
      const cand = salida.get(b);
      k = -1;
      if (cand) {
        for (const c of cand) {
          if (!usado[c]) {
            k = c;
            break;
          }
        }
      }
    }
    // Se descartan los anillos degenerados (tangencias exactas de una esfera
    // con el plano de corte dejan lazos de área nula que solo ensucian).
    if (ciclo.length >= 3 && Math.abs(areaFirmada(ciclo)) > 1e-6) contornos.push(ciclo);
  }

  return { contornos, area: areaConHuecos(contornos), zAbs };
}

/** Área con signo (shoelace) de un anillo. */
function areaFirmada(anillo: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < anillo.length; i++) {
    const [x1, y1] = anillo[i];
    const [x2, y2] = anillo[(i + 1) % anillo.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/** ¿El punto cae dentro del anillo? (par-impar por lanzamiento de rayo) */
function dentroDeAnillo(anillo: Vec2[], [x, y]: Vec2): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/**
 * Área total encerrada por los anillos, descontando huecos. Se decide qué es
 * hueco por anidamiento (par-impar), no por orientación: así no depende de que
 * el marching squares haya salido con el sentido "correcto".
 */
export function areaConHuecos(contornos: Vec2[][]): number {
  let total = 0;
  for (let i = 0; i < contornos.length; i++) {
    const a = Math.abs(areaFirmada(contornos[i]));
    if (a === 0) continue;
    let profundidad = 0;
    const ref = contornos[i][0];
    for (let j = 0; j < contornos.length; j++) {
      if (i !== j && dentroDeAnillo(contornos[j], ref)) profundidad++;
    }
    total += profundidad % 2 === 0 ? a : -a;
  }
  return Math.max(0, total);
}
