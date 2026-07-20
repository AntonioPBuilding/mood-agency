/**
 * Puente entre los tokens CSS y los estilos inline de las secciones.
 *
 * Regla del proyecto: ningún hex a mano. Pero Tailwind no puede generar TODA la
 * combinación de token × alfa × gradiente que necesita una landing así, y las
 * clases construidas por interpolación no las ve el escáner (salen invisibles en
 * producción). Solución: `color-mix` sobre la variable, en un `style` inline.
 * El color sigue viniendo del token; sólo la mezcla se hace en el componente.
 */

import type { ChapterId } from '@/core/chapters'
import { CHAPTERS } from '@/core/chapters'

/** Alfa sobre cualquier token de color, sin tocar el token. */
export const alpha = (token: string, pct: number) =>
  `color-mix(in srgb, ${token} ${pct}%, transparent)`

/* Mundo activo: se interpolan solos vía `useWorldSync`. */
export const INK = 'var(--world-ink)'
export const ACCENT = 'var(--world-accent)'
export const ACCENT2 = 'var(--world-accent-2)'
export const BG = 'var(--world-bg)'

/* Tokens fijos: para capítulos que pertenecen a un mundo concreto y NO deben
   seguir la mezcla global (el neón de Control no puede enfriarse a mitad de
   Control sólo porque Net ya se está acercando). */
export const CONTROL_BG = 'var(--color-control-bg)'
export const CONTROL_VIOLET = 'var(--color-control-violet)'
export const CONTROL_BLUE = 'var(--color-control-blue)'
export const CONTROL_RED = 'var(--color-control-red)'
export const NET_CYAN = 'var(--color-net-cyan)'
export const NET_BLUE = 'var(--color-net-blue)'
export const NET_GREY = 'var(--color-net-grey)'

/** Easing compartido con el CSS: nada lineal en esta landing. */
export const EASE_OUT_EXPO = 'var(--ease-out-expo)'

/**
 * Metadatos de capítulo formateados como label técnico.
 * Es dato derivado del timeline, no copy: por eso puede vivir en el componente.
 */
export function chapterMeta(id: ChapterId) {
  const index = CHAPTERS.findIndex((c) => c.id === id) + 1
  const chapter = CHAPTERS[index - 1]
  return {
    index: `${String(index).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`,
    span: `${chapter.start.toFixed(3)} → ${chapter.end.toFixed(3)}`,
  }
}
