/**
 * Store de scroll global.
 *
 * REGLA DE ORO DEL PROYECTO:
 * la escena 3D NUNCA lee el scroll vía estado de React. Lee `scroll` —un objeto
 * mutable— dentro de `useFrame`. Si metés el progreso en un `useState`, disparás
 * un re-render por frame y te comés el presupuesto de 16.6ms antes de dibujar
 * un solo triángulo.
 *
 * `subscribe()` existe sólo para consumidores de baja frecuencia (por ejemplo,
 * cambiar el modo del cursor al entrar en otro mundo), y emite con throttling.
 */

import type { ChapterId, WorldId } from './chapters'
import { CHAPTERS, clamp01 } from './chapters'

export interface ScrollState {
  /** Progreso global normalizado 0 → 1 del documento entero. */
  progress: number
  /** Velocidad instantánea de Lenis (px/frame). Alimenta distorsiones. */
  velocity: number
  /** Velocidad normalizada y suavizada, ~0 → 1. Para shaders. */
  speed: number
  /** 1 hacia abajo, -1 hacia arriba. */
  direction: 1 | -1
  /** Capítulo activo. */
  chapter: ChapterId
  /** Mundo cromático activo. */
  world: WorldId
  /** Progreso local 0 → 1 dentro del capítulo activo. */
  local: number
}

/** Objeto mutable. Leelo en useFrame. NO lo reemplaces, mutá sus campos. */
export const scroll: ScrollState = {
  progress: 0,
  velocity: 0,
  speed: 0,
  direction: 1,
  chapter: 'hero',
  world: 'void',
  local: 0,
}

type Listener = (s: Readonly<ScrollState>) => void
const listeners = new Set<Listener>()

let lastChapter: ChapterId = 'hero'

/** Suscripción de baja frecuencia: sólo emite cuando cambia el capítulo. */
export function subscribeChapter(fn: Listener): () => void {
  listeners.add(fn)
  fn(scroll)
  return () => listeners.delete(fn)
}

function resolveChapter(progress: number) {
  for (const c of CHAPTERS) {
    if (progress < c.end) return c
  }
  return CHAPTERS[CHAPTERS.length - 1]
}

/**
 * Único punto de escritura del store. Lo llama el driver de Lenis.
 * Nada más debería tocar `scroll` directamente.
 */
export function commitScroll(progress: number, velocity: number) {
  const p = clamp01(progress)
  scroll.direction = velocity >= 0 ? 1 : -1
  scroll.progress = p
  scroll.velocity = velocity

  // Suavizado exponencial: evita que un flick del trackpad rompa los shaders.
  const target = Math.min(Math.abs(velocity) / 40, 1)
  scroll.speed += (target - scroll.speed) * 0.1

  const c = resolveChapter(p)
  scroll.chapter = c.id
  scroll.world = c.world
  scroll.local = clamp01((p - c.start) / (c.end - c.start))

  if (c.id !== lastChapter) {
    lastChapter = c.id
    for (const fn of listeners) fn(scroll)
  }
}
