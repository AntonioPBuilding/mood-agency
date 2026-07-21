import { useEffect, useRef } from 'react'
import { EVENTS } from '@/content'
import { getQuality } from '@/core/quality'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
import { CONTROL_VIOLET, EASE_OUT_EXPO, INK, alpha } from './_tokens'

/**
 * SERVICIOS DE MOOD AGENCY (capítulo `controlServices`) — créditos de cartel.
 *
 * Una fila por servicio, tamaño brutal, número a la izquierda. Al pasar por
 * encima la fila se desplaza, se enciende en neón y aparece la descripción.
 *
 * Cada fila es un `<a>` al formulario, no un `<div>` con `onMouseEnter`: si algo
 * responde al puntero tiene que responder al tabulador, y un servicio que te
 * interesa tiene un destino natural: contarnos que te interesa.
 *
 * En móvil no hay hover, así que la descripción se muestra siempre. El estado
 * "oculto" es sólo opacidad: nunca `display`, para no reflowear la lista entera
 * en cada entrada del puntero.
 *
 * ── PRESUPUESTO DE PINTADO ──────────────────────────────────────────────────
 *
 * Esta sección iba a tirones por dos motivos, los dos de pintado, ninguno de
 * JavaScript:
 *
 * 1. Las filas ya NO llevan `.gpu`. Sólo animan UNA vez, en el reveal de
 *    entrada, y `.gpu` deja `will-change` puesto PARA SIEMPRE: nueve capas de
 *    compositor permanentes con tipografía de hasta 96px es exactamente lo que
 *    el comentario de esa utilidad prohíbe. Ahora la pista se enciende en el
 *    `onStart` del tween y se apaga en el `onComplete`, que es para lo que
 *    existe `will-change`: avisar de lo que va a pasar YA, no de lo que pasó
 *    una vez al entrar en pantalla.
 *
 * 2. El neón ya no se repinta por frame. Un `text-shadow` de 40px de radio
 *    sobre glifos de 96px es de los pintados más caros que se pueden pedir, y
 *    antes convivía con una transición de `color` — que también es pintado — en
 *    el MISMO nodo: medio segundo re-rasterizando texto gigante borroso, unas
 *    treinta veces, por cada fila que el puntero rozaba.
 *
 *    El estado encendido es ahora una COPIA del texto, ya pintada en violeta y
 *    con su halo, superpuesta y a `opacity: 0`. Encender la fila es interpolar
 *    esa opacidad: el compositor rasteriza la capa una vez y a partir de ahí
 *    sólo la mezcla en GPU. El resultado en pantalla es el mismo, porque el
 *    cruce de opacidades entre la tinta y el violeta ES la interpolación de
 *    color que hacía `transition: color` — pero sin tocar el pintado.
 *
 * Regla que queda para el resto del capítulo: en hover sólo se animan
 * `transform` y `opacity`. Cualquier otra cosa (color, sombra, fondo) se
 * resuelve con una capa ya pintada a la que se le mueve la opacidad.
 */

/**
 * Halo del estado encendido. Vive en la capa superpuesta y NUNCA entra en una
 * transición, así que su radio se paga una vez y no por frame.
 */
const NEON_GLOW = '[text-shadow:0_0_2.5rem_var(--color-control-violet)]'

export function ControlServices(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || getQuality().reduced) return

    const rows = gsap.utils.toArray<HTMLElement>('[data-row]', el)

    /** Pista al compositor, sólo mientras las filas se mueven de verdad. */
    const hint = (value: string) => {
      for (const row of rows) row.style.willChange = value
    }

    const ctx = gsap.context(() => {
      gsap.from(rows, {
        yPercent: 55,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
        stagger: 0.07,
        scrollTrigger: { trigger: '[data-list]', start: 'top 85%' },
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
      id="controlServices"
      sectionRef={sectionRef}
      sticky={false}
      /* PRESUPUESTO DE ALTURA. Esta sección tiene un criterio de éxito que no es
         estético: si al llegar sólo se ven dos servicios, la sección no está
         haciendo su trabajo. Con la escala vieja el titular se comía media
         pantalla y el aire (18vh de padding + 8vh de hueco) se comía la otra
         media. El titular ya encogió en `index.css`; acá se recupera el resto
         apretando ese aire, que era decorativo, no estructural. */
      innerClassName="justify-center gap-[4vh] px-5 py-[8vh] md:gap-[6vh] md:px-10 md:py-[12vh]"
    >
      {/* ENCABEZADO EN DOS PISOS, y el de arriba no es decoración.
          "Hacemos que la sala se caiga" es un claim de agencia: le habla al
          humano y no le dice NADA a un buscador —no contiene ni una de las cosas
          que se venden—. El overline mete las palabras reales ("producción de
          eventos", "DJs", "festivales") DENTRO del `<h2>`, a la vista, en la
          misma voz mono que ya usan los índices de fila. Nada de texto oculto:
          si merece indexarse, merece leerse. */}
      <h2 className="flex flex-col gap-3 md:gap-4">
        <span className="type-label" style={{ color: CONTROL_VIOLET }}>
          {EVENTS.servicesHeading}
        </span>
        <span className="type-giga block max-w-[14ch] uppercase">{EVENTS.claim}</span>
      </h2>

      <ul data-list className="flex flex-col">
        {EVENTS.services.map((service) => (
          <li key={service.n} data-row className="border-t" style={{ borderColor: alpha(INK, 12) }}>
            <a
              href="#chapter-converge"
              data-cursor="hover"
              className="group relative grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 py-3.5 md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,20rem)] md:gap-x-8 md:py-4"
            >
              {/* Halo de la fila: opacidad, nunca un cambio de fondo por frame. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
                style={{
                  background: `linear-gradient(90deg, ${alpha(CONTROL_VIOLET, 22)}, transparent 70%)`,
                }}
              />

              {/* ÍNDICE DE LA FILA.
                  Contraste de escala deliberado: un mono diminuto pegado a un
                  display enorme. Es el recurso de los créditos de cartel, y es
                  el mismo idioma que ya hablan el contador del ScrollHUD y la
                  cabecera de la galería — mono, versalitas, tracking abierto.

                  `tabular-nums` NO es cosmético: sin él el "1" mide menos que el
                  "8" y, aunque la columna del grid es fija, el número se
                  descoloca dentro de ella y los nueve índices bailan en
                  vertical de fila a fila.

                  Ya no lleva `pt-2`. El grid es `items-baseline`, así que la
                  línea base del número se calcula contra la PRIMERA línea del
                  título: alineación óptica real, que se recalcula sola a
                  cualquier tamaño de la escala fluida. El `pt-2` era un número
                  mágico que la rompía empujándolo 8px por debajo.

                  `transition-colors` acá NO es para el hover: interpola el salto
                  de `--world-ink` cuando cambia el mundo activo. */}
              <span
                className="type-label relative tabular-nums transition-colors duration-500"
                style={{ color: alpha(INK, 32) }}
              >
                {service.n}

                {/* Estado encendido, con la MISMA técnica que el título: una
                    copia ya pintada en violeta a la que sólo se le anima la
                    opacidad. Cero transiciones de `color` en hover. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 text-control-violet opacity-0 transition-opacity duration-500 ease-[var(--ease-out-expo)] group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  {service.n}
                </span>

                {/* La regla que ancla el número a la fila. Crece desde la
                    izquierda al encender: `scaleX` es transform puro, se compone
                    en GPU y no dispara ni un repintado. */}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1.5 left-0 block h-px w-5 origin-left scale-x-0 bg-control-violet transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-x-100 group-focus-visible:scale-x-100"
                />
              </span>

              <span className="type-huge relative origin-left uppercase transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-2 group-focus-visible:translate-x-2 md:group-hover:translate-x-5 md:group-focus-visible:translate-x-5">
                {service.title}

                {/* Capa encendida: el mismo glifo, ya pintado en violeta y con
                    el halo puesto. Hereda tamaño, tracking y ancho del padre,
                    así que calca la línea base y el corte de línea. Sólo se le
                    anima la opacidad, que es compositable. */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 text-control-violet opacity-0 transition-opacity duration-500 ease-[var(--ease-out-expo)] group-hover:opacity-100 group-focus-visible:opacity-100 ${NEON_GLOW}`}
                >
                  {service.title}
                </span>
              </span>

              <span
                className="relative col-span-2 max-w-[36ch] text-sm leading-relaxed transition-opacity duration-500 md:col-span-1 md:self-center md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100"
                style={{ color: alpha(INK, 55), transitionTimingFunction: EASE_OUT_EXPO }}
              >
                {service.desc}
              </span>

              {/* ROSTER — artistas reales, no adorno.
                  Sólo lo lleva el servicio de booking (`roster` es opcional en
                  `EventService`). Dos decisiones deliberadas:

                  1. SIEMPRE VISIBLE, nunca detrás del hover como la descripción.
                     Estos son nombres propios que la gente busca por su cuenta:
                     esconderlos tras un puntero los borra del móvil y del índice
                     de Google a la vez.
                  2. Es una `<ul>` con su etiqueta, no una frase con comas. Un
                     lector de pantalla anuncia "lista de 4 elementos" y cada
                     artista se lee como una entidad, que es lo que es. Una
                     `<ul>` dentro de un `<a>` es HTML válido mientras no meta
                     nada interactivo dentro, y no lo hace. */}
              {service.roster !== undefined && (
                <span className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-2 pb-1 md:col-start-2 md:col-span-2">
                  <span className="type-label" style={{ color: alpha(CONTROL_VIOLET, 90) }}>
                    {EVENTS.servicesUI.rosterLabel}
                  </span>
                  <ul className="flex flex-wrap items-center gap-2">
                    {service.roster.map((artist) => (
                      <li
                        key={artist}
                        className="type-label px-2.5 py-1"
                        style={{
                          border: `1px solid ${alpha(CONTROL_VIOLET, 32)}`,
                          color: alpha(INK, 80),
                        }}
                      >
                        {artist}
                      </li>
                    ))}
                  </ul>
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </ChapterSection>
  )
}
