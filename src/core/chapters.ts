/**
 * EL NÚCLEO — mapa narrativo.
 *
 * Toda la landing es UN timeline. Cada capítulo ocupa un rango del progreso
 * global de scroll (0 → 1). Tanto el DOM como la escena 3D leen de acá:
 * una sola fuente de verdad, cero desincronización.
 */

export type WorldId = 'void' | 'control' | 'net'

export type ChapterId =
  | 'hero'
  | 'manifesto'
  | 'division'
  | 'controlIntro'
  | 'controlServices'
  | 'gallery'
  | 'blackout'
  | 'netIntro'
  | 'netServices'
  | 'plans'
  | 'stack'
  | 'clients'
  | 'converge'
  | 'footer'

export interface Chapter {
  id: ChapterId
  /** Inicio en progreso global normalizado (0-1). */
  start: number
  /** Fin en progreso global normalizado (0-1). */
  end: number
  /** Mundo cromático activo durante el capítulo. */
  world: WorldId
  /** Alto de la sección en viewports. Define el ritmo del scroll. */
  vh: number
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'hero', start: 0.0, end: 0.08, world: 'void', vh: 2.0 },
  { id: 'manifesto', start: 0.08, end: 0.16, world: 'void', vh: 2.0 },
  { id: 'division', start: 0.16, end: 0.24, world: 'void', vh: 2.0 },
  { id: 'controlIntro', start: 0.24, end: 0.3, world: 'control', vh: 1.5 },
  { id: 'controlServices', start: 0.3, end: 0.4, world: 'control', vh: 2.5 },
  { id: 'gallery', start: 0.4, end: 0.48, world: 'control', vh: 2.0 },
  { id: 'blackout', start: 0.48, end: 0.54, world: 'control', vh: 1.5 },
  { id: 'netIntro', start: 0.54, end: 0.6, world: 'net', vh: 1.5 },
  { id: 'netServices', start: 0.6, end: 0.68, world: 'net', vh: 2.0 },
  { id: 'plans', start: 0.68, end: 0.8, world: 'net', vh: 3.0 },
  { id: 'stack', start: 0.8, end: 0.86, world: 'net', vh: 1.5 },
  { id: 'clients', start: 0.86, end: 0.9, world: 'net', vh: 1.0 },
  // 1.5, no 2.0: con el contenido alineado arriba, dos viewports dejaban medio
  // viewport muerto debajo del formulario.
  { id: 'converge', start: 0.9, end: 0.98, world: 'net', vh: 1.5 },
  { id: 'footer', start: 0.98, end: 1.0, world: 'net', vh: 0.6 },
] as const

export const CHAPTER_MAP = Object.fromEntries(
  CHAPTERS.map((c) => [c.id, c]),
) as Record<ChapterId, Chapter>

/** Clamp a [0,1]. */
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Interpolación lineal. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Progreso LOCAL dentro de un capítulo (0 antes de entrar, 1 al salir).
 * Es la primitiva que usan todas las animaciones scroll-linked.
 */
export function chapterProgress(globalProgress: number, id: ChapterId): number {
  const { start, end } = CHAPTER_MAP[id]
  return clamp01((globalProgress - start) / (end - start))
}

/**
 * Rampa suave dentro de un rango arbitrario del timeline global.
 * Útil para solapar animaciones entre capítulos vecinos.
 */
export function range(globalProgress: number, from: number, to: number): number {
  return clamp01((globalProgress - from) / (to - from))
}

/** Curva de entrada/salida: 0 → 1 → 0 dentro del rango. Para elementos efímeros. */
export function bump(globalProgress: number, from: number, to: number): number {
  const t = range(globalProgress, from, to)
  return Math.sin(t * Math.PI)
}

/** smoothstep de GLSL, en JS. Nada de movimiento lineal en la escena. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Altura total del documento, en viewports. */
export const TOTAL_VH = CHAPTERS.reduce((sum, c) => sum + c.vh, 0)
