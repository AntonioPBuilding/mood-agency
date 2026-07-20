/**
 * Geometría compartida de la escena.
 *
 * Vive aparte porque Particles, Net y Scene necesitan LOS MISMOS números: si la
 * retícula de partículas y los nodos de la red se calculan por separado, en
 * cuanto alguien toque una constante dejan de coincidir y la red se ve flotando
 * sobre el polvo en vez de emergiendo de él.
 */

import { getQuality } from '@/core/quality'

/* ─────────────────────────  ESTADO 5 · LA RETÍCULA  ────────────────────── */

export interface GridSpec {
  cols: number
  rows: number
  layers: number
  width: number
  height: number
  depth: number
}

/**
 * Caja de la retícula, con proporción ~16:9:9 (panorámica, como la pantalla).
 * Las divisiones salen del presupuesto de partículas, no de un número mágico:
 * la misma estructura se ve igual de nítida con 18.000 que con 120.000.
 */
export function makeGrid(): GridSpec {
  const n = getQuality().particles
  const k = Math.cbrt(n / (16 * 9 * 9))
  return {
    cols: Math.max(4, Math.round(16 * k)),
    rows: Math.max(3, Math.round(9 * k)),
    layers: Math.max(3, Math.round(9 * k)),
    width: 11,
    height: 6.2,
    depth: 6.2,
  }
}

/** Coordenada de mundo de la celda (ix, iy, iz). */
export function gridCell(g: GridSpec, ix: number, iy: number, iz: number, out: [number, number, number]) {
  out[0] = (ix / (g.cols - 1) - 0.5) * g.width
  out[1] = (iy / (g.rows - 1) - 0.5) * g.height
  out[2] = (iz / (g.layers - 1) - 0.5) * g.depth
  return out
}

/* ──────────────────────────  ESTADO 6 · CRISTALES  ─────────────────────── */

/**
 * Con `reduced` la cámara no viaja, así que los tres cristales tienen que
 * caber en un solo encuadre: se juntan y se achican. La historia (uno simple,
 * uno refractante, uno imposible) se cuenta igual.
 */
export const CRYSTAL_SLOTS: readonly number[] = getQuality().reduced
  ? [-2.15, 0, 2.15]
  : [-3.5, 0, 3.7]

export const CRYSTAL_SCALE = getQuality().reduced ? 0.72 : 1
