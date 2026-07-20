/**
 * Micro-copy del CHROME de la interfaz.
 *
 * `@/content` es el copy del PRODUCTO (lo que Mood Agency vende). Esto es otra
 * cosa: etiquetas del HUD, glifos del cursor, textos del preloader. No pertenece
 * a `content.ts` —un cambio de servicios no debería tocar el preloader— pero
 * tampoco puede vivir suelto dentro de un `.tsx`. Vive acá, en un solo sitio.
 */

import type { ChapterId } from '@/core/chapters'

/** Nombre legible de cada capítulo para el HUD. Se muestra en mayúsculas por CSS. */
export const CHAPTER_LABELS: Record<ChapterId, string> = {
  hero: 'Inicio',
  manifesto: 'Manifiesto',
  division: 'División',
  controlIntro: 'Mood Control',
  controlServices: 'Servicios Control',
  gallery: 'Galería',
  blackout: 'Apagón',
  netIntro: 'Mood Net',
  netServices: 'Servicios Net',
  plans: 'Planes',
  stack: 'Stack',
  clients: 'Clientes',
  converge: 'Convergencia',
  footer: 'Contacto',
}

export const CURSOR_COPY = {
  /** Fallback del modo `cta` cuando el elemento no declara `data-cursor-label`. */
  ctaLabel: 'Ver',
  dragGlyph: '↔',
} as const

export const PRELOADER_COPY = {
  wordmark: 'MOOD',
  enter: 'Enter the mood',
  /** Se anuncia a lectores de pantalla mientras el contador corre. */
  loading: 'Cargando experiencia',
} as const

/**
 * Alfabeto del cifrado de Mood Net. Katakana + símbolos técnicos: da ruido
 * denso y de ancho parecido en mono, que es lo que vende el efecto. Sin
 * espacios ni glifos estrechos (`i`, `l`) que hagan saltar el texto.
 */
export const DECODE_GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$*+=<>/\\'
