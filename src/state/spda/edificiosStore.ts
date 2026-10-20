/**
 * Estado de "Delimitar edificios": delimitar cada edificio sobre el modelo YA
 * importado en "Importar edificaciones" (`useSpdaStore.modelo` — un solo
 * import compartido, no uno propio). Dos modos:
 *
 *  - "conectividad": un click selecciona el shell conectado de la cara
 *    clickeada y se lleva el edificio entero con su forma real (ver
 *    `seleccionMalla.ts`). Sirve cuando cada edificio es un sólido aparte en el
 *    archivo; no sirve si el archivo trae el edificio partido en muchas piezas.
 *  - "region": se van picando caras y cada una aporta su plano. Los planos
 *    parten el espacio en celdas y el edificio es la unión de las celdas que
 *    algún click marca como interiores (ver `arreglo.ts`); el volumen puede ser
 *    NO CONVEXO y siempre sale CERRADO, porque la superficie es el borde entre
 *    adentro y afuera. Al guardar se persiste ESE VOLUMEN, no el STL recortado:
 *    es lo que produce la metodología, pesa unos pocos kilobytes, y para la
 *    esfera rodante lo que importa es la envolvente.
 */
import { create } from "zustand";
import type { MallaRender } from "@/lib/spda/import/tipos";
import type { Vec3 } from "@/lib/spda/geometry";
import { type Plano } from "@/lib/spda/edificios/convexClip";
import { seleccionarConectados, mallaDeTriangulos } from "@/lib/spda/edificios/seleccionMalla";
import { esMismaCara, volumenDeClicks } from "@/lib/spda/edificios/arreglo";
import { typedArrayABase64 } from "@/lib/spda/base64";
import { apiFetch } from "@/services/apiFetch";
import { useSpdaStore } from "@/state/spda/store";

export type ModoDelimitar = "conectividad" | "region";

/**
 * Un click: el plano de la cara que se tocó y el punto donde se tocó. Se guardan
 * crudos, uno por click; `volumenDeClicks` los agrupa por plano, así una misma
 * cara puede aportar varios puntos (los dos aleros de un techo).
 */
export type CaraPicada = Plano;

interface EstadoEdificios {
  delimitando: boolean;
  modo: ModoDelimitar;
  /** Frenar el flood fill en pliegues cóncavos (solo modo "conectividad"). */
  limitarAngulo: boolean;
  /** Grados: pliegues cóncavos más abiertos que esto cortan la selección. */
  anguloLimite: number;

  bboxDelimitacion: { min: Vec3; max: Vec3 } | null;
  nombreEdificio: string;
  /** Caras picadas del volumen que se está delimitando (modo "region"). */
  piezaActual: CaraPicada[];
  piezasTerminadas: MallaRender[];
  contadorEdificios: number;

  guardando: boolean;
  errorGuardar: string | null;
  guardadoOk: boolean;

  iniciarDelimitacion: () => void;
  cancelarDelimitacion: () => void;
  setModo: (modo: ModoDelimitar) => void;
  setLimitarAngulo: (v: boolean) => void;
  setAnguloLimite: (grados: number) => void;
  seleccionarCara: (malla: MallaRender, triangulo: number) => void;
  agregarPlano: (cara: CaraPicada) => void;
  deshacerPlano: () => void;
  quitarUltimaPieza: () => void;
  setNombreEdificio: (nombre: string) => void;
  guardarEdificio: (proyectoId: number) => Promise<void>;
}

/**
 * Los planos que entran al arreglo: los clickeados MÁS un piso implícito a la
 * cota de tierra.
 *
 * El piso va aparte porque un edificio apoyado en el suelo cierra ahí abajo y
 * esa cara no se puede clickear — queda tapada por el propio edificio. Si el
 * usuario ya picó algo a esa cota no se duplica: dos planos casi coplanares se
 * recortan entre sí y ensucian el arreglo.
 */
export function planosConPiso(caras: CaraPicada[]): CaraPicada[] {
  const s = useSpdaStore.getState();
  if (!s.modelo || caras.length === 0) return caras;
  const cota = s.cotaTierra ?? s.modelo.bounds.min[2];
  const cx = caras.reduce((a, c) => a + c.punto[0], 0) / caras.length;
  const cy = caras.reduce((a, c) => a + c.punto[1], 0) / caras.length;
  const piso: CaraPicada = { punto: [cx, cy, cota], normal: [0, 0, -1] };
  return caras.some((c) => esMismaCara(c, piso)) ? caras : [...caras, piso];
}

/**
 * Volumen cerrado a partir de las caras picadas, listo para guardar.
 *
 * Va por el ARREGLO DE PLANOS (`arreglo.ts`), no por celda-por-cara: se parte el
 * espacio con todos los planos, se decide qué celdas son el edificio (una celda
 * lo es si es el lado `-n` de algún click) y la superficie es el borde entre lo
 * de adentro y lo de afuera. Eso sale cerrado por construcción — el borde de
 * cualquier unión de celdas lo es — y por eso NO puede guardar una figura
 * abierta, que es lo que sí pasaba dibujando la celda de cada cara por separado.
 *
 * `null` cuando los clicks todavía no encierran ningún volumen: ahí faltan
 * caras, y hay que decirlo en vez de guardar algo incompleto.
 */
function volumenDeCaras(
  caras: CaraPicada[],
  bbox: { min: Vec3; max: Vec3 } | null,
): { positions: Float32Array; indices: Uint32Array } | null {
  if (!bbox || caras.length === 0) return null;
  // La MISMA caja que usa el visor (`bboxDelimitacion`): el arreglo depende de
  // ella —las celdas que la tocan son las que cuentan como infinitas— así que
  // con dos cajas distintas lo que se ve y lo que se guarda podrían no coincidir.
  const v = volumenDeClicks(planosConPiso(caras), bbox);
  return v ? { positions: v.positions, indices: v.indices } : null;
}

/** Concatena mallas en una sola (sin soldar entre ellas: son partes separadas). */
export function combinarMallas(
  piezas: MallaRender[],
  nombre: string,
): { nombre: string; positions: Float32Array; indices: Uint32Array } {
  const totalV = piezas.reduce((acc, p) => acc + p.positions.length, 0);
  const totalI = piezas.reduce(
    (acc, p) => acc + (p.indices ? p.indices.length : p.positions.length / 3),
    0,
  );
  const positions = new Float32Array(totalV);
  const indices = new Uint32Array(totalI);
  let vOff = 0;
  let iOff = 0;
  let vertOff = 0;
  for (const p of piezas) {
    positions.set(p.positions, vOff);
    vOff += p.positions.length;
    const n = p.indices ? p.indices.length : p.positions.length / 3;
    for (let i = 0; i < n; i++) indices[iOff + i] = (p.indices ? p.indices[i] : i) + vertOff;
    iOff += n;
    vertOff += p.positions.length / 3;
  }
  return { nombre, positions, indices };
}

export const useEdificiosStore = create<EstadoEdificios>((set, get) => ({
  delimitando: false,
  modo: "conectividad",
  limitarAngulo: false,
  anguloLimite: 60,
  bboxDelimitacion: null,
  nombreEdificio: "Edificio 1",
  piezaActual: [],
  piezasTerminadas: [],
  contadorEdificios: 1,

  guardando: false,
  errorGuardar: null,
  guardadoOk: false,

  iniciarDelimitacion: () => {
    const s = get();
    const modelo = useSpdaStore.getState().modelo;
    if (!modelo || modelo.mallas.length === 0) return;
    const b = modelo.bounds;
    const pad = Math.max(2, (b.max[0] - b.min[0] + (b.max[1] - b.min[1]) + (b.max[2] - b.min[2])) / 3);
    // Si ya hay edificios guardados, el default no repite su número (el usuario
    // igual puede editarlo a mano).
    const existentes = useSpdaStore.getState().mallasGuardadas.filter((m) => m.tipo === "edificio").length;
    const contadorEdificios = Math.max(s.contadorEdificios, existentes + 1);
    set({
      delimitando: true,
      bboxDelimitacion: {
        min: [b.min[0] - pad, b.min[1] - pad, b.min[2] - pad],
        max: [b.max[0] + pad, b.max[1] + pad, b.max[2] + pad],
      },
      piezaActual: [],
      piezasTerminadas: [],
      nombreEdificio: `Edificio ${contadorEdificios}`,
      contadorEdificios,
      errorGuardar: null,
      guardadoOk: false,
    });
  },

  cancelarDelimitacion: () =>
    set({ delimitando: false, bboxDelimitacion: null, piezaActual: [], piezasTerminadas: [] }),

  setModo: (modo) => set({ modo, piezaActual: [], errorGuardar: null }),

  setLimitarAngulo: (limitarAngulo) => set({ limitarAngulo }),

  setAnguloLimite: (grados) => set({ anguloLimite: Math.min(179, Math.max(1, grados)) }),

  /** Modo "conectividad": un click agrega el shell conectado como una pieza más. */
  seleccionarCara: (malla, triangulo) => {
    const s = get();
    const tris = seleccionarConectados(malla, triangulo, s.limitarAngulo ? s.anguloLimite : null);
    if (tris.length === 0) return;
    const pieza = mallaDeTriangulos(malla, tris, `pieza-${s.piezasTerminadas.length + 1}`);
    set((st) => ({ piezasTerminadas: [...st.piezasTerminadas, pieza], errorGuardar: null }));
  },

  /**
   * Modo "region": cada click suma un punto al volumen que se está definiendo.
   *
   * Se guardan los clicks CRUDOS, uno por click, y `volumenDeClicks` los agrupa
   * por plano. Volver a clickear la misma cara en otro lugar sí sirve y deja su
   * propio marcador: los dos aleros de un techo comparten el plano pero son dos
   * trozos separados, cada uno en su celda, y cada uno necesita su punto.
   */
  agregarPlano: (plano) => set((s) => ({ piezaActual: [...s.piezaActual, plano], errorGuardar: null })),

  deshacerPlano: () => set((s) => ({ piezaActual: s.piezaActual.slice(0, -1), errorGuardar: null })),

  quitarUltimaPieza: () => set((s) => ({ piezasTerminadas: s.piezasTerminadas.slice(0, -1) })),

  setNombreEdificio: (nombreEdificio) => set({ nombreEdificio }),

  guardarEdificio: async (proyectoId) => {
    const s = get();
    let piezas = s.piezasTerminadas;

    if (s.piezaActual.length > 0) {
      const volumen = volumenDeCaras(s.piezaActual, s.bboxDelimitacion);
      if (!volumen) {
        set({
          errorGuardar:
            "Los planos que picaste todavía no encierran ningún volumen: faltan caras. En el visor vas a ver el sólido recién cuando cierre.",
        });
        return;
      }
      piezas = [...piezas, { nombre: `pieza-${piezas.length + 1}`, ...volumen }];
    }
    if (piezas.length === 0) {
      set({ errorGuardar: "No delimitaste nada todavía — hacé click sobre el edificio en el visor." });
      return;
    }
    // El nombre lo escribe el usuario y tiene el campo a la vista, así que si
    // choca se le pide que lo cambie en vez de guardar dos filas indistinguibles.
    const repetido = useSpdaStore
      .getState()
      .mallasGuardadas.some((m) => m.tipo === "edificio" && m.nombre === s.nombreEdificio);
    if (repetido) {
      set({ errorGuardar: `Ya hay un edificio guardado con el nombre "${s.nombreEdificio}".` });
      return;
    }
    set({ guardando: true, errorGuardar: null, guardadoOk: false });

    const { positions, indices } = combinarMallas(piezas, s.nombreEdificio);

    try {
      const res = await apiFetch("/spda-mallas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          tipo: "edificio",
          nombre: s.nombreEdificio,
          positions: typedArrayABase64(positions),
          indices: typedArrayABase64(indices),
          // vertices/triangulos los deriva el server del tamaño de los buffers.
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(body.error || `Error ${res.status} al guardar`);
      }
      set((st) => ({
        guardando: false,
        guardadoOk: true,
        delimitando: false,
        bboxDelimitacion: null,
        piezaActual: [],
        piezasTerminadas: [],
        contadorEdificios: st.contadorEdificios + 1,
      }));
      useSpdaStore.getState().cargarMallasGuardadas(proyectoId);
    } catch (err) {
      set({ guardando: false, errorGuardar: err instanceof Error ? err.message : String(err) });
    }
  },
}));

// Delimitar un edificio es difícil de verificar desde afuera: lo único que se
// ve en el DOM es un contador, y los planos viven en un canvas WebGL. Exponer
// el store en desarrollo permite leer las caras picadas desde la consola o
// desde un script de Playwright, que es como se depuran los casos que no
// cierran. No sale en producción.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __edificios?: typeof useEdificiosStore }).__edificios = useEdificiosStore;
}
