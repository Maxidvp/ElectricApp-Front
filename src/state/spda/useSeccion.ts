/**
 * Hook de la sección horizontal a la altura de circulación configurada.
 *
 * La piden tres lugares a la vez (visor 3D, planta 2D y el área del panel), así
 * que se cachea a nivel de MÓDULO —no con `useMemo`, que sería una caché por
 * componente— y se recalcula solo cuando cambian mástiles, radio, cota o altura.
 * El cálculo es puro TS (marching squares sobre el campo analítico), no necesita
 * el worker ni el WASM.
 */
import { useSpdaStore } from "@/state/spda/store";
import { construirGeometriaExport } from "@/lib/spda/exportCad/geometria";
import { seccionAAltura, type Seccion } from "@/lib/spda/seccionAltura";
import type { Mastil } from "@/lib/spda/geometry";

let cache: { clave: string; valor: Seccion | null } | null = null;

function calcular(
  mastiles: Mastil[],
  radio: number,
  cota: number,
  altura: number,
): Seccion | null {
  if (!(altura > 0)) return null;
  const construccion = construirGeometriaExport(mastiles, radio, cota);
  if (construccion.conos.length === 0) return null;
  return seccionAAltura(construccion, radio, cota, altura);
}

/** Sección del volumen protegido a la altura de circulación configurada. */
export function useSeccion(): Seccion | null {
  const mastiles = useSpdaStore((s) => s.mastiles);
  const cotaTierra = useSpdaStore((s) => s.cotaTierra);
  const radio = useSpdaStore((s) => s.radioEfectivo());
  const altura = useSpdaStore((s) => s.alturaSeccion);

  const cota = cotaTierra ?? 0;
  const clave = JSON.stringify([mastiles, radio, cota, altura]);
  if (cache?.clave !== clave) {
    cache = { clave, valor: calcular(mastiles, radio, cota, altura) };
  }
  return cache.valor;
}
