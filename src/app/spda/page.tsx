"use client";

/**
 * Ruta /spda: cálculo de superficies de protección atmosférica (SPDA / LPS) por
 * el método de la esfera rodante (IEC 62305-3), portado del spike standalone en
 * `D:\ElectricApp\Sdpa`. Layout: panel lateral, visor 3D y una barra inferior
 * con los resultados y las vistas 2D — igual que el original, encajado bajo el
 * navbar de Front en vez de ocupar toda la ventana.
 *
 * El panel lateral no usa pestañas (las dos secciones nunca conviven a la
 * vista): por defecto se ve "Diseño" (`Panel.tsx`) con un botón chico a la
 * derecha para entrar a "Importar modelo" (herramientas de desarrollo sobre
 * mallas, con sus propias sub-secciones — hoy solo "Importar suelo", ver
 * `PanelImportarModelo.tsx`); adentro, una flecha "← Volver" a la izquierda
 * regresa a Diseño. La navegación en sí es estado local del componente (qué se
 * ve en el sidebar) y no vive en ningún store, pero "← Volver" además DESCARTA
 * el modelo importado: el import es andamio para delimitar y guardar edificios,
 * y Diseño trabaja con las mallas de la base.
 *
 * `?demo[=archivo.obj]` carga un ejemplo de `public/` al abrir (ver `useDemo`).
 * TODO: reemplazar `public/ejemplo-*.obj` propios de Sdpa si se quiere mantener
 * esta demo acá — todavía no se copiaron a `Front/public/`.
 */
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Panel from "@/components/spda/Panel";
import PanelImportarModelo from "@/components/spda/PanelImportarModelo";
import Resultados from "@/components/spda/Resultados";
import Vistas2D from "@/components/spda/Vistas2D";
import { useSpdaStore } from "@/state/spda/store";

// react-three-fiber usa WebGL: nada de SSR para el visor.
const Escena3D = dynamic(() => import("@/components/spda/Escena3D"), { ssr: false });

/** ?demo[=archivo] carga un ejemplo de public/ al abrir (por defecto ejemplo-nave.obj). */
function useDemo() {
  const cargarArchivo = useSpdaStore((s) => s.cargarArchivo);
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    const q = new URLSearchParams(location.search);
    if (!q.has("demo")) return;
    hecho.current = true;
    const archivo = q.get("demo") || "ejemplo-nave.obj";
    fetch(`/${archivo}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => cargarArchivo(new File([b], archivo)))
      .catch(() => undefined);
  }, [cargarArchivo]);
}

type Seccion = "diseno" | "importar-modelo";

export default function SpdaPage() {
  const progreso = useSpdaStore((s) => s.progreso);
  const [seccion, setSeccion] = useState<Seccion>("diseno");
  useDemo();

  return (
    <div className="h-[calc(100vh-3rem)] grid grid-cols-[1fr_320px] grid-rows-[1fr_auto] bg-surface-a0 text-font-a0">
      <main className="relative min-h-0 col-start-1 row-start-1">
        <Escena3D />
        {progreso && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-a0/60 text-sm">
            {progreso.fase === "envolvente" ? "Extrayendo envolvente" : "Calculando esfera rodante"}
            … {Math.round(progreso.frac * 100)}%
          </div>
        )}
      </main>
      <aside className="col-start-2 row-start-1 row-span-2 bg-surface-tonal-a0 border-l border-surface-tonal-a20 overflow-y-auto flex flex-col">
        {seccion === "importar-modelo" && (
          <div className="flex items-center p-2 border-b border-surface-tonal-a20 shrink-0">
            <button
              onClick={() => {
                // El import es andamio para delimitar y guardar los edificios;
                // Diseño trabaja con las mallas guardadas. Si el modelo
                // sobrevive a la salida, la estructura queda duplicada en el
                // visor y en el cálculo (el STL crudo más el edificio guardado).
                useSpdaStore.getState().descartarModelo();
                setSeccion("diseno");
              }}
              className="text-xs px-2.5 py-1.5 rounded-md text-surface-tonal-a40 hover:text-font-a0 hover:bg-surface-tonal-a10 transition-colors"
            >
              ← Volver
            </button>
          </div>
        )}
        <div className="p-3.5 overflow-y-auto">
          {seccion === "diseno" ? (
            <Panel onIrAImportar={() => setSeccion("importar-modelo")} />
          ) : (
            <PanelImportarModelo />
          )}
        </div>
      </aside>
      <footer className="col-start-1 row-start-2 bg-surface-tonal-a0 border-t border-surface-tonal-a20 px-3.5 py-2.5 flex gap-5 items-stretch flex-wrap">
        <Resultados />
        <Vistas2D />
      </footer>
    </div>
  );
}
