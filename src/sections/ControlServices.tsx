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
 * La descripción se muestra SIEMPRE, en los dos tamaños. Antes sólo existía en
 * `md:group-hover`, y eso tenía dos costes: la sección llegaba como nueve
 * títulos sin contexto —parecía vacía— y, sobre todo, información de servicio
 * que sólo vive en hover no existe para quien no puede hacer hover: táctil,
 * teclado, o cualquier lector que no simule puntero. El hover sigue estando,
 * pero ENRIQUECE lo que ya se lee (sube el contraste) en vez de revelarlo.
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

/**
 * CUERPO DEL ÍNDICE DE FILA.
 *
 * Se deriva del MISMO token que el título (`--text-huge`) en vez de ser un
 * tamaño suelto: así el número sigue a la escala fluida sin que nadie tenga que
 * recordar dos clamps distintos, y la razón entre número y título —0.6— queda
 * fija en todo el rango. Esa razón ES la jerarquía: el número acompaña al
 * título, no compite con él, pero a 36px en escritorio ya es tipografía de
 * cartel y no una nota al pie.
 */
const INDEX_SIZE = 'calc(var(--text-huge) * 0.6)'

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

      {/* La `<ul>` cierra con `border-b`: nueve reglas y ninguna abajo dejaba la
          lista descosida por el pie. Un cartel tiene marco inferior. */}
      <ul data-list className="flex flex-col border-b" style={{ borderColor: alpha(INK, 12) }}>
        {EVENTS.services.map((service) => (
          <li key={service.n} data-row className="border-t" style={{ borderColor: alpha(INK, 12) }}>
            <a
              href="#chapter-converge"
              data-cursor="hover"
              /* RITMO DE LA FILA.
                 El índice ya no vive en una columna sobredimensionada: con el
                 número a 0.6× del título, 2.75rem (móvil) y 4.5rem (escritorio)
                 son justo lo que ocupan dos dígitos más su regla, así que el
                 título arranca pegado al número en vez de flotar tras un hueco.
                 La descripción cae bajo el título (`col-start-2`), nunca bajo el
                 número: número y espina de texto forman dos ejes verticales
                 limpios de arriba abajo, que es lo que hace que nueve filas se
                 lean como un line-up y no como una lista de la compra.
                 El `py` sube porque hay presupuesto de sobra: la sección mide
                 2.5 viewports y el contenido no llega a 1.5. */
              className="group relative grid grid-cols-[2.75rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5 py-4 md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,18rem)] md:gap-x-8 md:py-5"
            >
              {/* Halo de la fila: opacidad, nunca un cambio de fondo por frame. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
                style={{
                  background: `linear-gradient(90deg, ${alpha(CONTROL_VIOLET, 22)}, transparent 70%)`,
                }}
              />

              {/* ÍNDICE DE LA FILA — tipografía, no metadato.
                  Iba en `type-label`: 11px con 0.22em de tracking al lado de un
                  display de 60px. A esa escala el número no era ritmo, era una
                  nota al pie, y en la lista de un cartel el número ES parte del
                  compás visual. Ahora es mono a `INDEX_SIZE` (0.6× el título),
                  semibold y al 52% de tinta: se lee de lejos y sigue estando
                  claramente por debajo del título.

                  El tracking vuelve a normal a propósito: 0.22em separaba los
                  dos dígitos hasta romper la unidad del número. A este cuerpo el
                  espaciado ya lo da el propio mono.

                  `tabular-nums` NO es cosmético: sin él el "1" mide menos que el
                  "8" y, aunque la columna del grid es fija, el número se
                  descoloca dentro de ella y los nueve índices bailan en
                  vertical de fila a fila.

                  El grid es `items-baseline`, así que la línea base del número
                  se calcula contra la PRIMERA línea del título: alineación
                  óptica real, que se recalcula sola a cualquier tamaño de la
                  escala fluida. `leading-none` deja la caja del número pegada al
                  glifo, que es contra lo que se posicionan las dos capas
                  absolutas de abajo.

                  `transition-colors` acá NO es para el hover: interpola el salto
                  de `--world-ink` cuando cambia el mundo activo. */}
              <span
                className="relative font-mono font-semibold leading-none tabular-nums transition-colors duration-500"
                style={{ color: alpha(INK, 52), fontSize: INDEX_SIZE }}
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
                    en GPU y no dispara ni un repintado.

                    Medidas en `em`, que acá son em del NÚMERO: 1.2em es el ancho
                    de dos dígitos mono, así que la regla calca el número a
                    cualquier punto de la escala fluida en vez de quedarse corta
                    (los 20px fijos de antes) al crecer el cuerpo. */}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-[0.28em] left-0 block h-px w-[1.2em] origin-left scale-x-0 bg-control-violet transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-x-100 group-focus-visible:scale-x-100"
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

              {/* DESCRIPCIÓN — siempre presente, en los dos tamaños.
                  El hover ya no la enciende de la nada: la sube de 80% a 100% de
                  opacidad. Sigue siendo `opacity`, que es compositable, y el
                  contenido existe para el táctil, el teclado y el rastreador. */}
              <span
                className="relative col-start-2 max-w-[42ch] text-sm leading-relaxed opacity-80 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 md:col-start-3 md:self-center"
                style={{ color: alpha(INK, 78), transitionTimingFunction: EASE_OUT_EXPO }}
              >
                {service.desc}
              </span>

              {/* ROSTER — artistas reales, no adorno.
                  Sólo lo lleva el servicio de booking (`roster` es opcional en
                  `EventService`). Dos decisiones deliberadas:

                  1. SIEMPRE VISIBLE y sin atenuar. Estos son nombres propios que
                     la gente busca por su cuenta: esconderlos tras un puntero
                     los borraría del móvil y del índice de Google a la vez. Es
                     el mismo criterio que ahora aplica la descripción.
                  2. Es una `<ul>` con su etiqueta, no una frase con comas. Un
                     lector de pantalla anuncia "lista de 4 elementos" y cada
                     artista se lee como una entidad, que es lo que es. Una
                     `<ul>` dentro de un `<a>` es HTML válido mientras no meta
                     nada interactivo dentro, y no lo hace. */}
              {service.roster !== undefined && (
                <span className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-2 pt-1 md:col-span-2">
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
