import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { BRAND } from '@/content'
import { getQuality } from '@/core/quality'
import { SplitText } from '@/ui'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
import { ACCENT, INK, alpha, chapterMeta } from './_tokens'

/**
 * HERO — el centro es zona prohibida.
 *
 * La esfera del Núcleo vive exactamente en el medio de la pantalla. Por eso el
 * titular NO va centrado: se parte en dos palabras, una arriba a la izquierda y
 * otra abajo a la derecha, y el 3D respira en el hueco. Es el layout el que deja
 * hablar a la escena, no un `z-index`.
 *
 * El texto va en minúsculas en el DOM y se sube a mayúsculas por CSS: muchos
 * lectores de pantalla deletrean las palabras escritas en caja alta real.
 */

const WORDS = BRAND.name.split(' ')
const META = chapterMeta('hero')

export function Hero(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null)
  // El CSS ya frena las animaciones declarativas, pero `motion` corre en JS:
  // hay que apagarlo a mano o el pulso sigue latiendo igual.
  const reduced = getQuality().reduced

  useEffect(() => {
    const el = sectionRef.current
    if (!el || getQuality().reduced) return

    const ctx = gsap.context(() => {
      // Las palabras se abren hacia los bordes a medida que el capítulo se
      // consume: el hueco central crece justo cuando la esfera empieza a mandar.
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 },
      })
      tl.to('[data-word="0"]', { xPercent: -10, ease: 'none' }, 0)
        .to('[data-word="1"]', { xPercent: 10, ease: 'none' }, 0)
        .to('[data-fade]', { opacity: 0, ease: 'none' }, 0)
        .to(el, { opacity: 0, ease: 'none' }, 0.55)
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <ChapterSection
      id="hero"
      sectionRef={sectionRef}
      ariaLabel={BRAND.name}
      innerClassName="justify-between px-5 py-6 md:px-10 md:py-10"
    >
      <header className="flex items-start justify-between gap-6" data-fade>
        <p className="type-label max-w-[16ch]" style={{ color: alpha(INK, 65) }}>
          {BRAND.tagline}
        </p>
        <p className="type-label shrink-0" style={{ color: alpha(INK, 35) }}>
          {META.index}
        </p>
      </header>

      <h1 className="type-mega flex flex-1 flex-col justify-between py-[6vh] uppercase">
        {WORDS.map((word, i) => (
          <span
            key={word}
            data-word={i}
            className={`gpu block ${i % 2 === 0 ? 'self-start' : 'self-end'}`}
          >
            <SplitText by="char" stagger={0.045} trigger={false}>
              {word}
            </SplitText>
          </span>
        ))}
      </h1>

      {/* Hint de scroll: puro gesto, sin texto. Un pulso que baja por una línea
          de 1px. Decorativo de verdad, así que se oculta a la asistencia. */}
      <div className="flex justify-center" data-fade>
        <div
          aria-hidden="true"
          className="relative h-16 w-px overflow-hidden md:h-24"
          style={{ backgroundColor: alpha(INK, 18) }}
        >
          <motion.span
            className="absolute inset-x-0 top-0 block h-1/3"
            style={{ backgroundColor: ACCENT }}
            animate={reduced ? { y: '110%' } : { y: ['-110%', '320%'] }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 2.4, repeat: Infinity, ease: [0.83, 0, 0.17, 1] }
            }
          />
        </div>
      </div>
    </ChapterSection>
  )
}
