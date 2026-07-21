import { useEffect, useRef } from 'react'
import { CLIENTS, CLIENTS_UI } from '@/content'
import { getQuality } from '@/core/quality'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
import { INK, alpha } from './_tokens'

/**
 * CLIENTES — wordmarks, no logos.
 *
 * Un muro de PNGs de logos ajenos es lo que hace que una landing premium parezca
 * un directorio. Escribir los nombres con la tipografía del sistema los mete
 * dentro de la identidad de Mood, escala perfecto en cualquier pantalla y no
 * pide ni un byte de red.
 *
 * ── PRESUPUESTO DE PINTADO ──────────────────────────────────────────────────
 *
 * Este muro tenía EXACTAMENTE el mismo antipatrón que ya se corrigió en
 * `ControlServices`, y se resuelve igual para que los dos archivos cuenten la
 * misma historia:
 *
 * 1. Fuera el `.gpu` permanente. Diez wordmarks con `will-change` puesto PARA
 *    SIEMPRE son diez capas de compositor que sólo se justifican durante el
 *    reveal de entrada. Ahora la pista se enciende en el `onStart` del tween y
 *    se apaga en el `onComplete`, que es para lo que existe `will-change`.
 *
 * 2. Fuera `transition-[color,text-shadow]`. Interpolar medio segundo un halo de
 *    2rem sobre glifos de 48px es re-rasterizar texto borroso grande unas
 *    treinta veces por cada nombre que el puntero roza — y encima junto a una
 *    transición de `color`, que también es pintado, en el MISMO nodo.
 *    El estado encendido es ahora una COPIA superpuesta, ya pintada en el acento
 *    y con su halo, a `opacity: 0`. Encender es interpolar esa opacidad: el
 *    compositor rasteriza una vez y luego sólo mezcla. El cruce de opacidades
 *    entre la tinta apagada y el acento ES la interpolación de color que hacía
 *    `transition: color`, pero sin tocar el pintado.
 */

/**
 * ESTADO VACÍO — mismo criterio que la galería, por la misma razón.
 *
 * `CLIENTS` está vacío a propósito: los diez nombres que había eran inventados
 * (ver `@/content`). Se monta esto en lugar del muro, no encima: un `gsap.from`
 * sobre una lista de cero elementos es un ScrollTrigger que no anima nada.
 *
 * ⚠ LA SECCIÓN SIGUE EXISTIENDO, y no es opcional. `clients` mide 1 viewport en
 * `CHAPTER_MAP` y la escena 3D está calibrada contra ese número: si el capítulo
 * desaparece del documento, todo lo que viene detrás se adelanta un viewport
 * respecto de la coreografía.
 *
 * El tono es deliberadamente discreto —un `type-label` al 30% de opacidad, la
 * misma voz que los índices de capítulo— porque el muro de clientes es apoyo, no
 * titular. Un cartel grande diciendo "próximamente" es peor que no tener muro.
 */
function ClientsEmpty(): React.JSX.Element {
  return (
    <ChapterSection
      id="clients"
      sticky={false}
      innerClassName="items-center justify-center px-5 py-[10vh] md:px-10"
    >
      <p className="type-label text-center" style={{ color: alpha(INK, 30) }}>
        {CLIENTS_UI.empty}
      </p>
    </ChapterSection>
  )
}

/**
 * CLIENTES — decide qué versión del capítulo se monta.
 *
 * `CLIENTS` es una constante de módulo: la rama se resuelve una vez y no cambia
 * en toda la sesión, así que no hay hooks condicionales en ningún lado.
 */
export function Clients(): React.JSX.Element {
  return CLIENTS.length === 0 ? <ClientsEmpty /> : <ClientsWall />
}

function ClientsWall(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || getQuality().reduced) return

    const items = gsap.utils.toArray<HTMLElement>('[data-client]', el)

    /** Pista al compositor, sólo mientras los wordmarks se mueven de verdad. */
    const hint = (value: string) => {
      for (const item of items) item.style.willChange = value
    }

    const ctx = gsap.context(() => {
      gsap.from(items, {
        opacity: 0,
        yPercent: 40,
        duration: 0.8,
        ease: 'expo.out',
        stagger: 0.05,
        scrollTrigger: { trigger: el, start: 'top 75%' },
        onStart: () => hint('transform, opacity'),
        onComplete: () => hint(''),
      })
    }, el)

    return () => {
      hint('')
      ctx.revert()
    }
  }, [])

  return (
    <ChapterSection
      id="clients"
      sectionRef={sectionRef}
      sticky={false}
      innerClassName="justify-center px-5 py-[10vh] md:px-10"
    >
      <ul className="flex flex-wrap items-baseline justify-center gap-x-8 gap-y-4 md:gap-x-14 md:gap-y-8">
        {CLIENTS.map((client) => (
          <li
            key={client}
            data-client
            data-cursor="text"
            /* El color base va en una clase, no en `style`: un estilo inline
               gana siempre a la capa encendida y el muro se quedaría muerto.

               `transition-colors` NO es para el hover — el hover ya no cambia el
               color de este nodo: interpola el salto de `--world-ink` cuando
               cambia el mundo activo.

               Bajado un escalón (6xl → 5xl) para acompañar la nueva escala
               display: este muro es apoyo, no titular, y con 60px competía de
               tú a tú con los `type-huge` de la sección de al lado. */
            className="group relative text-2xl font-semibold uppercase leading-none text-[color-mix(in_srgb,var(--world-ink)_38%,transparent)] transition-colors duration-500 sm:text-3xl md:text-4xl lg:text-5xl"
          >
            {client}

            {/* Capa encendida: el mismo glifo, ya pintado en el acento y con el
                halo puesto. Hereda cuerpo, peso y tracking del padre, así que
                calca la caja exacta. Sólo se le anima la opacidad. */}
            <span
              aria-hidden="true"
              className="absolute inset-0 text-[var(--world-accent)] opacity-0 transition-opacity duration-500 ease-[var(--ease-out-expo)] [text-shadow:0_0_2rem_var(--world-accent)] group-hover:opacity-100"
            >
              {client}
            </span>
          </li>
        ))}
      </ul>
    </ChapterSection>
  )
}
