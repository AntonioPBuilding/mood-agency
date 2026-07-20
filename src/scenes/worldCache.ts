/**
 * Caché del mundo mezclado.
 *
 * `blendWorld()` devuelve un objeto nuevo y CINCO strings de color en cada
 * llamada. Llamarla desde `useFrame` son ~21.600 objetos por minuto tirados al
 * recolector, y un GC en mitad del apagón se ve como un tirón. Pero tampoco
 * queremos reimplementar la paleta acá: la fuente de verdad es `@/core/palette`
 * y punto.
 *
 * Solución: la llamamos igual, pero cuantizando el progreso a 500 pasos. Un
 * paso es 1/500 de la landing —medio golpe de rueda— así que el color no se
 * escalona a la vista, y el coste pasa de por-frame a por-tramo.
 *
 * Todas las escenas leen de acá, así que además comparten EXACTAMENTE el mismo
 * color en el mismo frame: cero desfase entre niebla, partículas y post-fx.
 */

import { Color } from 'three'
import { blendWorld } from '@/core/palette'

export interface CachedWorld {
  bg: Color
  ink: Color
  accent: Color
  accent2: Color
  accent3: Color
  bloom: number
  fog: number
  chroma: number
}

const cached: CachedWorld = {
  bg: new Color('#050505'),
  ink: new Color('#F2F0EB'),
  accent: new Color('#F2F0EB'),
  accent2: new Color('#8A7CFF'),
  accent3: new Color('#FF7A59'),
  bloom: 0.35,
  fog: 0.035,
  chroma: 0.0006,
}

let lastStep = -1

/** Mundo activo para este progreso. NO guardes la referencia: se muta. */
export function readWorld(progress: number): CachedWorld {
  const step = Math.round(progress * 500)
  if (step === lastStep) return cached
  lastStep = step

  const w = blendWorld(progress)
  cached.bg.set(w.bg)
  cached.ink.set(w.ink)
  cached.accent.set(w.accent)
  cached.accent2.set(w.accent2)
  cached.accent3.set(w.accent3)
  cached.bloom = w.bloom
  cached.fog = w.fog
  cached.chroma = w.chroma

  return cached
}
