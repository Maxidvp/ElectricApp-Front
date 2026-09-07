/**
 * Descripción geométrica pura (sin THREE ni replicad) del volumen protegido
 * analítico —conos por punta + segmentos esféricos entre puntas— lista para
 * construir sólidos CAD. Reusa exactamente la misma matemática que el visor 3D
 * (`rollingSphere.ts`, `construccionEsfera.ts`), así lo que se exporta es lo
 * mismo que se ve.
 *
 * No incluye la envolvente numérica (marching cubes): esa es una aproximación
 * por vóxeles sin forma analítica exportable como sólido limpio.
 */

import type { Mastil } from "../geometry";
import type { Vec3 } from "../geometry";
import { arcoZonaPunta, radioProteccionSuelo } from "../rollingSphere";
import {
  construccionMultiPunta,
  planosRecorteCono,
  separadoresDeEsfera,
  type ConoInfo,
  type EsferaContacto,
  type PlanoRecorte,
} from "../construccionEsfera";

export interface ConoExport {
  id: string;
  /** Base de la punta (pie del cono) en el suelo. */
  base: Vec3;
  /** Altura efectiva usada por el arco (mín(h, r)) y el radio en el pie. */
  hEff: number;
  rp: number;
  /** Punto interior del arco punta→suelo, para definirlo con 3 puntos. */
  arcoMedio: { r: number; z: number };
  /** Cuñas a recortar: cada una son 2 semiespacios cuya intersección se resta. */
  cortes: [PlanoRecorte, PlanoRecorte][];
}

export interface SegmentoExport {
  id: string;
  tipo: EsferaContacto["tipo"];
  centro: Vec3;
  radio: number;
  /**
   * Semiespacios cuya intersección da el volumen a conservar: piso, techo,
   * y un plano por arista — punta–tangencia (cono vecino, sin cambios) o
   * bisector contra cada esfera vecina que comparte esa arista punta–punta
   * (ver `separadoresDeEsfera`). Cortan el prisma exacto donde debe cortar,
   * sin pisar ni dejar hueco contra el vecino real.
   */
  planos: PlanoRecorte[];
  /** Cota del plano de tierra (para identificar la cara de piso real). */
  cota: number;
}

export interface ConstruccionExport {
  conos: ConoExport[];
  segmentos: SegmentoExport[];
}

/** Puntas con altura > 0 sobre el suelo, con los datos que hacen falta para el cono. */
function puntasConAltura(
  mastiles: Mastil[],
  R: number,
  cota: number,
): (ConoInfo & { id: string; base: Vec3 })[] {
  return mastiles
    .filter((m) => m.base[2] + m.altura - cota > 0.01)
    .map((m) => {
      const h = m.base[2] + m.altura - cota;
      return {
        id: m.id,
        base: [m.base[0], m.base[1], cota] as Vec3,
        x: m.base[0],
        y: m.base[1],
        h,
        rp: radioProteccionSuelo(R, h),
      };
    });
}

export function construirGeometriaExport(
  mastiles: Mastil[],
  R: number,
  cota: number,
): ConstruccionExport {
  const puntas = puntasConAltura(mastiles, R, cota);

  const conos: ConoExport[] = puntas.map((c) => {
    const arco = arcoZonaPunta(R, c.h);
    const cortes: [PlanoRecorte, PlanoRecorte][] = [];
    for (const o of puntas) {
      if (o.id === c.id) continue;
      const par = planosRecorteCono(c, o, R, cota);
      if (par) cortes.push(par);
    }
    return {
      id: c.id,
      base: c.base,
      hEff: arco.hEff,
      rp: arco.rp,
      arcoMedio: arco.medio,
      cortes,
    };
  });

  const puntas3D: Vec3[] = puntas.map((p) => [p.x, p.y, p.base[2] + p.h]);
  const esferas = puntas.length >= 2 ? construccionMultiPunta(puntas3D, R, cota) : [];
  const segmentos: SegmentoExport[] = esferas.map((e, i) => ({
    id: `${e.tipo}-${e.puntas.join("-")}-${i}`,
    tipo: e.tipo,
    centro: e.centro,
    radio: e.radio,
    planos: separadoresDeEsfera(e),
    cota,
  }));

  return { conos, segmentos };
}
