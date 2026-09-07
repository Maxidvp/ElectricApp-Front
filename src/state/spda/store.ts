/**
 * Estado global (zustand) y orquestación de los dos Web Workers.
 *
 * Es la única capa que conoce a la vez el modelo importado, los captadores
 * definidos a mano y los resultados del cálculo. Todo lo pesado se delega:
 *
 *   calculo.worker    → evaluar la nube de puntos y extraer la envolvente
 *   exportCad.worker  → construir los sólidos B-rep y exportar STEP
 *
 * Ambos se crean perezosamente (`getWorker` / `getExportWorker`) y se reusan; el
 * de export además carga ~23 MB de WASM la primera vez, así que conviene no
 * instanciarlo hasta que haga falta. Las respuestas llegan por `onmessage` y se
 * vuelcan al estado en `manejarRespuesta` / `manejarRespuestaExport`, que es
 * también donde se dispara la descarga del archivo.
 *
 * Cada petición lleva un `id` incremental: si el usuario cambia algo mientras
 * corre un cálculo, la respuesta vieja se descarta al llegar.
 *
 * OJO: `radioEfectivo()` y `sistema()` son funciones, no valores. Al usarlas
 * como selector (`useStore((s) => s.radioEfectivo())`) se recalculan en cada
 * render, que para estos casos es barato y evita estado derivado desincronizado.
 *
 * Portado de Sdpa (spike standalone) a Front: única diferencia real son las
 * rutas de import (`@/lib/spda/...`, `@/workers/spda/...`).
 */

import { create } from "zustand";
import {
  NIVELES_PROTECCION,
  type NPR,
} from "@/lib/spda/iec62305";
import type { Conductor, Mastil, SistemaCaptacion, Vec3 } from "@/lib/spda/geometry";
import { CONFIG_POR_DEFECTO, type ConfigCalculo, type ResultadoModelo } from "@/lib/spda/rollingSphere";
import type { MallaISO } from "@/lib/spda/marchingCubes";
import {
  importarArchivo,
  ejeVerticalPorDefecto,
  OPCIONES_IMPORT_POR_DEFECTO,
  type ModeloImportado,
  type OpcionesImport,
} from "@/lib/spda/import";
import type { PeticionWorker, RespuestaWorker } from "@/workers/spda/calculo.worker";
import { construirGeometriaExport } from "@/lib/spda/exportCad/geometria";
import type { PeticionExportCad, RespuestaExportCad } from "@/workers/spda/exportCad.worker";

let worker: Worker | null = null;
let jobId = 0;
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../../workers/spda/calculo.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (ev: MessageEvent<RespuestaWorker>) => manejarRespuesta(ev.data);
  }
  return worker;
}

let exportWorker: Worker | null = null;
let exportJobId = 0;
function getExportWorker(): Worker {
  if (!exportWorker) {
    exportWorker = new Worker(new URL("../../workers/spda/exportCad.worker.ts", import.meta.url), {
      type: "module",
    });
    exportWorker.onmessage = (ev: MessageEvent<RespuestaExportCad>) => manejarRespuestaExport(ev.data);
  }
  return exportWorker;
}

interface Estado {
  npr: NPR;
  radioManual: number | null;
  config: Omit<ConfigCalculo, "radio" | "cotaTierra">;

  mastiles: Mastil[];
  conductores: Conductor[];
  cotaTierra: number | null;

  modelo: ModeloImportado | null;
  ultimoArchivo: File | null;
  opcionesImport: OpcionesImport;
  importando: boolean;
  errorImport: string | null;

  resultado: ResultadoModelo | null;
  envolvente: MallaISO | null;
  calculando: boolean;
  progreso: { fase: string; frac: number } | null;

  seleccionId: string | null;
  mostrarEnvolvente: boolean;
  mostrarEsfera: boolean;
  mostrarZonas: boolean;
  mostrarEsferasEntre: boolean;
  mostrarSuelo: boolean;
  mostrarSeccion: boolean;

  /**
   * Altura de circulación peatonal (m sobre el suelo) a la que se corta el
   * volumen protegido. 1.8 m es el criterio más habitual; algunas obras usan 2 m.
   */
  alturaSeccion: number;

  exportandoCAD: boolean;
  errorExportCAD: string | null;

  // acciones
  setNPR: (npr: NPR) => void;
  setRadioManual: (r: number | null) => void;
  setAlturaSeccion: (h: number) => void;
  radioEfectivo: () => number;
  sistema: () => SistemaCaptacion;

  addMastil: (base: Vec3, altura: number) => void;
  updateMastil: (id: string, patch: Partial<Omit<Mastil, "id" | "tipo">>) => void;
  removeElemento: (id: string) => void;
  setSeleccion: (id: string | null) => void;

  cargarArchivo: (file: File) => Promise<void>;
  reimportar: () => Promise<void>;
  setOpcionesImport: (patch: Partial<OpcionesImport>) => void;

  calcular: () => void;
  calcularEnvolvente: (resolucion?: number) => void;
  exportarCAD: () => void;
  toggle: (
    k:
      | "mostrarEnvolvente"
      | "mostrarEsfera"
      | "mostrarSeccion"
      | "mostrarZonas"
      | "mostrarEsferasEntre"
      | "mostrarSuelo",
  ) => void;
}

export const useSpdaStore = create<Estado>((set, get) => ({
  npr: "II",
  radioManual: null,
  config: { ...CONFIG_POR_DEFECTO },

  mastiles: [],
  conductores: [],
  cotaTierra: 0,

  modelo: null,
  ultimoArchivo: null,
  opcionesImport: { ...OPCIONES_IMPORT_POR_DEFECTO },
  importando: false,
  errorImport: null,

  resultado: null,
  envolvente: null,
  calculando: false,
  progreso: null,

  seleccionId: null,
  mostrarEnvolvente: true,
  mostrarEsfera: false,
  mostrarZonas: true,
  mostrarEsferasEntre: true,
  mostrarSuelo: true,
  mostrarSeccion: true,
  alturaSeccion: 1.8,

  exportandoCAD: false,
  errorExportCAD: null,

  setNPR: (npr) => set({ npr, radioManual: null }),
  setRadioManual: (radioManual) => set({ radioManual }),
  setAlturaSeccion: (alturaSeccion) => set({ alturaSeccion: Math.max(0, alturaSeccion) }),
  radioEfectivo: () => get().radioManual ?? NIVELES_PROTECCION[get().npr].radioEsfera,
  sistema: () => ({
    elementos: [...get().mastiles, ...get().conductores],
    cotaTierra: get().cotaTierra,
  }),

  addMastil: (base, altura) =>
    set((s) => ({
      mastiles: [
        ...s.mastiles,
        { id: `m-${Date.now().toString(36)}`, tipo: "mastil", base, altura },
      ],
    })),
  updateMastil: (id, patch) =>
    set((s) => ({
      mastiles: s.mastiles.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  removeElemento: (id) =>
    set((s) => ({
      mastiles: s.mastiles.filter((m) => m.id !== id),
      conductores: s.conductores.filter((c) => c.id !== id),
      seleccionId: s.seleccionId === id ? null : s.seleccionId,
    })),
  setSeleccion: (seleccionId) => set({ seleccionId }),

  cargarArchivo: async (file) => {
    const opciones: OpcionesImport = {
      ...get().opcionesImport,
      ejeVertical: ejeVerticalPorDefecto(file.name),
    };
    await aplicarImport(file, opciones);
  },
  reimportar: async () => {
    const { ultimoArchivo, opcionesImport } = get();
    if (ultimoArchivo) await aplicarImport(ultimoArchivo, opcionesImport);
  },
  setOpcionesImport: (patch) =>
    set((s) => ({ opcionesImport: { ...s.opcionesImport, ...patch } })),

  calcular: () => {
    const s = get();
    if (!s.modelo || s.modelo.puntosEstructura.length === 0) return;
    set({ calculando: true, progreso: { fase: "evaluar", frac: 0 } });
    const id = ++jobId;
    const pet: PeticionWorker = {
      tipo: "evaluar",
      id,
      puntos: s.modelo.puntosEstructura,
      sistema: s.sistema(),
      cfg: { ...s.config, radio: s.radioEfectivo(), cotaTierra: s.cotaTierra },
    };
    getWorker().postMessage(pet);
  },

  calcularEnvolvente: (resolucion = 40) => {
    const s = get();
    if (!s.modelo) return;
    const { min, max } = s.modelo.bounds;
    const R = s.radioEfectivo();
    const bounds = {
      min: [min[0] - R, min[1] - R, Math.min(s.cotaTierra ?? 0, min[2])] as Vec3,
      max: [max[0] + R, max[1] + R, max[2] + R] as Vec3,
    };
    const span = [
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2],
    ];
    const mx = Math.max(...span);
    const dims: [number, number, number] = [
      Math.max(8, Math.round((span[0] / mx) * resolucion)),
      Math.max(8, Math.round((span[1] / mx) * resolucion)),
      Math.max(8, Math.round((span[2] / mx) * resolucion)),
    ];
    set({ calculando: true, progreso: { fase: "envolvente", frac: 0 } });
    const id = ++jobId;
    const pet: PeticionWorker = {
      tipo: "envolvente",
      id,
      bounds,
      dims,
      sistema: s.sistema(),
      cfg: { ...s.config, radio: R, cotaTierra: s.cotaTierra },
    };
    getWorker().postMessage(pet);
  },

  exportarCAD: () => {
    const s = get();
    const hayPuntas = s.mastiles.some((m) => m.base[2] + m.altura - (s.cotaTierra ?? 0) > 0.01);
    if (!hayPuntas) {
      set({ errorExportCAD: "No hay puntas con altura > 0: agregá al menos un mástil." });
      return;
    }
    set({ exportandoCAD: true, errorExportCAD: null });
    const construccion = construirGeometriaExport(s.mastiles, s.radioEfectivo(), s.cotaTierra ?? 0);
    const pet: PeticionExportCad = {
      id: ++exportJobId,
      construccion,
      alturaSeccion: s.mostrarSeccion ? s.alturaSeccion : undefined,
    };
    getExportWorker().postMessage(pet);
  },

  toggle: (k) => set((s) => ({ [k]: !s[k] }) as Pick<Estado, typeof k>),
}));

function manejarRespuesta(msg: RespuestaWorker) {
  const set = useSpdaStore.setState;
  switch (msg.tipo) {
    case "progreso":
      set({ progreso: { fase: msg.fase, frac: msg.frac } });
      break;
    case "evaluar:ok":
      set({ resultado: msg.resultado, calculando: false, progreso: null });
      break;
    case "envolvente:ok":
      set({ envolvente: msg.malla, calculando: false, progreso: null });
      break;
    case "error":
      set({ calculando: false, progreso: null, errorImport: msg.mensaje });
      break;
  }
}

function manejarRespuestaExport(msg: RespuestaExportCad) {
  const set = useSpdaStore.setState;
  if (msg.tipo === "error") {
    set({ exportandoCAD: false, errorExportCAD: msg.mensaje });
    return;
  }
  const blob = new Blob([msg.bytes], { type: "application/step" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = msg.nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  set({ exportandoCAD: false });
}

async function aplicarImport(file: File, opciones: OpcionesImport) {
  const set = useSpdaStore.setState;
  set({ importando: true, errorImport: null });
  try {
    const modelo = await importarArchivo(file, opciones);
    const traeCaptacion = modelo.mastiles.length > 0 || modelo.conductores.length > 0;
    set((s) => ({
      modelo,
      ultimoArchivo: file,
      // Si el archivo declaró su unidad, el selector pasa a reflejarla.
      opcionesImport: modelo.unidadDetectada
        ? { ...opciones, unidad: modelo.unidadDetectada }
        : opciones,
      // Las mallas no traen captación: se conserva lo que el usuario cargó a mano.
      mastiles: traeCaptacion ? modelo.mastiles : s.mastiles,
      conductores: traeCaptacion ? modelo.conductores : s.conductores,
      cotaTierra: modelo.cotaTierra,
      resultado: null,
      envolvente: null,
      importando: false,
    }));
  } catch (err) {
    set({ importando: false, errorImport: err instanceof Error ? err.message : String(err) });
  }
}
