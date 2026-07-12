// Aritmética de números complejos para impedancias R + jX.
// No se usa un tipo complejo nativo porque TypeScript no trae uno; se implementa
// la estructura mínima que pide la spec (§12.2): add, mul, div, abs, parallel.

export type Complex = { re: number; im: number }

export const C = {
  of: (re: number, im = 0): Complex => ({ re, im }),

  add: (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im }),

  sub: (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im }),

  mul: (a: Complex, b: Complex): Complex => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  }),

  mulR: (a: Complex, k: number): Complex => ({ re: a.re * k, im: a.im * k }),

  div: (a: Complex, b: Complex): Complex => {
    const d = b.re * b.re + b.im * b.im
    if (d === 0) throw new Error('División compleja por cero')
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }
  },

  divR: (a: Complex, k: number): Complex => ({ re: a.re / k, im: a.im / k }),

  abs: (a: Complex): number => Math.sqrt(a.re * a.re + a.im * a.im),

  conj: (a: Complex): Complex => ({ re: a.re, im: -a.im }),

  isZero: (a: Complex, tol = 1e-9): boolean => C.abs(a) < tol,

  // Paralelo de N impedancias. Si alguna es (prácticamente) nula, el paralelo
  // completo es nulo — un camino de impedancia cero cortocircuita al resto,
  // no hace falta (ni se puede) invertirla. Ver spec §12.3.
  parallel: (...zs: Complex[]): Complex => {
    if (zs.length === 0) throw new Error('parallel requiere al menos una impedancia')
    if (zs.some(z => C.isZero(z))) return C.of(0, 0)
    if (zs.length === 1) return zs[0]
    let invSum = C.of(0, 0)
    for (const z of zs) invSum = C.add(invSum, C.div(C.of(1, 0), z))
    return C.div(C.of(1, 0), invSum)
  },
}
