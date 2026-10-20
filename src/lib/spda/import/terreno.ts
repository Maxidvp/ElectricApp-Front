/**
 * Import de terreno "crudo": a diferencia de `importarOBJ`/`importarSTL`
 * (mesh.ts), acá NO se clasifica por capa/grupo, no se arma nube de puntos ni
 * se acota a `MAX_VERTICES_MALLA` — es la malla completa tal cual viene el
 * archivo, transformada a metros/Z-arriba, para poder decimarla y comparar
 * original vs. simplificada (herramienta de "Importar objetos").
 *
 * Formatos: STEP, STL y OBJ. STEP es el único que declara su unidad, así que
 * es el único con el que el terreno cae seguro en el mismo sistema de
 * coordenadas que las edificaciones — con STL la unidad se adivina, y como las
 * coordenadas de relevamiento están lejos del origen, errarle no cambia el
 * tamaño sino que corre la pieza kilómetros.
 *
 * Es un import dedicado (un botón aparte, "Importar suelo") en vez de
 * clasificar por nombre de capa: el 100% del contenido del archivo se trata
 * como terreno, sin ambigüedad — ver la discusión que llevó a esta decisión
 * en la memoria del proyecto.
 */
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { aZUp, type MallaRender, type OpcionesImport } from "./tipos";
import { leerSTEP } from "./step";

function mallaDeGeometria(
  nombre: string,
  geom: THREE.BufferGeometry,
  opts: OpcionesImport,
): MallaRender | null {
  const pos = geom.getAttribute("position");
  if (!pos || pos.count === 0) return null;

  const positions = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = aZUp(pos.getX(i), pos.getY(i), pos.getZ(i), opts);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  const indexAttr = geom.getIndex();
  const indices = indexAttr ? Uint32Array.from(indexAttr.array as ArrayLike<number>) : null;
  return { nombre, positions, indices };
}

function extension(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i >= 0 ? nombre.slice(i).toLowerCase() : "";
}

/**
 * Descarta las caras que miran hacia abajo (`normal.z <= 0`).
 *
 * Un terreno exportado desde un sólido (Civil3D → 3D Solid → STL, el caso real
 * que destapó esto) suele traer la superficie DUPLICADA: la cara de arriba
 * real, y una copia espejada hacia abajo — el boundary completo del sólido,
 * no la superficie de terreno en sí. Verificado en un caso real: 324.910
 * triángulos totales, 160.527 hacia arriba y 161.891 hacia abajo, casi
 * exactamente mitad y mitad, en el mismo rango de Z completo — no es terreno
 * + base plana, es la misma superficie dos veces.
 *
 * Esa duplicación es letal para decimar: dos superficies coincidentes crean
 * una red de "costuras" que traba al simplificador (`meshoptimizer` documenta
 * justo este caso: "para mallas con topología inconsistente o muchas costuras
 * ... puede quedar trabado"). Filtrando a una sola cara, el mismo archivo pasó
 * de no poder reducirse en absoluto a decimar al 99% en <50ms.
 *
 * Asume que el terreno es esencialmente una función de altura sobre (x,y) —
 * válido para relieve natural o taludes de obra, no para una cueva o un
 * socavón real (ahí una cara "hacia abajo" sería parte genuina del terreno).
 *
 * Por eso NO se aplica a ciegas: si el archivo ya viene limpio (una sola cara,
 * sin la duplicación de un sólido), descartar las caras hacia abajo se
 * comería relieve real. Solo se filtra si hay evidencia de duplicación —
 * "hacia arriba" y "hacia abajo" en cantidades comparables (ver `RATIO_MIN`).
 * Un terreno normal, sin duplicar, va a tener muy pocas caras hacia abajo
 * (como mucho algún socavón puntual), nunca una cantidad parecida a las de
 * arriba.
 */
const RATIO_MIN_DUPLICADO = 0.5; // abajo/arriba >= esto sugiere duplicación, no relieve real

function filtrarCaraSuperior(malla: MallaRender): { malla: MallaRender; descartados: number } {
  const { positions, indices } = malla;
  const nTri = indices ? indices.length / 3 : positions.length / 9;
  const idx = (i: number) => (indices ? indices[i] : i);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const arriba: number[] = [];
  const abajo: number[] = [];

  for (let t = 0; t < nTri; t++) {
    const ia = idx(t * 3);
    const ib = idx(t * 3 + 1);
    const ic = idx(t * 3 + 2);
    a.set(positions[ia * 3], positions[ia * 3 + 1], positions[ia * 3 + 2]);
    b.set(positions[ib * 3], positions[ib * 3 + 1], positions[ib * 3 + 2]);
    c.set(positions[ic * 3], positions[ic * 3 + 1], positions[ic * 3 + 2]);
    n.subVectors(b, a).cross(c.clone().sub(a));
    (n.z > 0 ? arriba : abajo).push(ia, ib, ic);
  }

  const pareceDuplicado = arriba.length > 0 && abajo.length / arriba.length >= RATIO_MIN_DUPLICADO;
  if (!pareceDuplicado) {
    return { malla, descartados: 0 };
  }

  // Soldar por COORDENADA, no por índice: para STL (nunca viene indexado) cada
  // triángulo trae sus propios 3 vértices, aunque compartan arista con el
  // vecino — un remap por índice de array no suelda nada ahí, solo tira la
  // mitad de abajo y deja el resto exactamente como estaba (huérfanos aparte,
  // que además es el caso "sparse" que trababa a meshoptimizer). Reconstruir
  // el triángulo-soup filtrado y soldar con `mergeVertices` (three.js, por
  // posición) es lo que de verdad compacta a los vértices únicos reales.
  const posSoup = new Float32Array(arriba.length * 3);
  for (let i = 0; i < arriba.length; i++) {
    const v = arriba[i];
    posSoup[i * 3] = positions[v * 3];
    posSoup[i * 3 + 1] = positions[v * 3 + 1];
    posSoup[i * 3 + 2] = positions[v * 3 + 2];
  }
  let geomSoldada = new THREE.BufferGeometry();
  geomSoldada.setAttribute("position", new THREE.Float32BufferAttribute(posSoup, 3));
  geomSoldada = mergeVertices(geomSoldada, 1e-4);

  const posFinal = geomSoldada.getAttribute("position").array;
  const idxFinal = geomSoldada.getIndex()!.array;

  return {
    malla: {
      nombre: malla.nombre,
      positions: posFinal instanceof Float32Array ? posFinal : new Float32Array(posFinal),
      indices: idxFinal instanceof Uint32Array ? idxFinal : Uint32Array.from(idxFinal as ArrayLike<number>),
    },
    descartados: abajo.length / 3,
  };
}

export async function importarTerrenoCrudo(
  file: File,
  opts: OpcionesImport,
): Promise<{
  mallas: MallaRender[];
  descartadosPorDuplicado: number;
  /** Unidad declarada por el archivo (solo STEP la trae). */
  unidadArchivo: string | null;
  advertencias: string[];
}> {
  const ext = extension(file.name);
  let crudas: MallaRender[];
  let unidadArchivo: string | null = null;
  const advertencias: string[] = [];

  if (ext === ".step" || ext === ".stp") {
    // STEP trae su unidad declarada y OpenCascade la aplica: acá llega en
    // metros y la unidad elegida en el panel no participa. Es la única forma
    // de que el terreno y las edificaciones caigan en el mismo sistema de
    // coordenadas sin depender de que alguien adivine bien.
    const lectura = await leerSTEP(await file.arrayBuffer(), file.name);
    crudas = lectura.mallas.map((m) => ({
      nombre: m.nombre,
      positions: m.positions,
      indices: m.indices,
    }));
    unidadArchivo = lectura.unidadArchivo;
    advertencias.push(...lectura.advertencias);
    if (!crudas.length) throw new Error("El STEP no produjo geometría teselable.");
  } else if (ext === ".obj") {
    const texto = await file.text();
    const raiz = new OBJLoader().parse(texto);
    crudas = [];
    let i = 0;
    raiz.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const malla = mallaDeGeometria(m.name || `obj-${++i}`, m.geometry as THREE.BufferGeometry, opts);
      if (malla) crudas.push(malla);
    });
    if (!crudas.length) throw new Error("OBJ sin mallas reconocibles.");
  } else if (ext === ".stl") {
    const buf = await file.arrayBuffer();
    const geom = new STLLoader().parse(buf);
    const malla = mallaDeGeometria("stl", geom, opts);
    if (!malla) throw new Error("STL sin geometría reconocible.");
    crudas = [malla];
  } else {
    throw new Error(
      `Formato no soportado para terreno: "${ext || file.name}". Usá .step, .stl o .obj.`,
    );
  }

  // El filtro de cara superior corre también para STEP: un terreno modelado
  // como SÓLIDO trae la superficie duplicada (la de arriba y la espejada de
  // abajo, que es el boundary del sólido), y eso traba al decimador igual
  // venga de donde venga. Ver el comentario de `filtrarCaraSuperior`.
  const filtradas = crudas.map(filtrarCaraSuperior);
  return {
    mallas: filtradas.map((f) => f.malla),
    descartadosPorDuplicado: filtradas.reduce((acc, f) => acc + f.descartados, 0),
    unidadArchivo,
    advertencias,
  };
}
