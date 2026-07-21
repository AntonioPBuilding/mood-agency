import { useEffect, useRef } from 'react'
import { EVENTS, TECH } from '@/content'
import { getQuality } from '@/core/quality'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
import { CONTROL_VIOLET, INK, NET_CYAN, alpha } from './_tokens'

/**
 * LA DIVISIÓN — acá manda el 3D.
 *
 * El Núcleo se fractura y el wordmark se parte en dos. El DOM sólo pone los dos
 * nombres y se aparta: dos mitades que se alejan del centro mientras el scroll
 * avanza, y una línea de 1px que se abre entre ellas.
 *
 * La línea crece con `scaleY`, no con `height`: animar `height` dispara layout
 * en cada frame y este capítulo ya tiene a la escena entera encima.
 */

/* Izquierda el mundo de eventos (tokens `control`), derecha el de tecnología
   (tokens `net`). Los tokens conservan los ids técnicos; los nombres visibles
   son las marcas Mood Agency y Mood Creative. Ver la cabecera de `@/content`. */
const HALVES = [
  { name: EVENTS.name, kicker: EVENTS.kicker, tint: CONTROL_VIOLET, side: -1 },
  { name: TECH.name, kicker: TECH.kicker, tint: NET_CYAN, side: 1 },
] as const

export function Division(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || getQuality().reduced) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
      })
      tl.fromTo('[data-half="-1"]', { xPercent: 14 }, { xPercent: -12, ease: 'none' }, 0)
        .fromTo('[data-half="1"]', { xPercent: -14 }, { xPercent: 12, ease: 'none' }, 0)
        .fromTo('[data-rule]', { scaleY: 0 }, { scaleY: 1, ease: 'none' }, 0)
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <ChapterSection
      id="division"
      sectionRef={sectionRef}
      innerClassName="justify-center px-3 md:px-10"
    >
      <div className="relative grid grid-cols-2 items-center">
        {HALVES.map((half) => (
          <div
            key={half.name}
            data-half={half.side}
            /* Arrancan pegadas al corte central y se alejan hacia fuera:
               la separación tiene que NACER del centro, no terminar en él.

               `min-w-0` NO es cosmético: una celda de grid tiene `min-width:
               auto`, o sea que se niega a encoger por debajo de su contenido.
               A 375px cada mitad son 148px y la palabra más larga que se pinta
               acá —"CREATIVE", de Mood Creative— en `type-huge` ronda los 134:
               entra raspando, y sin `min-w-0` cualquier palabra un pelo más
               larga —o un idioma con palabras más largas— empujaría la columna
               y desbordaría la retícula en vez de partirse. Con `min-w-0` +
               `break-words` el modo de fallo es partir una línea, que se lee;
               el otro era texto fuera de pantalla. */
            className={`gpu flex min-w-0 flex-col gap-3 px-2 md:px-6 ${
              half.side < 0 ? 'items-end text-right' : 'items-start text-left'
            }`}
          >
            {/* 45% de opacidad sobre un campo de partículas era ilegible.
                Contraste alto + halo: el texto tiene que ganarle a la escena,
                no convivir con ella. */}
            {/* `max-w-[16ch]` cuenta anchos de "0", pero `type-label` lleva
                0.22em de tracking: cada carácter ocupa un 35% más de lo que el
                `ch` calcula. Sin `break-words`, "experiencias" se sale sola de
                su propia caja. */}
            <p
              className="type-label on-scene max-w-[16ch] break-words"
              style={{ color: alpha(INK, 92) }}
            >
              {half.kicker}
            </p>
            <h2
              className="type-huge flex min-w-0 flex-col break-words uppercase"
              style={{ color: half.tint }}
            >
              {half.name.split(' ').map((word) => (
                <span key={word} className="block">
                  {word}
                </span>
              ))}
            </h2>
          </div>
        ))}

        {/* Corte central. `origin-center` para que se abra desde el medio hacia
            arriba y abajo, igual que el Núcleo al fracturarse. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[46svh] w-px -translate-x-1/2 -translate-y-1/2"
        >
          {/* El centrado vive en el padre y la animación en el hijo: si GSAP
              tuviera que convivir con el `translate(-50%,-50%)` de Tailwind,
              acabaría reescribiendo la matriz entera. */}
          <span
            data-rule
            className="gpu block h-full w-full origin-center"
            style={{ backgroundColor: alpha(INK, 30) }}
          />
        </span>
      </div>
    </ChapterSection>
  )
}
