/**
 * Estado de la sección "Importar objetos" — herramientas de desarrollo
 * separadas del flujo de diseño (`store.ts`): importar una malla de terreno
 * cruda y decimarla, comparando original vs. resultado. No participa del
 * cálculo de esfera rodante; es un banco de pruebas para las herramientas que
 * se vayan sumando acá (decimación hoy, lo que siga después).
 */
import { create } from "zustand";
import {
  OPCIONES_IMPORT_POR_DEFECTO,
  type MallaRender,
  type OpcionesImport,
} from "@/lib/spda/import/tipos";
import { importarTerrenoCrudo } from "@/lib/spda/import/terreno";
import { typedArrayABase64 } from "@/lib/spda/base64";
import { apiFetch } from "@/services/apiFetch";
import { useSpdaStore } from "@/state/spda/store";
import type {
  MallaDecimada,
  PeticionDecimar,
  RespuestaDecimar,
} from "@/workers/spda/decimar.worker";

/** Por encima de esto no se deja guardar — obliga a decimar más antes de subir a la base. */
export const PESO_MAX_BYTES = 5 * 1024 * 1024;

let worker: Worker | null = null;
let jobId = 0;
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../../workers/spda/decimar.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (ev: MessageEvent<RespuestaDecimar>) => manejarRespuesta(ev.data);
  }
  return worker;
}

export function contarVertices(mallas: { positions: Float32Array }[]): number {
  return mallas.reduce((acc, m) => acc + m.positions.length / 3, 0);
}
export function contarTriangulos(mallas: { positions: Float32Array; indices: Uint32Array | null }[]): number {
  return mallas.reduce(
    (acc, m) => acc + (m.indices ? m.indices.length / 3 : m.positions.length / 3 / 3),
    0,
  );
}

/** Peso crudo (bytes) de `positions` + `indices` — lo que ocuparía tal cual en `SpdaMalla.positions`/`.indices`. */
export function pesoBytes(mallas: { positions: Float32Array; indices: Uint32Array | null }[]): number {
  return mallas.reduce(
    (acc, m) => acc + m.positions.byteLength + (m.indices?.byteLength ?? 0),
    0,
  );
}

interface EstadoHerramientas {
  opcionesImport: OpcionesImport;

  terreno: MallaRender[] | null;
  terrenoArchivo: string | null;
  importandoTerreno: boolean;
  errorTerreno: string | null;
  /** Triángulos descartados por parecer la cara duplicada de un sólido (0 si no se detectó). */
  terrenoDescartadosPorDuplicado: number;
  /** Unidad que declaró el archivo. Solo STEP la trae; null con STL/OBJ. */
  terrenoUnidadArchivo: string | null;
  /** Avisos del import (por ahora los que produce STEP). */
  terrenoAvisos: string[];

  terrenoDecimado: MallaDecimada[] | null;
  decimando: boolean;
  decimarMs: number | null;
  errorDecimar: string | null;
  /** Fracción (0..1) de vértices a QUITAR respecto del original. */
  fraccionQuitar: number;

  mostrarOriginal: boolean;
  mostrarDecimado: boolean;
  /** Overlay de aristas (wireframe) sobre la malla decimada, para ver la triangulación real. */
  mostrarAristasDecimado: boolean;

  guardando: boolean;
  errorGuardar: string | null;
  guardadoOk: boolean;

  setOpcionesImport: (patch: Partial<OpcionesImport>) => void;
  cargarTerreno: (file: File) => Promise<void>;
  setFraccionQuitar: (f: number) => void;
  decimar: () => void;
  guardarTerreno: (proyectoId: number) => Promise<void>;
  toggle: (k: "mostrarOriginal" | "mostrarDecimado" | "mostrarAristasDecimado") => void;
}

export const useHerramientasStore = create<EstadoHerramientas>((set, get) => ({
  // El default general ya es Z-arriba (CAD), así que acá no hace falta pisarlo.
  // Importa que quede Z: un terreno con el eje al revés no rompe a simple vista
  // (sigue pareciendo una malla válida), pero deforma la relación entre planta
  // y altura y puede trabar la decimación.
  opcionesImport: { ...OPCIONES_IMPORT_POR_DEFECTO },

  terreno: null,
  terrenoArchivo: null,
  importandoTerreno: false,
  errorTerreno: null,
  terrenoDescartadosPorDuplicado: 0,
  terrenoUnidadArchivo: null,
  terrenoAvisos: [],

  terrenoDecimado: null,
  decimando: false,
  decimarMs: null,
  errorDecimar: null,
  fraccionQuitar: 0.9,

  mostrarOriginal: true,
  mostrarDecimado: true,
  mostrarAristasDecimado: false,

  guardando: false,
  errorGuardar: null,
  guardadoOk: false,

  setOpcionesImport: (patch) => set((s) => ({ opcionesImport: { ...s.opcionesImport, ...patch } })),

  cargarTerreno: async (file) => {
    set({ importandoTerreno: true, errorTerreno: null, terrenoDecimado: null, decimarMs: null });
    try {
      const { mallas, descartadosPorDuplicado, unidadArchivo, advertencias } =
        await importarTerrenoCrudo(file, get().opcionesImport);
      set({
        terreno: mallas,
        terrenoArchivo: file.name,
        terrenoDescartadosPorDuplicado: descartadosPorDuplicado,
        terrenoUnidadArchivo: unidadArchivo,
        terrenoAvisos: advertencias,
        importandoTerreno: false,
      });
    } catch (err) {
      set({
        importandoTerreno: false,
        errorTerreno: err instanceof Error ? err.message : String(err),
      });
    }
  },

  setFraccionQuitar: (f) => set({ fraccionQuitar: Math.min(0.99, Math.max(0, f)) }),

  decimar: () => {
    const s = get();
    if (!s.terreno || s.terreno.length === 0) return;
    set({ decimando: true, errorDecimar: null, errorGuardar: null, guardadoOk: false });
    const id = ++jobId;
    const pet: PeticionDecimar = {
      id,
      mallas: s.terreno.map((m) => ({ nombre: m.nombre, positions: m.positions, indices: m.indices })),
      fraccionQuitar: s.fraccionQuitar,
    };
    getWorker().postMessage(pet);
  },

  guardarTerreno: async (proyectoId) => {
    const s = get();
    if (!s.terrenoDecimado || s.terrenoDecimado.length === 0) return;
    if (pesoBytes(s.terrenoDecimado) > PESO_MAX_BYTES) return; // el botón ya debería estar deshabilitado
    set({ guardando: true, errorGuardar: null, guardadoOk: false });
    // A diferencia de los edificios, acá el nombre no lo escribe nadie: se usa
    // el del archivo (mucho más útil que el "stl" que trae la malla) y si ya
    // existe se numera solo, porque no hay campo donde pedirle al usuario que
    // lo cambie.
    const usados = new Set(
      useSpdaStore.getState().mallasGuardadas.filter((m) => m.tipo === "suelo").map((m) => m.nombre),
    );
    const nombreLibre = (base: string) => {
      if (!usados.has(base)) return base;
      let n = 2;
      while (usados.has(`${base} (${n})`)) n++;
      return `${base} (${n})`;
    };
    try {
      for (const m of s.terrenoDecimado) {
        const nombre = nombreLibre(
          s.terrenoDecimado.length > 1 ? `${s.terrenoArchivo ?? m.nombre} · ${m.nombre}` : (s.terrenoArchivo ?? m.nombre),
        );
        usados.add(nombre);
        const res = await apiFetch("/spda-mallas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proyecto_id: proyectoId,
            tipo: "suelo",
            nombre,
            positions: typedArrayABase64(m.positions),
            indices: m.indices ? typedArrayABase64(m.indices) : null,
            // vertices/triangulos NO se mandan: el server los deriva del tamaño
            // real de los buffers (son lo único que devuelve la lista sin bajar
            // la geometría, así que no puede depender de lo que declare el cliente).
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}) as { error?: string });
          throw new Error(body.error || `Error ${res.status} al guardar`);
        }
      }
      set({ guardando: false, guardadoOk: true });
      useSpdaStore.getState().cargarMallasGuardadas(proyectoId);
    } catch (err) {
      set({ guardando: false, errorGuardar: err instanceof Error ? err.message : String(err) });
    }
  },

  toggle: (k) => set((s) => ({ [k]: !s[k] }) as Pick<EstadoHerramientas, typeof k>),
}));

function manejarRespuesta(msg: RespuestaDecimar) {
  const set = useHerramientasStore.setState;
  if (msg.tipo === "error") {
    set({ decimando: false, errorDecimar: msg.mensaje });
    return;
  }
  set({ terrenoDecimado: msg.mallas, decimando: false, decimarMs: msg.ms });
}
