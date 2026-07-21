import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { EVENTS } from '@/content'
import { getQuality } from '@/core/quality'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
import { CONTROL_BLUE, CONTROL_RED, CONTROL_VIOLET, INK, alpha, chapterMeta } from './_tokens'

/**
 * MOOD AGENCY (capítulo `controlIntro`) — cartel de festival con la señal rota.
 *
 * La aberración cromática NO se hace con `text-shadow` animado: pintar sombras
 * de texto en cada frame es trabajo de CPU en el hilo principal. Se hace con dos
 * copias del titular, una roja y otra cian, en `mix-blend-screen`, desplazadas
 * sólo con `transform`. Mismo resultado óptico, coste de compositor.
 *
 * Las copias son `aria-hidden`: el lector de pantalla oye el nombre UNA vez.
 */

const WORDS = EVENTS.name.split(' ')
const META = chapterMeta('controlIntro')

/** Keyframes irregulares: un glitch regular deja de leerse como fallo.
 *
 *  Sin `as const`: éste congelaría los arrays como `readonly`, y los keyframes
 *  de motion son mutables (los resuelve in-place). Un `readonly` acá no gana
 *  nada y rompe el tipo. */
const GHOST: Record<'red' | 'blue', { x: number[]; y: number[] }> = {
  red: { x: [-4, 5, -2, 6, -3, -4], y: [2, -3, 1, -2, 3, 2] },
  blue: { x: [4, -5, 2, -6, 3, 4], y: [-2, 3, -1, 2, -3, -2] },
}

function Wordmark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span className={className} style={style}>
      {WORDS.map((word) => (
        <span key={word} className="block">
          {word}
        </span>
      ))}
    </span>
  )
}

export function ControlIntro(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null)
  const reduced = getQuality().reduced

  useEffect(() => {
    const el = sectionRef.current
    if (!el || reduced) return

    const ctx = gsap.context(() => {
      // El cartel entra desde abajo y se va escapando por arriba: el titular
      // atraviesa la pantalla en lugar de quedarse quieto esperando.
      gsap.fromTo(
        '[data-poster]',
        { yPercent: 6 },
        {
          yPercent: -6,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
        },
      )
    }, el)

    return () => ctx.revert()
  }, [reduced])

  const ghostTransition = reduced
    ? { duration: 0 }
    : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const, repeatType: 'mirror' as const }

  return (
    <ChapterSection
      id="controlIntro"
      sectionRef={sectionRef}
      ariaLabel={EVENTS.name}
      innerClassName="justify-between px-5 py-8 md:px-10 md:py-12"
    >
      <header
        className="flex items-baseline justify-between gap-4 border-b pb-4"
        style={{ borderColor: alpha(CONTROL_VIOLET, 35) }}
      >
        <p className="type-label" style={{ color: CONTROL_VIOLET }}>
          {EVENTS.kicker}
        </p>
        <p className="type-label shrink-0" style={{ color: alpha(INK, 35) }}>
          {META.index}
        </p>
      </header>

      <div data-poster className="gpu flex flex-1 items-center">
        <h2 className="type-mega relative w-full uppercase">
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 mix-blend-screen"
            animate={reduced ? { x: -3, y: 2 } : GHOST.red}
            transition={ghostTransition}
          >
            <Wordmark style={{ color: CONTROL_RED }} />
          </motion.span>

          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 mix-blend-screen"
            animate={reduced ? { x: 3, y: -2 } : GHOST.blue}
            transition={ghostTransition}
          >
            <Wordmark style={{ color: CONTROL_BLUE }} />
          </motion.span>

          <Wordmark className="relative block" />
        </h2>
      </div>

      <p
        className="text-lead max-w-[42ch] self-end text-balance"
        style={{ color: alpha(INK, 70) }}
      >
        {EVENTS.intro}
      </p>
    </ChapterSection>
  )
}
