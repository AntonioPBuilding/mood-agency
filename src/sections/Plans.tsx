import { useEffect, useRef } from 'react'
import { PLANS, PRICING_NOTE } from '@/content'
import type { Plan } from '@/content'
import { getQuality } from '@/core/quality'
import { MagneticButton } from '@/ui'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
import { BG, INK, NET_BLUE, NET_CYAN, NET_GREY, alpha } from './_tokens'

/**
 * PLANES — tres cristales, no una tabla de precios.
 *
 * El brief prohíbe cifras, así que lo que escala NO es un número: es la propia
 * pieza. `plan.level` gobierna el borde, el glow, la densidad de detalle y el
 * tamaño tipográfico. El usuario entiende que Premium cuesta más porque el panel
 * de Premium ES más — no porque se lo diga un importe.
 *
 * En móvil los paneles fluyen uno debajo de otro; en escritorio el bloque queda
 * pegado en pantalla y los tres aparecen en secuencia con el scroll. Misma
 * narrativa, dos formatos.
 */

interface LevelStyle {
  border: string
  glow: string
  surface: string
  name: string
  padding: string
  emphasis: string
}

const LEVELS: Record<Plan['level'], LevelStyle> = {
  1: {
    border: alpha(NET_GREY, 22),
    glow: 'none',
    surface: alpha(BG, 60),
    name: 'text-2xl md:text-3xl',
    padding: 'p-5 md:p-6',
    emphasis: '',
  },
  2: {
    border: alpha(NET_CYAN, 34),
    glow: `0 0 60px -30px ${NET_CYAN}`,
    surface: `linear-gradient(180deg, ${alpha(NET_BLUE, 10)} 0%, ${alpha(BG, 70)} 60%)`,
    name: 'text-3xl md:text-4xl',
    padding: 'p-6 md:p-7',
    emphasis: '',
  },
  3: {
    border: alpha(NET_CYAN, 62),
    glow: `0 0 90px -26px ${NET_CYAN}, inset 0 0 90px -55px ${NET_BLUE}`,
    surface: `linear-gradient(160deg, ${alpha(NET_CYAN, 16)} 0%, ${alpha(NET_BLUE, 10)} 45%, ${alpha(BG, 80)} 100%)`,
    name: 'text-4xl md:text-5xl',
    padding: 'p-6 md:p-8',
    // Premium tiene que sentirse de otra liga incluso de reojo.
    emphasis: 'md:-translate-y-3 md:scale-[1.03]',
  },
}

/** Marcas de esquina: sólo a partir del nivel 2. La densidad es la jerarquía. */
function Corners({ color }: { color: string }) {
  const common = 'pointer-events-none absolute h-3 w-3'
  return (
    <span aria-hidden="true">
      <span className={`${common} left-0 top-0 border-l border-t`} style={{ borderColor: color }} />
      <span className={`${common} right-0 top-0 border-r border-t`} style={{ borderColor: color }} />
      <span className={`${common} bottom-0 left-0 border-b border-l`} style={{ borderColor: color }} />
      <span className={`${common} bottom-0 right-0 border-b border-r`} style={{ borderColor: color }} />
    </span>
  )
}

export function Plans(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || getQuality().reduced) return

    const ctx = gsap.context(() => {
      const panels = gsap.utils.toArray<HTMLElement>('[data-panel]', el)
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
      })
      // Aparecen en secuencia: el scroll es el que va montando la oferta.
      panels.forEach((panel, i) => {
        tl.fromTo(
          panel,
          { yPercent: 14, opacity: 0 },
          { yPercent: 0, opacity: 1, ease: 'power2.out' },
          i * 0.3,
        )
      })
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <ChapterSection id="plans" sectionRef={sectionRef} sticky={false}>
      <div className="flex flex-col gap-[5vh] px-5 py-[12vh] md:sticky md:top-0 md:h-screen md:justify-center md:px-10 md:py-[8vh]">
        <ul className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3 md:gap-5">
          {PLANS.map((plan, i) => {
            const level = LEVELS[plan.level]
            return (
              <li
                key={plan.id}
                data-panel
                className={`gpu relative flex flex-col ${level.padding} ${level.emphasis}`}
                style={{
                  border: `1px solid ${level.border}`,
                  background: level.surface,
                  boxShadow: level.glow,
                }}
              >
                {plan.level > 1 && <Corners color={level.border} />}

                <header className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="type-label" style={{ color: alpha(INK, 40) }}>
                      {plan.id.toUpperCase()}
                    </span>
                    {/* Nivel como escala visual, no como número suelto. */}
                    <span aria-hidden="true" className="flex gap-1">
                      {[1, 2, 3].map((step) => (
                        <span
                          key={step}
                          className="h-1.5 w-1.5"
                          style={{
                            backgroundColor:
                              step <= plan.level ? NET_CYAN : alpha(NET_GREY, 25),
                          }}
                        />
                      ))}
                    </span>
                  </div>

                  <h2 className={`${level.name} font-semibold uppercase leading-none`}>
                    {plan.name}
                  </h2>

                  <p className="type-label" style={{ color: NET_CYAN }}>
                    {plan.priceHint}
                  </p>

                  <p className="text-sm leading-snug" style={{ color: alpha(INK, 65) }}>
                    {plan.pitch}
                  </p>
                </header>

                {plan.inherits && (
                  <p
                    className="mt-5 border-l-2 pl-3 text-sm font-medium"
                    style={{ borderColor: NET_CYAN, color: alpha(INK, 85) }}
                  >
                    <span aria-hidden="true" style={{ color: NET_CYAN }}>
                      +{' '}
                    </span>
                    {plan.inherits}
                  </p>
                )}

                <ul className="mt-5 flex flex-1 flex-col gap-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-baseline gap-3 text-sm">
                      <span
                        aria-hidden="true"
                        className="h-px w-3 shrink-0 translate-y-[-0.25em]"
                        style={{ backgroundColor: plan.level === 3 ? NET_CYAN : alpha(NET_GREY, 60) }}
                      />
                      <span style={{ color: alpha(INK, plan.level === 3 ? 92 : 78) }}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  {/* `neon` ya declara data-cursor="cta" por dentro: el botón es
                      dueño de cómo reacciona el cursor a su propia variante. */}
                  <MagneticButton variant="neon" href="#chapter-converge" className="w-full">
                    {plan.cta}
                  </MagneticButton>
                </div>

                <span className="type-label mt-4" style={{ color: alpha(INK, 25) }}>
                  {String(i + 1).padStart(2, '0')} / {String(PLANS.length).padStart(2, '0')}
                </span>
              </li>
            )
          })}
        </ul>

        {/* `type-label` está pensado para 3 palabras: con 40 el tracking de
            0.22em lo vuelve ilegible. Mono normal, que es lo que pide el texto. */}
        <p
          className="mx-auto max-w-[68ch] text-center font-mono text-xs leading-relaxed"
          style={{ color: alpha(INK, 45) }}
        >
          {PRICING_NOTE}
        </p>
      </div>
    </ChapterSection>
  )
}
