import type { CSSProperties, ReactNode, RefObject } from 'react'
import type { ChapterId } from '@/core/chapters'
import { CHAPTER_MAP } from '@/core/chapters'

/**
 * CARCASA DE CAPÍTULO.
 *
 * La altura NO se elige por gusto: sale de `CHAPTER_MAP[id].vh`, que es la misma
 * fuente que usa la escena 3D para saber dónde está cada estado del Núcleo. Si
 * un capítulo hardcodea su alto, el DOM y el Núcleo se desincronizan y toda la
 * narrativa se rompe.
 *
 * `sticky` es el modo por defecto: la sección mide varios viewports para dar
 * recorrido de scroll, pero lo que se ve queda clavado en pantalla mientras ese
 * recorrido se consume. Los capítulos-lista (servicios, planes) lo apagan porque
 * su contenido ES más alto que la pantalla y tiene que fluir.
 *
 * ── ALTO EXACTO vs. ALTO MÍNIMO ─────────────────────────────────────────────
 *
 * Los dos modos NO piden lo mismo al navegador:
 *
 * - STICKY → `height` exacto (`chapter-track`). El recorrido pegado es
 *   literalmente `alto de sección − viewport`; si la sección pudiera crecer, ese
 *   recorrido crecería con ella y el capítulo se quedaría clavado de más.
 *
 * - FLUJO → `min-height` (`chapter-flow`). Acá el `vh` es un PRESUPUESTO de
 *   scroll, no una jaula. Con `height` fijo, un capítulo cuyo contenido no entra
 *   —móvil estrecho, tipografía grande, texto traducido— se derramaba encima del
 *   capítulo siguiente, porque la sección de al lado empieza donde termina la
 *   caja, no donde termina el contenido. Ahora la sección crece lo que haga
 *   falta. Cuesta un poco de documento de más; el solape costaba la lectura.
 *
 * El `flex-auto` del contenedor interno es lo que hace que las dos cosas
 * convivan: `flex: 1 1 auto` parte del alto REAL del contenido y sólo se estira
 * para rellenar el mínimo. Con `flex-1` (`flex: 1 1 0%`) la base sería 0, la
 * sección no sabría que su contenido es más alto y volveríamos al derrame.
 *
 * La unidad es `svh` con fallback a `vh` — el porqué está en `index.css`.
 */

interface ChapterSectionProps {
  id: ChapterId
  children: ReactNode
  /** Clases del `<section>` alto. */
  className?: string
  /** Clases del contenedor visible. */
  innerClassName?: string
  sticky?: boolean
  /** Para colgar ScrollTriggers del rango completo del capítulo. */
  sectionRef?: RefObject<HTMLElement | null>
  /** Sólo cuando sale de `@/content`: un landmark sin nombre no es un landmark. */
  ariaLabel?: string
}

export function ChapterSection({
  id,
  children,
  className = '',
  innerClassName = '',
  sticky = true,
  sectionRef,
  ariaLabel,
}: ChapterSectionProps): React.JSX.Element {
  const { vh } = CHAPTER_MAP[id]

  return (
    <section
      id={`chapter-${id}`}
      ref={sectionRef}
      data-chapter={id}
      aria-label={ariaLabel}
      // String y no número: React no le pone `px` a las custom properties, pero
      // dejarlo explícito evita depender de ese detalle de implementación.
      style={{ '--chapter-vh': String(vh) } as CSSProperties}
      /* El `flex flex-col` es SÓLO del modo flujo, que es quien lo necesita para
         que `flex-auto` sepa estirarse hasta el mínimo. En sticky la sección
         sigue siendo un bloque, igual que siempre: como contenedor flex, un
         capítulo con `vh < 1` encogería su propio viewport pegado (`flex-shrink`
         vale 1 por defecto) y el contenido se cortaría. Hoy ningún capítulo
         sticky mide menos de 1.5, pero no es una propiedad que deba sostenerse
         sola. */
      className={`relative w-full ${
        sticky ? 'chapter-track' : 'chapter-flow flex flex-col'
      } ${className}`}
    >
      <div
        className={
          sticky
            ? `chapter-viewport sticky top-0 flex w-full flex-col overflow-hidden ${innerClassName}`
            : `relative flex w-full flex-auto flex-col ${innerClassName}`
        }
      >
        {children}
      </div>
    </section>
  )
}
