/**
 * Visor 3D (react-three-fiber). Dibuja, sobre el plano XY como suelo: la
 * estructura y los captadores importados, los conos por punta, las esferas de
 * apoyo entre puntas, las mallas guardadas del proyecto, la envolvente numérica
 * y el contorno de la sección a altura de circulación.
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
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import { useSpdaStore } from "@/state/spda/store";
import { useHerramientasStore } from "@/state/spda/herramientasStore";
import { useEdificiosStore, planosConPiso } from "@/state/spda/edificiosStore";
import { DIAMETRO_MARCADOR, volumenDeClicks } from "@/lib/spda/edificios/arreglo";
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
// three-mesh-bvh se instala como extensión de los prototipos de three: agrega
// `computeBoundsTree`/`disposeBoundsTree` a las geometrías y reemplaza el
// raycast de `Mesh` por uno que usa el BVH cuando existe. Las mallas que no lo
// construyen siguen usando el recorrido lineal de siempre.
// El cast es por un desajuste de tipos de three-mesh-bvh 0.9.14: la
// augmentation de `three` declara `computeBoundsTree` devolviendo `MeshBVH`
// mientras que la función exportada devuelve su clase base `GeometryBVH`. En
// runtime es la misma función.
THREE.BufferGeometry.prototype.computeBoundsTree =
  computeBoundsTree as unknown as THREE.BufferGeometry["computeBoundsTree"];
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

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

/**
 * Sólido real importado (OBJ/STL) — un color fijo, sin heatmap por vértice.
 *
 * Protegido/expuesto ya no se calcula por vértice: se lee por TRANSPARENCIA,
 * comparando este sólido opaco contra las superficies de protección
 * translúcidas (`ZonasProtegidas`/`ConstruccionEsfera`, ya en la escena) —
 * donde la estructura queda cubierta por una superficie de protección, el
 * color se mezcla con el de esa superficie (se ve un tercer color, la mezcla);
 * donde la estructura asoma sin nada translúcido encima, se ve su color liso
 * — expuesta. Se sacó el cálculo por vértice (`resultadoMallas`) porque exigía
 * evaluar la esfera rodante en cada vértice de la malla real solo para
 * pintarla; este enfoque da la misma lectura gratis, con la geometría que ya
 * se dibuja para el cálculo analítico (ver memoria del proyecto).
 */
function ModeloSolido() {
  const mallas = useSpdaStore((s) => s.modelo?.mallas);
  const visible = useSpdaStore((s) => s.mostrarMalla);
  const delimitando = useEdificiosStore((s) => s.delimitando);
  const modo = useEdificiosStore((s) => s.modo);
  const agregarPlano = useEdificiosStore((s) => s.agregarPlano);
  const seleccionarCara = useEdificiosStore((s) => s.seleccionarCara);
  // Las `pesada` se saltean acá y solo acá: entran igual al cálculo (ver
  // `mallaRenderDeGrupo`), lo que no vale la pena es dibujarlas como sólido.
  const geoms = useMemo(
    () =>
      (mallas ?? [])
        .filter((m) => !m.pesada)
        // Esta es LA malla que se clickea para delimitar: va con BVH.
        .map((m, i) => ({ key: `${m.nombre}-${i}`, malla: m, g: geometriaDeMalla(m, true) })),
    [mallas],
  );
  useDisposeGeometrias(geoms.map((x) => x.g));
  if (!visible) return null;
  return (
    <>
      {geoms.map(({ key, malla, g }) => (
        <mesh
          key={key}
          geometry={g}
          onClick={(e) => {
            // "Delimitar edificios" reusa este mismo modelo — el `<mesh>` no
            // tiene transform propio, así que local == mundo y todo lo que da
            // three.js en el evento sirve directo.
            if (!delimitando) return;
            e.stopPropagation();
            if (modo === "conectividad") {
              // `faceIndex` es el índice de triángulo en ESTA geometría, que se
              // arma 1:1 desde la MallaRender (indexada o soup), así que sirve
              // como punto de partida del flood fill sin traducción.
              if (e.faceIndex != null) seleccionarCara(malla, e.faceIndex);
              return;
            }
            // Solo se toma el PLANO de la cara clickeada: normal geométrica del
            // triángulo (three.js la calcula del triángulo real, no de la normal
            // suavizada) y el punto del click como ancla. No se recorre la malla:
            // toda la forma sale de intersectar este plano con los ya marcados.
            if (!e.face) return;
            const n = e.face.normal;
            agregarPlano({ punto: [e.point.x, e.point.y, e.point.z], normal: [n.x, n.y, n.z] });
          }}
        >
          <meshStandardMaterial
            color="#e8b34d"
            transparent={delimitando}
            opacity={delimitando ? 0.35 : 1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * Libera las geometrías que dejaron de usarse. three.js no lo hace solo: cada
 * `BufferGeometry` reserva buffers en la GPU que viven hasta su `dispose()`, y
 * acá se recrean seguido (reimportar, mover el slider de decimación, activar y
 * desactivar mallas guardadas). Sin esto, una sesión larga las va acumulando.
 *
 * Compara contra el set anterior en vez de confiar en la identidad del array,
 * así da igual si el llamador memoiza o arma uno nuevo en cada render: solo se
 * libera lo que efectivamente ya no está en uso.
 */
function useDisposeGeometrias(geoms: THREE.BufferGeometry[]) {
  const previas = useRef<THREE.BufferGeometry[]>([]);
  // `dispose()` libera los buffers de la GPU pero no el BVH, que es memoria JS
  // colgada de la geometría: se suelta aparte.
  const soltar = (g: THREE.BufferGeometry) => {
    g.disposeBoundsTree?.();
    g.dispose();
  };
  useEffect(() => {
    for (const g of previas.current) if (!geoms.includes(g)) soltar(g);
    previas.current = geoms;
  });
  useEffect(() => () => previas.current.forEach(soltar), []);
}

/**
 * Construye una BufferGeometry (no reactiva) a partir de una `MallaRender`/`MallaDecimada`.
 *
 * `paraClicks` arma además el BVH. Solo tiene sentido en la malla que se
 * clickea: sin él, cada evento del puntero recorre TODOS los triángulos uno por
 * uno, y react-three-fiber lanza un rayo en cada `pointermove`, no solo al
 * hacer click. Con 325.000 triángulos eso es lo que hace que delimitar se
 * sienta pesado, bastante más que el dibujado en sí.
 */
function geometriaDeMalla(
  m: { positions: Float32Array; indices: Uint32Array | null },
  paraClicks = false,
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
  if (m.indices) g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.computeVertexNormals();
  if (paraClicks) g.computeBoundsTree();
  return g;
}

/**
 * Malla original importada por "Importar objetos" — wireframe celeste, para
 * comparar contra la decimada sin que una tape a la otra.
 */
function TerrenoOriginal() {
  const mallas = useHerramientasStore((s) => s.terreno);
  const visible = useHerramientasStore((s) => s.mostrarOriginal);
  const geoms = useMemo(
    () => (mallas ?? []).map((m, i) => ({ key: `${m.nombre}-${i}`, g: geometriaDeMalla(m) })),
    [mallas],
  );
  useDisposeGeometrias(geoms.map((x) => x.g));
  if (!visible) return null;
  return (
    <>
      {geoms.map(({ key, g }) => (
        <mesh key={key} geometry={g}>
          <meshBasicMaterial color="#5aa9ff" wireframe />
        </mesh>
      ))}
    </>
  );
}

/** Malla decimada por "Importar objetos" — sólido naranja translúcido. */
function TerrenoDecimado() {
  const mallas = useHerramientasStore((s) => s.terrenoDecimado);
  const visible = useHerramientasStore((s) => s.mostrarDecimado);
  const conAristas = useHerramientasStore((s) => s.mostrarAristasDecimado);
  const geoms = useMemo(
    () => (mallas ?? []).map((m, i) => ({ key: `${m.nombre}-${i}`, g: geometriaDeMalla(m) })),
    [mallas],
  );
  // Aristas reales de la triangulación (no solo las "de forma"): con la malla
  // ya bien decimada, cada triángulo importa para ver qué tan gruesa quedó.
  const aristas = useMemo(
    () => geoms.map(({ key, g }) => ({ key, eg: new THREE.WireframeGeometry(g) })),
    [geoms],
  );
  useDisposeGeometrias([...geoms.map((x) => x.g), ...aristas.map((x) => x.eg)]);
  if (!visible) return null;
  return (
    <>
      {geoms.map(({ key, g }) => (
        <mesh key={key} geometry={g}>
          <meshStandardMaterial color="#ffb648" transparent opacity={0.75} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {conAristas &&
        aristas.map(({ key, eg }) => (
          <lineSegments key={`${key}-aristas`} geometry={eg}>
            <lineBasicMaterial color="#2a1a05" transparent opacity={0.6} />
          </lineSegments>
        ))}
    </>
  );
}

/**
 * Modelos guardados (`SpdaMalla`, ver `services/spdaMallas.ts`) activados por el
 * usuario en el panel — geometría bajada bajo demanda al tildar el check, cacheada
 * en el store (`mallasCargadas`) para no volver a pedirla al destildar/tildar de nuevo.
 * Color por `tipo`: suelo en el mismo naranja que "Importar suelo", edificio en el
 * mismo ámbar que `ModeloSolido` — para reconocer de un vistazo qué es cada uno.
 */
function MallasGuardadas() {
  const activasIds = useSpdaStore((s) => s.mallasActivasIds);
  const cargadas = useSpdaStore((s) => s.mallasCargadas);
  const metas = useSpdaStore((s) => s.mallasGuardadas);
  const items = useMemo(
    () =>
      activasIds
        .filter((id) => cargadas[id])
        .map((id) => ({
          id,
          tipo: metas.find((m) => m.id === id)?.tipo ?? "edificio",
          g: geometriaDeMalla(cargadas[id]),
        })),
    [activasIds, cargadas, metas],
  );
  useDisposeGeometrias(items.map((x) => x.g));
  return (
    <>
      {items.map(({ id, tipo, g }) => (
        <mesh key={id} geometry={g}>
          <meshStandardMaterial
            color={tipo === "suelo" ? "#ffb648" : "#e8b34d"}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * Caras picadas: el volumen que se está definiendo a click limpio.
 *
 * Lo que se dibuja es la MISMA reconstrucción que se guarda (`volumenDeClicks`
 * en `arreglo.ts`): los planos parten el espacio en celdas, las celdas que algún
 * click marca como interiores son el edificio, y la superficie es el borde entre
 * adentro y afuera — cerrada por construcción, y no convexa si hace falta.
 *
 * Mientras los clicks todavía no encierran nada solo se ven los marcadores de
 * cada cara picada. El sólido aparece recién cuando cierra, y esa aparición ES
 * la señal de que ya está: antes se dibujaba la celda de cada plano por
 * separado, que se veía "casi bien" aunque la figura estuviera abierta.
 */
function CarasPicadas() {
  const activo = useEdificiosStore((s) => s.delimitando);
  const modo = useEdificiosStore((s) => s.modo);
  const caras = useEdificiosStore((s) => s.piezaActual);
  const bbox = useEdificiosStore((s) => s.bboxDelimitacion);

  const datos = useMemo(() => {
    if (!activo || modo !== "region" || !bbox || caras.length === 0) return null;
    const v = volumenDeClicks(planosConPiso(caras), bbox);
    if (!v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(v.positions, 3));
    g.setIndex(new THREE.BufferAttribute(v.indices, 1));
    g.computeVertexNormals();
    return { g, volumen: v.volumen };
  }, [activo, modo, caras, bbox]);

  useDisposeGeometrias(useMemo(() => (datos ? [datos.g] : []), [datos]));
  if (!activo || modo !== "region") return null;

  return (
    <>
      {datos && (
        <mesh geometry={datos.g} renderOrder={3}>
          <meshStandardMaterial
            color="#c084fc"
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Marcador del punto clickeado en cada cara. */}
      {caras.map((c, i) => (
        <MarcadorCara key={`marca-${i}`} plano={c} />
      ))}
    </>
  );
}

/** Círculo de `DIAMETRO_MARCADOR` sobre el punto donde se clickeó una cara. */
function MarcadorCara({ plano }: { plano: { punto: Vec3; normal: Vec3 } }) {
  const { quaternion, posicion } = useMemo(() => {
    const n = new THREE.Vector3(...plano.normal).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    // Despegado un poco de la superficie para que no pelee con la malla real.
    const p = new THREE.Vector3(...plano.punto).addScaledVector(n, 0.02);
    return { quaternion: q, posicion: p };
  }, [plano]);
  return (
    <mesh position={posicion} quaternion={quaternion} renderOrder={4}>
      <circleGeometry args={[DIAMETRO_MARCADOR / 2, 24]} />
      <meshBasicMaterial color="#f5d0fe" transparent opacity={0.9} side={THREE.DoubleSide} depthTest={false} />
    </mesh>
  );
}

/** Piezas ya cerradas del edificio en construcción, todavía sin guardar. */
function PiezasEdificioTerminadas() {
  const piezas = useEdificiosStore((s) => s.piezasTerminadas);
  const geoms = useMemo(() => piezas.map((p, i) => ({ key: i, g: geometriaDeMalla(p) })), [piezas]);
  useDisposeGeometrias(geoms.map((x) => x.g));
  return (
    <>
      {geoms.map(({ key, g }) => (
        <mesh key={key} geometry={g}>
          <meshStandardMaterial color="#a855f7" transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function Estructura() {
  const modelo = useSpdaStore((s) => s.modelo);
  const geom = useMemo(
    () => (modelo ? polylinesToGeometry(modelo.lineasEstructura) : null),
    [modelo],
  );
  useDisposeGeometrias(useMemo(() => (geom ? [geom] : []), [geom]));
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
  useDisposeGeometrias(useMemo(() => [geom], [geom]));
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
            opacity={0.4}
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
            opacity={0.42}
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
  useDisposeGeometrias(useMemo(() => (geom ? [geom] : []), [geom]));
  if (!geom || !visible) return null;
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color="#37c978"
        transparent
        opacity={0.4}
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
  const mallasActivasIds = useSpdaStore((s) => s.mallasActivasIds);
  const mallasCargadas = useSpdaStore((s) => s.mallasCargadas);
  const terreno = useHerramientasStore((s) => s.terreno);
  const terrenoDecimado = useHerramientasStore((s) => s.terrenoDecimado);

  const { center, dist } = useMemo(() => {
    // El encuadre mira TODA la geometría visible, no solo el modelo importado:
    // una malla guardada o un terreno del banco de pruebas pueden estar lejos
    // del origen (un terreno a 40 m de altura, p. ej.) y con el encuadre viejo
    // la cámara quedaba adentro de la geometría, como si se hubiera roto algo.
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    const sumar = (m: { positions: Float32Array }) => {
      for (let i = 0; i < m.positions.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const v = m.positions[i + k];
          if (v < min[k]) min[k] = v;
          if (v > max[k]) max[k] = v;
        }
      }
    };
    if (modelo) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], modelo.bounds.min[k]);
        max[k] = Math.max(max[k], modelo.bounds.max[k]);
      }
    }
    for (const id of mallasActivasIds) {
      const m = mallasCargadas[id];
      if (m) sumar(m);
    }
    for (const m of terrenoDecimado ?? terreno ?? []) sumar(m);

    if (!isFinite(min[0])) return { center: [0, 0, 0] as Vec3, dist: 80 };
    const c: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 10);
    // Encuadra la estructura dejando algo de aire para los conos (radio ~ r).
    return { center: c, dist: size * 1.3 + R * 0.45 };
  }, [modelo, R, mallasActivasIds, mallasCargadas, terreno, terrenoDecimado]);

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
      <ModeloSolido />
      <MallasGuardadas />
      <TerrenoOriginal />
      <TerrenoDecimado />
      <CarasPicadas />
      <PiezasEdificioTerminadas />
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
