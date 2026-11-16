import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests de validación de cálculos (`npm test`). Mismo alias `@/` que tsconfig.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'] },
})
