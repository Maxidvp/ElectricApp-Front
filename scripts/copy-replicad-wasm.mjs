// Copia el WASM de OpenCascade (replicad-opencascadejs) a public/wasm/ para
// servirlo por una URL fija, sin depender del import `?url` de Vite (que Next
// no entiende). Se corre en postinstall para que quede sincronizado con la
// versión instalada del paquete.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "..", "node_modules", "replicad-opencascadejs", "dist", "replicad_single.wasm");
const destDir = join(root, "..", "public", "wasm");
const dest = join(destDir, "replicad_single.wasm");

if (!existsSync(src)) {
  console.warn("[copy-replicad-wasm] no se encontró", src, "- ¿está instalado replicad-opencascadejs?");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[copy-replicad-wasm] copiado a", dest);
