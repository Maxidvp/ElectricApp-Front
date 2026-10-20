/**
 * Codificación base64 de arrays tipados — para mandar `positions`/`indices`
 * de una `MallaRender`/`MallaDecimada` al backend (`SpdaMalla.positions`/
 * `.indices`, bytes crudos) dentro de un body JSON.
 *
 * Por qué no `btoa(String.fromCharCode(...bytes))` directo: con un array de
 * cientos de miles de elementos, el spread revienta el límite de argumentos de
 * `String.fromCharCode` ("Maximum call stack size exceeded"). Se arma la
 * cadena binaria por chunks para evitarlo.
 */
function bytesABase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000; // 32K por vez
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Codifica un array tipado (Float32Array, Uint32Array, …) a base64. */
export function typedArrayABase64(arr: { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }): string {
  return bytesABase64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
}

/** Inverso de `typedArrayABase64` — decodifica a bytes crudos para reconstruir un Float32Array/Uint32Array encima. */
export function base64ABytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
