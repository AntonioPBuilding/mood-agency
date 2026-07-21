/**
 * Micro-copy del CHROME de la interfaz.
 *
 * `@/content` es el copy del PRODUCTO (lo que Mood Control vende). Esto es otra
 * cosa: etiquetas del HUD, glifos del cursor, textos del preloader. No pertenece
 * a `content.ts` —un cambio de servicios no debería tocar el preloader— pero
 * tampoco puede vivir suelto dentro de un `.tsx`. Vive acá, en un solo sitio.
 */

import type { ChapterId } from '@/core/chapters'

/**
 * Nombre legible de cada capítulo para el HUD. Se muestra en mayúsculas por CSS.
 *
 * ⚠ Las CLAVES son ids técnicos (`controlIntro`, `netServices`) y los VALORES
 * son marcas. No coinciden y no tienen por qué: `control` es el mundo de eventos
 * (Mood Agency) y `net` el de tecnología (Mood Creative). Ver `@/content`.
 */
export const CHAPTER_LABELS: Record<ChapterId, string> = {
  hero: 'Inicio',
  manifesto: 'Manifiesto',
  division: 'División',
  controlIntro: 'Mood Agency',
  controlServices: 'Servicios de eventos',
  gallery: 'Galería',
  blackout: 'Apagón',
  netIntro: 'Mood Creative',
  netServices: 'Servicios de tecnología',
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
 * Copy de los atajos de teclado.
 *
 * Nadie lo ve con el ratón y por eso mismo es lo primero que se abandona. Acá
 * está tratado como copy de primera: es lo primero que oye quien navega con
 * lector de pantalla, y en una landing de 25 viewports de scroll narrativo la
 * diferencia entre poder saltar al formulario y no poder es la diferencia entre
 * un lead y un abandono.
 */
export const A11Y_COPY = {
  /** Nombre del landmark de navegación que agrupa los atajos. */
  navLabel: 'Atajos de teclado',
  skipToContent: 'Saltar al contenido',
  skipToContact: 'Ir al formulario de contacto',
} as const

/**
 * Alfabeto del cifrado de Mood Creative. Katakana + símbolos técnicos: da ruido
 * denso y de ancho parecido en mono, que es lo que vende el efecto. Sin
 * espacios ni glifos estrechos (`i`, `l`) que hagan saltar el texto.
 */
export const DECODE_GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$*+=<>/\\'
