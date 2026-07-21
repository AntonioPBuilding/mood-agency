import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { TECH } from '@/content'
import { getQuality } from '@/core/quality'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
import { BG, INK, NET_BLUE, NET_CYAN, NET_GREY, alpha } from './_tokens'

/**
 * SERVICIOS DE MOOD CREATIVE (capítulo `netServices`) — una red, no una tabla.
 *
 * Los servicios están conectados de verdad (`TECH.edges`): al enfocar un nodo se
 * encienden sus aristas y el resto se apaga. Eso comunica algo que una lista no
 * puede: que la IA no se vende sin automatización, ni una app sin infra.
 *
 * Las posiciones se calculan con `offsetLeft/offsetTop`, NO con
 * `getBoundingClientRect()`: el rect incluye los `transform` del reveal, así que
 * las líneas quedarían dibujadas donde los nodos estaban a mitad de animación.
 * `offset*` es geometría de layout: inmune a los transforms.
 */

/** Retícula asimétrica de 12 columnas. Una tabla sería una tabla. */
const LAYOUT: Record<string, { col: string; row: string }> = {
  web: { col: '1 / span 4', row: '1' },
  ux: { col: '6 / span 3', row: '1' },
  brand: { col: '10 / span 3', row: '2' },
  apps: { col: '2 / span 4', row: '3' },
  ai: { col: '7 / span 4', row: '4' },
  auto: { col: '1 / span 3', row: '5' },
  custom: { col: '9 / span 4', row: '5' },
  infra: { col: '4 / span 4', row: '6' },
}

interface Segment {
  key: string
  a: string
  b: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export function NetServices(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [active, setActive] = useState<string | null>(null)

  const measure = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return

    const centers = new Map<string, { x: number; y: number }>()
    grid.querySelectorAll<HTMLElement>('[data-node]').forEach((node) => {
      const id = node.dataset.node
      if (!id) return
      centers.set(id, {
        x: node.offsetLeft + node.offsetWidth / 2,
        y: node.offsetTop + node.offsetHeight / 2,
      })
    })

    setSegments(
      TECH.edges.flatMap(([a, b]) => {
        const from = centers.get(a)
        const to = centers.get(b)
        if (!from || !to) return []
        return [{ key: `${a}-${b}`, a, b, x1: from.x, y1: from.y, x2: to.x, y2: to.y }]
      }),
    )
  }, [])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    measure()
    // El reflow del texto cambia las alturas: hay que remedir, no asumir.
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [measure])

  useEffect(() => {
    const el = sectionRef.current
    if (!el || getQuality().reduced) return

    const ctx = gsap.context(() => {
      gsap.from(gsap.utils.toArray<HTMLElement>('[data-node]', el), {
        yPercent: 30,
        opacity: 0,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.06,
        scrollTrigger: { trigger: '[data-grid]', start: 'top 85%' },
      })
    }, el)

    return () => ctx.revert()
  }, [])

  const connected = new Set<string>()
  if (active) {
    connected.add(active)
    for (const [a, b] of TECH.edges) {
      if (a === active) connected.add(b)
      if (b === active) connected.add(a)
    }
  }

  return (
    <ChapterSection
      id="netServices"
      sectionRef={sectionRef}
      sticky={false}
      innerClassName="justify-center gap-[5vh] px-5 py-[9vh] md:gap-[7vh] md:px-10 md:py-[14vh]"
    >
      {/* ENCABEZADO EN DOS PISOS, y el de arriba no es decoración.
          El claim de la división es una frase de agencia: buena para el humano,
          muda para un buscador —no contiene ni una de las cosas que se venden—.
          El overline pone las palabras reales ("desarrollo web", "inteligencia
          artificial") DENTRO del `<h2>`, visibles, en la voz mono que ya habla
          esta división. Nada de texto oculto: si merece indexarse, merece leerse. */}
      <h2 className="flex flex-col gap-3 md:gap-4">
        <span className="type-label" style={{ color: NET_CYAN }}>
          {TECH.servicesHeading}
        </span>
        <span className="type-huge block max-w-[20ch] text-balance">{TECH.claim}</span>
      </h2>

      <div className="relative">
        {/* Aristas. Sin `viewBox`: 1 unidad SVG = 1 px CSS, que es justo lo que
            miden los `offset*`. Añadir viewBox obligaría a reescalar a mano. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
        >
          {segments.map((seg) => {
            const lit = active !== null && (seg.a === active || seg.b === active)
            return (
              <line
                key={seg.key}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={lit ? NET_CYAN : NET_GREY}
                strokeWidth={1}
                className="transition-opacity duration-500"
                style={{ opacity: active === null ? 0.22 : lit ? 0.9 : 0.05 }}
              />
            )
          })}
        </svg>

        <ul
          ref={gridRef}
          data-grid
          className="relative grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4"
        >
          {TECH.services.map((service) => {
            const place = LAYOUT[service.id]
            const dimmed = active !== null && !connected.has(service.id)
            const lit = active === service.id

            return (
              <li
                key={service.id}
                data-node={service.id}
                className="gpu md:[grid-column:var(--col)] md:[grid-row:var(--row)]"
                style={{ '--col': place?.col, '--row': place?.row } as CSSProperties}
              >
                <a
                  href="#chapter-converge"
                  data-cursor="hover"
                  onPointerEnter={() => setActive(service.id)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(service.id)}
                  onBlur={() => setActive(null)}
                  className="flex h-full flex-col gap-2 border p-4 transition-opacity duration-500 md:p-5"
                  style={{
                    // Fondo sólido: el nodo tiene que tapar la arista que pasa
                    // por debajo, si no la línea le cruza el texto.
                    backgroundColor: alpha(BG, 88),
                    borderColor: lit ? NET_CYAN : alpha(NET_GREY, 28),
                    opacity: dimmed ? 0.28 : 1,
                    boxShadow: lit ? `0 0 40px -18px ${NET_BLUE}` : 'none',
                  }}
                >
                  <span
                    className="text-lg font-semibold leading-tight md:text-xl"
                    style={{ color: lit ? NET_CYAN : INK }}
                  >
                    {service.title}
                  </span>
                  <span className="text-sm leading-snug" style={{ color: alpha(INK, 55) }}>
                    {service.desc}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </ChapterSection>
  )
}
