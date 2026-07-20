import { Fragment, useEffect, useRef } from 'react'
import { AGENCY } from '@/content'
import { getQuality } from '@/core/quality'
import { SplitText } from '@/ui'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
import { ACCENT, INK, alpha, chapterMeta } from './_tokens'

/**
 * MANIFIESTO — el texto se ilumina a medida que se lee.
 *
 * La palabra que ya pasaste queda a opacidad plena; la que falta, apagada. El
 * efecto lo hace un `stagger` dentro de un tween con `scrub`: GSAP reparte el
 * retardo de cada palabra a lo largo del recorrido de scroll. Cero timers, cero
 * IntersectionObserver, cero estado de React por frame.
 *
 * Las palabras en caja alta del claim se pintan con el acento del mundo: no hay
 * marcado especial en el copy, se detectan por su propia forma.
 */

const LINES = AGENCY.claim.map((line) => line.split(' '))
const META = chapterMeta('manifesto')

const isShouted = (word: string) => {
  const letters = word.replace(/[^\p{L}]/gu, '')
  return letters.length > 1 && letters === letters.toLocaleUpperCase('es')
}

export function Manifesto(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    // Sin movimiento: el manifiesto se lee entero, a plena opacidad, de una.
    if (getQuality().reduced) return

    const ctx = gsap.context(() => {
      // `toArray` no hereda el scope del context: hay que pasarle la raíz.
      const words = gsap.utils.toArray<HTMLElement>('[data-word]', el)
      gsap.set(words, { opacity: 0.12 })
      gsap.to(words, {
        opacity: 1,
        ease: 'none',
        stagger: 1,
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          // El recorrido "pegado" es exactamente alto de sección menos viewport.
          end: 'bottom bottom',
          scrub: 0.4,
        },
      })
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <ChapterSection
      id="manifesto"
      sectionRef={sectionRef}
      innerClassName="justify-center gap-[6vh] px-5 md:px-10"
    >
      <p className="type-label" style={{ color: alpha(INK, 35) }}>
        {META.index}
      </p>

      <h2 className="type-huge max-w-[22ch] text-balance">
        {LINES.map((words, li) => (
          <span key={li} className="block">
            {words.map((word, wi) => (
              <Fragment key={`${li}-${wi}`}>
                <span
                  data-word
                  className="inline-block"
                  style={isShouted(word) ? { color: ACCENT } : undefined}
                >
                  {word}
                </span>{' '}
              </Fragment>
            ))}
          </span>
        ))}
      </h2>

      <SplitText
        as="p"
        by="line"
        stagger={0.08}
        className="text-lead max-w-[46ch] self-end leading-snug md:max-w-[38ch]"
      >
        {AGENCY.manifesto}
      </SplitText>
    </ChapterSection>
  )
}
