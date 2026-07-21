import { useEffect, useRef } from 'react'
import { METHOD, STACK } from '@/content'
import { getQuality } from '@/core/quality'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
import { INK, NET_CYAN, NET_GREY, alpha } from './_tokens'

/**
 * STACK + MÉTODO.
 *
 * El marquee se mueve con UN tween de `xPercent` sobre una fila que contiene la
 * lista dos veces: al llegar a -50% la segunda copia está exactamente donde
 * empezó la primera, así que el bucle no tiene costura. Duplicar en el DOM sale
 * más barato que reordenar nodos por frame.
 *
 * La copia duplicada va `aria-hidden`: visualmente es el truco del bucle, pero
 * nadie tiene que oír el stack dos veces.
 */

type Tween = ReturnType<typeof gsap.to>

function MarqueeRow({ reverse, speed }: { reverse: boolean; speed: number }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const tweenRef = useRef<Tween | null>(null)

  useEffect(() => {
    const row = rowRef.current
    if (!row || getQuality().reduced) return

    tweenRef.current = reverse
      ? gsap.fromTo(
          row,
          { xPercent: -50 },
          { xPercent: 0, duration: speed, ease: 'none', repeat: -1 },
        )
      : gsap.to(row, { xPercent: -50, duration: speed, ease: 'none', repeat: -1 })

    return () => {
      tweenRef.current?.kill()
      tweenRef.current = null
    }
  }, [reverse, speed])

  const pause = () => tweenRef.current?.pause()
  const resume = () => tweenRef.current?.resume()

  const items = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-8 pr-8 md:gap-14 md:pr-14" aria-hidden={hidden}>
      {STACK.map((tech) => (
        <li
          key={tech}
          className="type-huge shrink-0 uppercase"
          style={{ color: alpha(INK, 22) }}
        >
          {tech}
        </li>
      ))}
    </ul>
  )

  return (
    <div
      className="w-full overflow-hidden"
      onPointerEnter={pause}
      onPointerLeave={resume}
      data-cursor="text"
    >
      <div ref={rowRef} className="gpu flex w-max">
        {items(false)}
        {items(true)}
      </div>
    </div>
  )
}

export function Stack(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || getQuality().reduced) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: '[data-method]', start: 'top 80%', end: 'bottom 70%', scrub: 0.5 },
      })
      // La línea se DIBUJA: escala, no ancho. Animar `width` reflowearía los
      // cuatro pasos en cada frame del scroll.
      tl.fromTo('[data-track-h]', { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0)
        .fromTo('[data-track-v]', { scaleY: 0 }, { scaleY: 1, ease: 'none' }, 0)
        .fromTo(
          '[data-step]',
          { opacity: 0, yPercent: 25 },
          { opacity: 1, yPercent: 0, ease: 'power2.out', stagger: 0.25 },
          0.1,
        )
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <ChapterSection
      id="stack"
      sectionRef={sectionRef}
      sticky={false}
      innerClassName="justify-center gap-[7vh] py-[10vh] md:gap-[10vh] md:py-[16vh]"
    >
      <div className="flex flex-col gap-4 md:gap-6">
        <MarqueeRow reverse={false} speed={38} />
        <MarqueeRow reverse speed={32} />
      </div>

      <div data-method className="relative px-5 md:px-10">
        {/* Riel horizontal (escritorio) y vertical (móvil): sólo uno se ve. */}
        <span
          data-track-h
          aria-hidden="true"
          className="gpu absolute left-5 right-5 top-0 hidden h-px origin-left md:block"
          style={{ backgroundColor: alpha(NET_CYAN, 45) }}
        />
        <span
          data-track-v
          aria-hidden="true"
          className="gpu absolute bottom-0 left-5 top-0 w-px origin-top md:hidden"
          style={{ backgroundColor: alpha(NET_CYAN, 45) }}
        />

        <ol className="grid grid-cols-1 gap-10 pl-8 md:grid-cols-4 md:gap-6 md:pl-0 md:pt-10">
          {METHOD.map((step) => (
            <li key={step.n} data-step className="gpu relative flex flex-col gap-3">
              <span
                aria-hidden="true"
                /* Centrado exacto sobre el riel: el punto mide 0.5rem, así que
                   su borde va medio punto antes de la línea. */
                className="absolute -left-[2.25rem] top-2 h-2 w-2 md:-top-[2.75rem] md:left-0"
                style={{ backgroundColor: NET_CYAN }}
              />
              <span className="type-label" style={{ color: alpha(NET_GREY, 60) }}>
                {step.n}
              </span>
              <h2 className="text-2xl font-semibold uppercase leading-none md:text-3xl">
                {step.title}
              </h2>
              <p className="max-w-[34ch] text-sm leading-snug" style={{ color: alpha(INK, 60) }}>
                {step.desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </ChapterSection>
  )
}
