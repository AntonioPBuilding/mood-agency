import type { ReactNode, RefObject } from 'react'
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
      style={{ height: `${vh * 100}vh` }}
      className={`relative w-full ${className}`}
    >
      <div
        className={
          sticky
            ? `sticky top-0 flex h-screen w-full flex-col overflow-hidden ${innerClassName}`
            : `relative flex min-h-full w-full flex-col ${innerClassName}`
        }
      >
        {children}
      </div>
    </section>
  )
}
