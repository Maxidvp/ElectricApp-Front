/**
 * Vistas 2D auxiliares en SVG, derivadas de la misma matemática que el visor 3D
 * (`perfilZonaPunta` / `radioProteccionSuelo`), no de una captura del canvas:
 *
 *   Planta  — huella de los conos (radio `rp`) + contorno protegido a la altura
 *             de circulación, para ver de un vistazo cuánto se achica.
 *   Sección — perfil del cono por punta con la esfera rodante de referencia y la
 *             línea punteada del plano de corte.
 *
 * Las coordenadas SVG llevan la Y negada porque en SVG crece hacia abajo.
 */
import { useMemo } from "react";
import { useSpdaStore } from "@/state/spda/store";
import { useSeccion } from "@/state/spda/useSeccion";
import type { Vec3 } from "@/lib/spda/geometry";
import { perfilZonaPunta, radioProteccionSuelo } from "@/lib/spda/rollingSphere";

const AZUL = "#5aa9ff";
const AZUL_FILL = "rgba(90,169,255,0.12)";

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function useBox(): Box | null {
  const modelo = useSpdaStore((s) => s.modelo);
  return useMemo(() => {
    if (!modelo) return null;
    const { min, max } = modelo.bounds;
    return { minX: min[0], minY: min[1], maxX: max[0], maxY: max[1] };
  }, [modelo]);
}

function Planta() {
  const modelo = useSpdaStore((s) => s.modelo);
  const mastiles = useSpdaStore((s) => s.mastiles);
  const conductores = useSpdaStore((s) => s.conductores);
  const R = useSpdaStore((s) => s.radioEfectivo());
  const cota = useSpdaStore((s) => s.cotaTierra) ?? 0;
  const mostrarSeccion = useSpdaStore((s) => s.mostrarSeccion);
  const seccion = useSeccion();
  const box = useBox();
  if (!modelo || !box) return null;

  const pad = R + 2;
  const vb = `${box.minX - pad} ${-(box.maxY + pad)} ${box.maxX - box.minX + 2 * pad} ${
    box.maxY - box.minY + 2 * pad
  }`;
  const line = (pts: Vec3[]) => pts.map((p) => `${p[0]},${-p[1]}`).join(" ");

  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" className="w-full h-[150px] bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md">
      {modelo.lineasEstructura.map((l, i) => (
        <polyline key={"e" + i} points={line(l)} fill="none" stroke="#8a97a6" strokeWidth={0.15} />
      ))}
      {conductores.map((c, i) => (
        <polyline key={"c" + i} points={line(c.puntos)} fill="none" stroke="#4da3ff" strokeWidth={0.2} />
      ))}
      {mastiles.map((m) => {
        const rp = radioProteccionSuelo(R, m.base[2] + m.altura - cota);
        if (rp <= 0) return null;
        // Huella del cono = círculo de radio rp (proyección del sólido de revolución).
        return (
          <g key={m.id}>
            <circle
              cx={m.base[0]}
              cy={-m.base[1]}
              r={rp}
              fill={AZUL_FILL}
              stroke={AZUL}
              strokeWidth={0.15}
            />
            <circle cx={m.base[0]} cy={-m.base[1]} r={0.4} fill="#ffb648" />
          </g>
        );
      })}
      {/* Contorno protegido a la altura de circulación, sobre la huella al piso. */}
      {mostrarSeccion &&
        seccion?.contornos.map((anillo, i) => (
          <polygon
            key={"s" + i}
            points={anillo.map(([x, y]) => `${x},${-y}`).join(" ")}
            fill="none"
            stroke="#ffd166"
            strokeWidth={0.25}
          />
        ))}
    </svg>
  );
}

function Seccion() {
  const modelo = useSpdaStore((s) => s.modelo);
  const mastiles = useSpdaStore((s) => s.mastiles);
  const R = useSpdaStore((s) => s.radioEfectivo());
  const cota = useSpdaStore((s) => s.cotaTierra) ?? 0;
  const mostrarSeccion = useSpdaStore((s) => s.mostrarSeccion);
  const alturaSeccion = useSpdaStore((s) => s.alturaSeccion);
  const box = useBox();
  if (!modelo || !box) return null;

  const maxZ = modelo.bounds.max[2];
  const pad = R + 2;
  const vb = `${box.minX - pad} ${-(maxZ + R + 2)} ${box.maxX - box.minX + 2 * pad} ${
    maxZ + R + 4 - cota
  }`;

  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" className="w-full h-[150px] bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md">
      {/* estructura proyectada */}
      {modelo.lineasEstructura.map((l, i) => (
        <polyline
          key={"e" + i}
          points={l.map((p) => `${p[0]},${-p[2]}`).join(" ")}
          fill="none"
          stroke="#3a4553"
          strokeWidth={0.12}
        />
      ))}
      {/* suelo (plano XY) */}
      <line
        x1={box.minX - pad}
        y1={-cota}
        x2={box.maxX + pad}
        y2={-cota}
        stroke="#8a97a6"
        strokeWidth={0.25}
      />
      {/* plano de circulación: dónde se toma la sección */}
      {mostrarSeccion && alturaSeccion > 0 && (
        <line
          x1={box.minX - pad}
          y1={-(cota + alturaSeccion)}
          x2={box.maxX + pad}
          y2={-(cota + alturaSeccion)}
          stroke="#ffd166"
          strokeWidth={0.2}
          strokeDasharray="1.5 1"
        />
      )}
      {mastiles.map((m) => {
        const tipZ = m.base[2] + m.altura; // punta real
        const h = tipZ - cota; // altura sobre el plano de tierra
        if (h <= 0.01) return null;
        const perfil = perfilZonaPunta(R, h); // (r, z) con z medido desde el suelo
        const rp = radioProteccionSuelo(R, h);

        // Contorno del cono a cada lado: eje → punta → arco → suelo.
        const lado = (signo: 1 | -1) =>
          perfil.map((p) => `${m.base[0] + signo * p.r},${-(cota + p.z)}`).join(" ");

        return (
          <g key={m.id}>
            {/* esfera rodante de referencia (tenue) */}
            <circle
              cx={m.base[0] + rp}
              cy={-(cota + R)}
              r={R}
              fill="none"
              stroke="#4da3ff"
              strokeOpacity={0.35}
              strokeWidth={0.12}
              strokeDasharray="1 1.5"
            />
            <circle
              cx={m.base[0] - rp}
              cy={-(cota + R)}
              r={R}
              fill="none"
              stroke="#4da3ff"
              strokeOpacity={0.35}
              strokeWidth={0.12}
              strokeDasharray="1 1.5"
            />
            {/* zona protegida rellena + contorno */}
            <polygon
              points={`${lado(-1)} ${[...perfil]
                .reverse()
                .map((p) => `${m.base[0] + p.r},${-(cota + p.z)}`)
                .join(" ")}`}
              fill={AZUL_FILL}
              stroke={AZUL}
              strokeWidth={0.15}
            />
            {/* punta captadora (del suelo a la punta real) */}
            <line
              x1={m.base[0]}
              y1={-cota}
              x2={m.base[0]}
              y2={-tipZ}
              stroke="#e6edf5"
              strokeWidth={0.22}
            />
          </g>
        );
      })}
    </svg>
  );
}

export default function Vistas2D() {
  const modelo = useSpdaStore((s) => s.modelo);
  if (!modelo) return null;
  return (
    <div className="flex gap-3.5 flex-1 min-w-0">
      <div className="flex-1 min-w-0">
        <h3 className="m-0 mb-1 text-[11px] uppercase text-surface-tonal-a40">
          Planta — huella de los conos por punta (radio rp)
        </h3>
        <Planta />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="m-0 mb-1 text-[11px] uppercase text-surface-tonal-a40">
          Sección — perfil del cono (esfera rodante) por punta
        </h3>
        <Seccion />
      </div>
    </div>
  );
}
