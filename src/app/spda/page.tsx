"use client";

/**
 * Ruta /spda: cálculo de superficies de protección atmosférica (SPDA / LPS) por
 * el método de la esfera rodante (IEC 62305-3), portado del spike standalone en
 * `D:\ElectricApp\Sdpa`. Layout: panel lateral, visor 3D y una barra inferior
 * con los resultados y las vistas 2D — igual que el original, encajado bajo el
 * navbar de Front en vez de ocupar toda la ventana.
 *
 * `?demo[=archivo.dxf]` carga un ejemplo de `public/` al abrir (ver `useDemo`).
 * TODO: reemplazar `public/ejemplo-*.dxf` propios de Sdpa si se quiere mantener
 * esta demo acá — todavía no se copiaron a `Front/public/`.
 */
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Panel from "@/components/spda/Panel";
import Resultados from "@/components/spda/Resultados";
import Vistas2D from "@/components/spda/Vistas2D";
import { useSpdaStore } from "@/state/spda/store";

// react-three-fiber usa WebGL: nada de SSR para el visor.
const Escena3D = dynamic(() => import("@/components/spda/Escena3D"), { ssr: false });

/** ?demo[=archivo] carga un ejemplo de public/ al abrir (por defecto ejemplo-nave.dxf). */
function useDemo() {
  const cargarArchivo = useSpdaStore((s) => s.cargarArchivo);
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    const q = new URLSearchParams(location.search);
    if (!q.has("demo")) return;
    hecho.current = true;
    const archivo = q.get("demo") || "ejemplo-nave.dxf";
    fetch(`/${archivo}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => cargarArchivo(new File([b], archivo)))
      .catch(() => undefined);
  }, [cargarArchivo]);
}

export default function SpdaPage() {
  const progreso = useSpdaStore((s) => s.progreso);
  useDemo();

  return (
    <div className="h-[calc(100vh-3rem)] grid grid-cols-[320px_1fr] grid-rows-[1fr_auto] bg-surface-a0 text-font-a0">
      <aside className="row-span-2 bg-surface-tonal-a0 border-r border-surface-tonal-a20 overflow-y-auto p-3.5">
        <Panel />
      </aside>
      <main className="relative min-h-0">
        <Escena3D />
        {progreso && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-a0/60 text-sm">
            {progreso.fase === "envolvente" ? "Extrayendo envolvente" : "Calculando esfera rodante"}
            … {Math.round(progreso.frac * 100)}%
          </div>
        )}
      </main>
      <footer className="bg-surface-tonal-a0 border-t border-surface-tonal-a20 px-3.5 py-2.5 flex gap-5 items-stretch flex-wrap">
        <Resultados />
        <Vistas2D />
      </footer>
    </div>
  );
}
