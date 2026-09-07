/**
 * Adaptador DXF (ASCII) exportado desde AutoCAD.
 *
 * Convención de capas (configurable en la UI):
 *   CAPTADORES  → mástiles / puntas Franklin (POINT, o LINE vertical)
 *   CONDUCTORES → cable de guarda, cordones de malla (LINE, LWPOLYLINE, POLYLINE)
 *   ESTRUCTURA  → lo que hay que proteger (se muestrea a nube de puntos)
 *   TERRENO     → perímetro del terreno / plano de tierra
 *
 * Todo lo que no matchee una capa conocida se trata como ESTRUCTURA.
 * DXF de AutoCAD siempre es Z-arriba, así que `ejeVertical` se ignora.
 */

import DxfParser from "dxf-parser";
import type { Conductor, Mastil, Vec3 } from "../geometry";
import {
  clasificar,
  factorEscala,
  sugerirUnidad,
  type ModeloImportado,
  type OpcionesImport,
  type Unidad,
} from "./tipos";

type Punto = { x: number; y: number; z?: number };

function p2v(p: Punto, escala: number): Vec3 {
  return [(p.x ?? 0) * escala, (p.y ?? 0) * escala, (p.z ?? 0) * escala];
}

/** AutoCAD $INSUNITS → unidad. Devuelve null si es "sin unidad" o desconocido. */
function unidadDXF(insunits: unknown): Unidad | null {
  switch (Number(insunits)) {
    case 1:
      return "in";
    case 2:
      return "ft";
    case 4:
      return "mm";
    case 5:
      return "cm";
    case 6:
      return "m";
    default:
      return null; // 0 = unitless, u otros (yardas, km, …) no soportados
  }
}

/** Densifica un segmento en puntos separados como máx. `paso` metros. */
function densificar(a: Vec3, b: Vec3, paso: number): Vec3[] {
  const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const n = Math.max(1, Math.ceil(d / paso));
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}

export function importarDXF(texto: string, opts: OpcionesImport): ModeloImportado {
  const parser = new DxfParser();
  const dxf = parser.parseSync(texto);
  const advertencias: string[] = [];
  if (!dxf || !dxf.entities) {
    throw new Error("DXF vacío o no reconocido.");
  }

  const { mapeo, pasoMuestreo } = opts;
  const unidadDetectada = unidadDXF((dxf.header as Record<string, unknown> | undefined)?.["$INSUNITS"]);
  const unidadUsada = unidadDetectada ?? opts.unidad;
  const escala = factorEscala({ ...opts, unidad: unidadUsada });

  const mastiles: Mastil[] = [];
  const conductores: Conductor[] = [];
  const puntosEstructura: Vec3[] = [];
  const lineasEstructura: Vec3[][] = [];
  const terreno: Vec3[][] = [];
  const capas = new Set<string>();

  let min: [number, number, number] = [Infinity, Infinity, Infinity];
  let max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const acumBounds = (p: Vec3) => {
    for (let i = 0; i < 3; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  };

  let idCounter = 0;
  const nextId = (pref: string) => `${pref}-${++idCounter}`;

  for (const e of dxf.entities as any[]) {
    const capa = String(e.layer ?? "0");
    capas.add(capa);
    const clase = clasificar(capa, mapeo);

    // --- Extraer polilínea de la entidad ---
    let pts: Vec3[] | null = null;
    switch (e.type) {
      case "LINE":
        pts = [p2v(e.vertices?.[0] ?? e.start, escala), p2v(e.vertices?.[1] ?? e.end, escala)];
        break;
      case "LWPOLYLINE":
      case "POLYLINE":
        if (Array.isArray(e.vertices)) {
          pts = (e.vertices as Punto[]).map((vx) => p2v(vx, escala));
          if (e.shape || e.closed) pts.push(pts[0]);
        }
        break;
      case "POINT":
        pts = [p2v(e.position ?? e, escala)];
        break;
      case "3DFACE":
      case "SOLID":
        if (Array.isArray(e.vertices)) {
          pts = (e.vertices as Punto[]).map((vx) => p2v(vx, escala));
          pts.push(pts[0]);
        }
        break;
      case "CIRCLE":
      case "ARC": {
        const c = p2v(e.center, escala);
        const r = (e.radius ?? 0) * escala;
        const seg = 24;
        pts = [];
        for (let i = 0; i <= seg; i++) {
          const a = (i / seg) * Math.PI * 2;
          pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]]);
        }
        break;
      }
      default:
        advertencias.push(`Entidad ignorada: ${e.type} (capa ${capa})`);
        continue;
    }
    if (!pts || pts.length === 0) continue;
    pts.forEach(acumBounds);

    // --- Enrutar según clase ---
    if (clase === "captadores") {
      if (pts.length === 1) {
        mastiles.push({ id: nextId("m"), tipo: "mastil", base: pts[0], altura: 0 });
      } else if (
        pts.length === 2 &&
        Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) < 0.1
      ) {
        const base = pts[0][2] <= pts[1][2] ? pts[0] : pts[1];
        const top = pts[0][2] <= pts[1][2] ? pts[1] : pts[0];
        mastiles.push({ id: nextId("m"), tipo: "mastil", base, altura: top[2] - base[2] });
      } else {
        conductores.push({ id: nextId("c"), tipo: "conductor", puntos: pts });
      }
    } else if (clase === "conductores") {
      conductores.push({ id: nextId("c"), tipo: "conductor", puntos: pts });
    } else if (clase === "terreno") {
      terreno.push(pts);
    } else {
      lineasEstructura.push(pts);
      for (let i = 0; i < pts.length - 1; i++) {
        for (const q of densificar(pts[i], pts[i + 1], pasoMuestreo)) puntosEstructura.push(q);
      }
      if (pts.length === 1) puntosEstructura.push(pts[0]);
    }
  }

  if (!isFinite(min[0])) {
    min = [0, 0, 0];
    max = [1, 1, 1];
    advertencias.push("No se pudo determinar la extensión del modelo.");
  }

  const cotaTierra = terreno.length
    ? terreno.flat().reduce((s, p) => Math.min(s, p[2]), Infinity)
    : min[2];

  if (!mastiles.length && !conductores.length) {
    advertencias.push(
      "No se detectó ningún elemento de captación. Revisá el mapeo de capas o cargá los captadores manualmente.",
    );
  }

  // Diagnóstico de unidades.
  if (unidadDetectada) {
    advertencias.push(`Unidad tomada del DXF ($INSUNITS): ${unidadUsada}.`);
  } else {
    advertencias.push(
      `El DXF no declara unidades ($INSUNITS=0 o ausente): se asumió "${unidadUsada}". Cambiá la unidad y reimportá si no corresponde.`,
    );
    const ladoMayorArchivo = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / escala;
    const sugerida = sugerirUnidad(ladoMayorArchivo);
    if (sugerida && sugerida !== unidadUsada) {
      advertencias.push(
        `Por el tamaño del modelo (~${ladoMayorArchivo.toFixed(0)} u de lado) la unidad podría ser "${sugerida}".`,
      );
    }
  }

  return {
    formato: "dxf",
    mastiles,
    conductores,
    puntosEstructura,
    lineasEstructura,
    terreno,
    bounds: { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] },
    cotaTierra: isFinite(cotaTierra) ? cotaTierra : 0,
    capasDetectadas: [...capas].sort(),
    unidadUsada,
    unidadDetectada,
    advertencias,
  };
}
