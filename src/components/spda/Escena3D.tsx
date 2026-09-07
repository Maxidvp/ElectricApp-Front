/**
 * Visor 3D (react-three-fiber). Dibuja, sobre el plano XY como suelo: la
 * estructura y los captadores importados, los conos por punta, las esferas de
 * apoyo entre puntas, la nube de puntos coloreada por resultado, la envolvente
 * numérica y el contorno de la sección a altura de circulación.
 *
 * Dos cosas a tener en cuenta:
 *
 *  - Los casquetes se dibujan como una esfera completa recortada con
 *    `clippingPlanes` de THREE, alimentados por los MISMOS planos que usa el
 *    exportador (`separadoresDeEsfera`). Es a propósito: así lo que se ve es lo
 *    que se exporta, y un bug de recorte aparece en los dos lados a la vez.
 *  - El recorte de los conos por azimut no se hace con planos sino construyendo
 *    la malla solo sobre los intervalos válidos (`semianguloRecorte` +
 *    `restarIntervalo`), con los vértices exactos en el borde. Descartar quads
 *    por su centro dejaba un borde dentado y huecos visibles contra el casquete.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport, Grid, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { useSpdaStore } from "@/state/spda/store";
import { useSeccion } from "@/state/spda/useSeccion";
import type { Vec3 } from "@/lib/spda/geometry";
import { perfilZonaPunta, radioProteccionSuelo } from "@/lib/spda/rollingSphere";
import {
  construccionMultiPunta,
  separadoresDeEsfera,
  semianguloRecorte,
  type PlanoRecorte,
} from "@/lib/spda/construccionEsfera";

/** Convierte un plano de recorte {punto,normal} (matemática pura) a THREE.Plane. */
function aPlanoThree(p: PlanoRecorte): THREE.Plane {
  const n = new THREE.Vector3(...p.normal);
  return new THREE.Plane(n, -n.dot(new THREE.Vector3(...p.punto)));
}

/** Menor valor de la serie 1·2·5·10ⁿ que sea ≥ objetivo. */
function pasoLindo(objetivo: number): number {
  if (!isFinite(objetivo) || objetivo <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(objetivo)));
  const f = objetivo / p;
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return m * p;
}

function formatoTick(v: number): string {
  if (Math.abs(v) < 1e-9) return "0";
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 1) return String(Number(v.toFixed(2)));
  return String(Number(v.toFixed(3)));
}

const ESTILO_ETIQUETA: CSSProperties = {
  font: "11px/1 system-ui, sans-serif",
  color: "#cfd8e2",
  background: "rgba(15,18,22,.72)",
  padding: "1px 4px",
  borderRadius: "3px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  userSelect: "none",
};

/**
 * Cuadrícula cuyo paso se adapta a la distancia de la cámara al objetivo
 * (serie 1·2·5), con ejes X/Y y etiquetas numéricas en las líneas mayores.
 */
function CuadriculaEjes({ cota }: { cota: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target?: THREE.Vector3 } | null;
  const objetivo = useRef(new THREE.Vector3());
  const [g, setG] = useState({ major: 10, cx: 0, cy: 0 });

  useFrame(() => {
    if (controls?.target) objetivo.current.copy(controls.target);
    const d = Math.max(1e-3, camera.position.distanceTo(objetivo.current));
    const major = pasoLindo(d / 10);
    const cx = Math.round(objetivo.current.x / major) * major;
    const cy = Math.round(objetivo.current.y / major) * major;
    if (major !== g.major || cx !== g.cx || cy !== g.cy) setG({ major, cx, cy });
  });

  const N = 8;
  const extent = N * g.major;
  const ticks = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = -N; i <= N; i++) {
      xs.push(g.cx + i * g.major);
      ys.push(g.cy + i * g.major);
    }
    return { xs, ys };
  }, [g.cx, g.cy, g.major]);

  return (
    <group>
      <Grid
        position={[g.cx, g.cy, cota]}
        rotation={[Math.PI / 2, 0, 0]}
        cellSize={g.major / 5}
        sectionSize={g.major}
        cellColor="#2b333d"
        sectionColor="#3a4553"
        infiniteGrid
        fadeDistance={extent * 8}
        fadeStrength={1}
      />
      <Line
        points={[
          [g.cx - extent, 0, cota],
          [g.cx + extent, 0, cota],
        ]}
        color="#ff5a5a"
        lineWidth={1.5}
        depthTest={false}
      />
      <Line
        points={[
          [0, g.cy - extent, cota],
          [0, g.cy + extent, cota],
        ]}
        color="#37c978"
        lineWidth={1.5}
        depthTest={false}
      />
      {ticks.xs.map((x) =>
        Math.abs(x) < 1e-9 ? null : (
          <Html key={`x${x}`} position={[x, g.cy, cota]} center style={ESTILO_ETIQUETA} zIndexRange={[10, 0]}>
            {formatoTick(x)}
          </Html>
        ),
      )}
      {ticks.ys.map((y) =>
        Math.abs(y) < 1e-9 ? null : (
          <Html key={`y${y}`} position={[g.cx, y, cota]} center style={ESTILO_ETIQUETA} zIndexRange={[10, 0]}>
            {formatoTick(y)}
          </Html>
        ),
      )}
      <Html position={[g.cx, g.cy, cota]} center style={{ ...ESTILO_ETIQUETA, color: "#8a97a6" }}>
        0
      </Html>
      <Html
        position={[g.cx + extent * 0.6, g.cy - g.major * 0.6, cota]}
        center
        style={{ ...ESTILO_ETIQUETA, color: "#8a97a6" }}
      >
        {`paso ${formatoTick(g.major)} m`}
      </Html>
    </group>
  );
}

function polylinesToGeometry(lines: Vec3[][]): THREE.BufferGeometry {
  const pos: number[] = [];
  for (const l of lines) {
    for (let i = 0; i < l.length - 1; i++) {
      pos.push(...l[i], ...l[i + 1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function PuntosResultado() {
  const modelo = useSpdaStore((s) => s.modelo);
  const resultado = useSpdaStore((s) => s.resultado);

  const geom = useMemo(() => {
    if (!modelo) return null;
    const pts = modelo.puntosEstructura;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(pts.length * 3);
    const col = new Float32Array(pts.length * 3);
    const cOk = new THREE.Color("#37c978");
    const cBad = new THREE.Color("#ff5a5a");
    const cNeutral = new THREE.Color("#5b6b7d");
    for (let i = 0; i < pts.length; i++) {
      pos[i * 3] = pts[i][0];
      pos[i * 3 + 1] = pts[i][1];
      pos[i * 3 + 2] = pts[i][2];
      let c = cNeutral;
      if (resultado && resultado.puntos[i]) c = resultado.puntos[i].protegido ? cOk : cBad;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [modelo, resultado]);

  if (!geom) return null;
  return (
    <points geometry={geom}>
      <pointsMaterial size={0.4} vertexColors sizeAttenuation />
    </points>
  );
}

function Estructura() {
  const modelo = useSpdaStore((s) => s.modelo);
  const geom = useMemo(
    () => (modelo ? polylinesToGeometry(modelo.lineasEstructura) : null),
    [modelo],
  );
  if (!geom) return null;
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#8a97a6" />
    </lineSegments>
  );
}

function Conductores() {
  const conductores = useSpdaStore((s) => s.conductores);
  const geom = useMemo(
    () => polylinesToGeometry(conductores.map((c) => c.puntos)),
    [conductores],
  );
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#4da3ff" linewidth={2} />
    </lineSegments>
  );
}

function Mastiles() {
  const mastiles = useSpdaStore((s) => s.mastiles);
  const seleccionId = useSpdaStore((s) => s.seleccionId);
  const setSeleccion = useSpdaStore((s) => s.setSeleccion);
  return (
    <>
      {mastiles.map((m) => {
        const h = Math.max(0.01, m.altura);
        return (
          <mesh
            key={m.id}
            position={[m.base[0], m.base[1], m.base[2] + h / 2]}
            rotation={[Math.PI / 2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              setSeleccion(m.id);
            }}
          >
            <cylinderGeometry args={[0.15, 0.15, h, 8]} />
            <meshStandardMaterial color={seleccionId === m.id ? "#ffb648" : "#e6edf5"} />
          </mesh>
        );
      })}
    </>
  );
}

function SueloXY() {
  const visible = useSpdaStore((s) => s.mostrarSuelo);
  const cota = useSpdaStore((s) => s.cotaTierra) ?? 0;
  const modelo = useSpdaStore((s) => s.modelo);
  if (!visible) return null;
  const cx = modelo ? (modelo.bounds.min[0] + modelo.bounds.max[0]) / 2 : 0;
  const cy = modelo ? (modelo.bounds.min[1] + modelo.bounds.max[1]) / 2 : 0;
  const size = modelo
    ? Math.max(
        modelo.bounds.max[0] - modelo.bounds.min[0],
        modelo.bounds.max[1] - modelo.bounds.min[1],
        20,
      ) * 4
    : 400;
  return (
    <mesh position={[cx, cy, cota]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        color="#0b0e12"
        transparent
        opacity={0.55}
        side={THREE.DoubleSide}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  );
}

const TWO_PI = Math.PI * 2;
const norm2pi = (a: number) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

/** Resta el intervalo [lo, hi] (sin envolver) de una lista de intervalos. */
function restarIntervalo(ivs: [number, number][], lo: number, hi: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of ivs) {
    if (hi <= a || lo >= b) {
      out.push([a, b]);
      continue;
    }
    if (lo > a) out.push([a, lo]);
    if (hi < b) out.push([hi, b]);
  }
  return out;
}

interface ConoInfoId {
  id: string;
  x: number;
  y: number;
  h: number;
  rp: number;
}

/**
 * Cono de protección de cada punta (revolución del arco de la esfera rodante,
 * del suelo a la punta). Se construye SOLO sobre los intervalos de azimut
 * válidos: la cuña que apunta a otra punta —donde la esfera generadora la
 * penetraría— se quita con borde exacto (bisección), así el corte coincide con
 * la arista del segmento esférico y no quedan aberturas.
 */
function ZonasProtegidas() {
  const mastiles = useSpdaStore((s) => s.mastiles);
  const R = useSpdaStore((s) => s.radioEfectivo());
  const cota = useSpdaStore((s) => s.cotaTierra) ?? 0;
  const visible = useSpdaStore((s) => s.mostrarZonas);

  const geoms = useMemo(() => {
    if (!visible) return [];
    const conos: ConoInfoId[] = mastiles
      .filter((m) => m.base[2] + m.altura - cota > 0.01)
      .map((m) => ({
        id: m.id,
        x: m.base[0],
        y: m.base[1],
        h: m.base[2] + m.altura - cota,
        rp: radioProteccionSuelo(R, m.base[2] + m.altura - cota),
      }));

    return conos.map((c, ci) => {
      // Intervalos de azimut a conservar (empieza en la vuelta completa).
      let kept: [number, number][] = [[0, TWO_PI]];
      for (let oi = 0; oi < conos.length; oi++) {
        if (oi === ci) continue;
        const half = semianguloRecorte(c, conos[oi], R, cota);
        if (half <= 1e-4) continue;
        const centro = norm2pi(Math.atan2(conos[oi].y - c.y, conos[oi].x - c.x));
        let lo = centro - half;
        let hi = centro + half;
        if (lo < 0) {
          kept = restarIntervalo(kept, 0, hi);
          kept = restarIntervalo(kept, norm2pi(lo), TWO_PI);
        } else if (hi > TWO_PI) {
          kept = restarIntervalo(kept, lo, TWO_PI);
          kept = restarIntervalo(kept, 0, hi - TWO_PI);
        } else {
          kept = restarIntervalo(kept, lo, hi);
        }
      }

      const perfil = perfilZonaPunta(R, c.h).slice(1); // desde la punta hasta el borde
      const pos: number[] = [];
      const idx: number[] = [];
      for (const [a0, a1] of kept) {
        if (a1 - a0 < 1e-3) continue;
        const nSeg = Math.max(6, Math.ceil((a1 - a0) / (Math.PI / 120)));
        const base = pos.length / 3;
        const stride = nSeg + 1;
        for (const p of perfil) {
          for (let s = 0; s <= nSeg; s++) {
            const ang = a0 + ((a1 - a0) * s) / nSeg;
            pos.push(c.x + p.r * Math.cos(ang), c.y + p.r * Math.sin(ang), cota + p.z);
          }
        }
        for (let pi = 0; pi < perfil.length - 1; pi++) {
          for (let s = 0; s < nSeg; s++) {
            const i0 = base + pi * stride + s;
            const i1 = i0 + 1;
            const i2 = i0 + stride;
            const i3 = i2 + 1;
            idx.push(i0, i2, i1, i1, i2, i3);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return { id: c.id, g };
    });
  }, [mastiles, R, cota, visible]);

  return (
    <>
      {geoms.map(({ id, g }) => (
        <mesh key={id} geometry={g} renderOrder={2}>
          <meshBasicMaterial
            color="#5aa9ff"
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * Casquetes esféricos de las esferas de apoyo (2 puntas + suelo, y 3 puntas),
 * recortados al triángulo esférico que apoya en las puntas y toca el suelo:
 * es la tapa que cierra el volumen protegido entre los conos.
 * No se dibuja ninguna esfera apoyada solo en dos puntas.
 */
function ConstruccionEsfera() {
  const mastiles = useSpdaStore((s) => s.mastiles);
  const r = useSpdaStore((s) => s.radioEfectivo());
  const cota = useSpdaStore((s) => s.cotaTierra) ?? 0;
  const visible = useSpdaStore((s) => s.mostrarEsferasEntre);

  const esferas = useMemo(() => {
    if (!visible) return [];
    const puntas: Vec3[] = mastiles
      .filter((m) => m.base[2] + m.altura - cota > 0.01)
      .map((m) => [m.base[0], m.base[1], m.base[2] + m.altura]);
    if (puntas.length < 2) return [];
    return construccionMultiPunta(puntas, r, cota);
  }, [mastiles, r, cota, visible]);

  return (
    <>
      {esferas.map((e, i) => (
        <mesh
          key={`${e.tipo}-${e.puntas.join("-")}-${i}`}
          position={[e.centro[0], e.centro[1], e.centro[2]]}
          renderOrder={1}
        >
          <sphereGeometry args={[e.radio, 72, 48]} />
          <meshBasicMaterial
            color={e.tipo === "3p" ? "#a5b4fc" : "#7cc4ff"}
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
            depthWrite={false}
            clippingPlanes={separadoresDeEsfera(e).map(aPlanoThree)}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * Curva que deja el volumen protegido sobre el plano de circulación peatonal.
 * Es la misma que se agrega al STEP, para que lo que se ve sea lo que se acota.
 */
function SeccionPeatonal() {
  const visible = useSpdaStore((s) => s.mostrarSeccion);
  const seccion = useSeccion();
  if (!visible || !seccion) return null;

  return (
    <>
      {seccion.contornos.map((anillo, i) => (
        <Line
          key={i}
          points={[...anillo, anillo[0]].map(
            ([x, y]) => [x, y, seccion.zAbs] as [number, number, number],
          )}
          color="#ffd166"
          lineWidth={2}
        />
      ))}
    </>
  );
}

function Envolvente() {
  const malla = useSpdaStore((s) => s.envolvente);
  const visible = useSpdaStore((s) => s.mostrarEnvolvente);
  const geom = useMemo(() => {
    if (!malla) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(malla.positions, 3));
    g.setIndex(new THREE.BufferAttribute(malla.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [malla]);
  if (!geom || !visible) return null;
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color="#37c978"
        transparent
        opacity={0.16}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Esfera rodante en una posición de apoyo real: tangente al plano de tierra y
 * tocando la punta seleccionada (centro a `cota + R`, a `rp` en horizontal de la
 * punta). Así se ve que la esfera toca el suelo y la captación.
 */
function EsferaRodante() {
  const visible = useSpdaStore((s) => s.mostrarEsfera);
  const R = useSpdaStore((s) => s.radioEfectivo());
  const cota = useSpdaStore((s) => s.cotaTierra) ?? 0;
  const mastiles = useSpdaStore((s) => s.mastiles);
  const seleccionId = useSpdaStore((s) => s.seleccionId);
  const modelo = useSpdaStore((s) => s.modelo);
  if (!visible) return null;
  const m = mastiles.find((x) => x.id === seleccionId) ?? mastiles[0];

  let centro: Vec3;
  if (m) {
    const h = m.base[2] + m.altura - cota;
    const rp = radioProteccionSuelo(R, h);
    centro = [m.base[0] + rp, m.base[1], cota + R]; // tangente al suelo, tocando la punta
  } else {
    const cx = modelo ? (modelo.bounds.min[0] + modelo.bounds.max[0]) / 2 : 0;
    const cy = modelo ? (modelo.bounds.min[1] + modelo.bounds.max[1]) / 2 : 0;
    centro = [cx, cy, cota + R]; // esfera apoyada en el suelo
  }
  return (
    <mesh position={[centro[0], centro[1], centro[2]]}>
      <sphereGeometry args={[R, 32, 24]} />
      <meshBasicMaterial color="#4da3ff" wireframe transparent opacity={0.22} />
    </mesh>
  );
}

/** Reencuadra la cámara cuando cambia el modelo (el `?demo` carga async). */
function Encuadre({ center, dist }: { center: Vec3; dist: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;
  const top =
    typeof location !== "undefined" && new URLSearchParams(location.search).has("top");
  const clave = `${center.join(",")}|${dist}|${top}`;
  useEffect(() => {
    if (top) {
      camera.position.set(center[0], center[1] - 0.001, center[2] + dist * 1.4);
    } else {
      camera.position.set(center[0] + dist, center[1] - dist, center[2] + dist * 0.65);
    }
    camera.up.set(0, 0, 1);
    camera.lookAt(center[0], center[1], center[2]);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(center[0], center[1], center[2]);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return null;
}

export default function Escena3D() {
  const modelo = useSpdaStore((s) => s.modelo);
  const cota = useSpdaStore((s) => s.cotaTierra) ?? 0;
  const R = useSpdaStore((s) => s.radioEfectivo());

  const { center, dist } = useMemo(() => {
    if (!modelo) return { center: [0, 0, 0] as Vec3, dist: 80 };
    const { min, max } = modelo.bounds;
    const c: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 10);
    // Encuadra la estructura dejando algo de aire para los conos (radio ~ r).
    return { center: c, dist: size * 1.3 + R * 0.45 };
  }, [modelo, R]);

  return (
    <Canvas
      camera={{ position: [center[0] + dist, center[1] - dist, center[2] + dist * 0.65], far: 100000 }}
      onCreated={({ camera, gl }) => {
        camera.up.set(0, 0, 1);
        camera.lookAt(center[0], center[1], center[2]);
        gl.localClippingEnabled = true;
      }}
    >
      <color attach="background" args={["#0f1216"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[50, -30, 80]} intensity={1.1} />
      <SueloXY />
      <CuadriculaEjes cota={cota} />
      <Estructura />
      <Conductores />
      <Mastiles />
      <ZonasProtegidas />
      <ConstruccionEsfera />
      <SeccionPeatonal />
      <PuntosResultado />
      <Envolvente />
      <EsferaRodante />
      <OrbitControls target={[center[0], center[1], center[2]]} makeDefault />
      <Encuadre center={center} dist={dist} />
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport axisColors={["#ff5a5a", "#37c978", "#4da3ff"]} labelColor="#dfe6ee" />
      </GizmoHelper>
    </Canvas>
  );
}
