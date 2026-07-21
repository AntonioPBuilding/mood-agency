import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { EVENTS } from '@/content'
import { setOverlay } from '@/core/overlayStore'
import { getQuality } from '@/core/quality'
import { subscribeChapter } from '@/core/scrollStore'
import { ChapterSection } from './ChapterSection'
import { useFrameLoop } from './useFrameLoop'
import {
  CONTROL_BG,
  CONTROL_BLUE,
  CONTROL_RED,
  CONTROL_VIOLET,
  EASE_OUT_EXPO,
  INK,
  alpha,
  chapterMeta,
} from './_tokens'

/**
 * GALERÍA — muro curvo INFINITO con arrastre, autoplay y ficha de proyecto.
 *
 * EL ANILLO (lo que hay que entender antes de tocar nada)
 *
 * El carrusel no tiene bordes. No hay tope izquierdo ni derecho, no hay clamp y
 * no hay rebote: al pasar de la última se sigue avanzando HACIA ADELANTE y la
 * primera vuelve a entrar por la derecha. Se consigue con aritmética modular, no
 * con clones en el DOM: hay un `<li>` por proyecto y ni uno más.
 *
 * ⚠ HOY `EVENTS.gallery` ESTÁ VACÍO (las fichas que había eran inventadas; ver
 * `@/content`), así que lo que se monta es `GalleryEmpty` y nada de este archivo
 * llega a ejecutarse. El carrusel se queda entero y tipado a la espera del
 * contenido real. Antes de rellenarlo, leé el mínimo de proyectos que exige el
 * anillo —5, y 8 para estar tranquilo— documentado sobre `GALLERY`.
 *
 * El truco es que NO se mueve el track, se mueve CADA TARJETA. Para la tarjeta
 * `i` se calcula su desplazamiento respecto al centro del viewport y se envuelve
 * al rango `[-cycle/2, +cycle/2)`, siendo `cycle` el ancho de una vuelta entera
 * (tarjetas + huecos + el hueco de cierre entre la última y la primera). Una
 * tarjeta que se va por un borde reaparece por el otro ella sola, porque su
 * desplazamiento envuelto cambia de signo. Requisito implícito: `cycle` tiene
 * que ser mayor que el viewport, o una misma tarjeta tendría que verse dos veces
 * a la vez y sólo hay un nodo por tarjeta. Con 8 tarjetas sobra de largo.
 *
 * `target` es un escalar SIN límites que crece o decrece indefinidamente, y el
 * índice activo se deriva de un índice VIRTUAL (`vIndex`) igual de ilimitado:
 * `mod(vIndex, 8)` es la tarjeta centrada, `Math.floor(vIndex / 8)` es la vuelta.
 * Por eso "siguiente" desde la 08 es `vIndex + 1` y no `0`: la diferencia entre
 * un infinito de verdad y un salto hacia atrás disfrazado.
 *
 * Decisiones que sostienen los 60fps:
 *
 * - La posición vive en un `useRef`, nunca en `useState`. Un carrusel con estado
 *   de React re-renderiza 8 tarjetas por frame mientras arrastrás.
 * - Los centros de cada tarjeta se miden UNA vez (y en cada resize, vía
 *   ResizeObserver). Leer `getBoundingClientRect()` de 8 elementos por frame
 *   fuerza un reflow por frame, que es exactamente el bug que la gente confunde
 *   con "React es lento".
 * - Sólo se escribe `transform` y `opacity`, y sólo si el valor CAMBIÓ respecto
 *   al frame anterior. La inclinación del muro es `rotateY` con `perspective()`
 *   en la propia función, así no depende de que un ancestro conserve el contexto
 *   3D.
 * - El loop ni siquiera está enganchado al ticker cuando no hace falta: corre si
 *   el capítulo está en pantalla o si queda movimiento pendiente (inercia).
 * - El ÍNDICE activo sí es estado de React, pero cambia ~8 veces por recorrido,
 *   no 60 veces por segundo: los puntos y el `aria-live` lo necesitan.
 *
 * Las tarjetas son OPACAS a propósito. El Núcleo 3D vive detrás de todo el DOM;
 * con fondos semitransparentes las partículas se leían A TRAVÉS de las fotos y
 * no había separación entre figura y fondo. Una tarjeta es un objeto físico
 * apoyado sobre la escena, no un vidrio sucio.
 *
 * La rueda sólo se captura cuando el gesto es horizontal: robarle el scroll
 * vertical al usuario dentro de una landing de 14 capítulos es encerrarlo.
 */

const META = chapterMeta('gallery')
const ITEMS = EVENTS.gallery
const UI = EVENTS.galleryUI

type GalleryItem = (typeof ITEMS)[number]
type Accent = GalleryItem['accent']

/** El acento es DATO (`content.ts`); acá sólo se traduce a token. Cero hex. */
const ACCENT: Record<Accent, string> = {
  violet: CONTROL_VIOLET,
  blue: CONTROL_BLUE,
  red: CONTROL_RED,
}

const STOPS = [CONTROL_VIOLET, CONTROL_BLUE, CONTROL_RED]

/** Cada cuánto avanza solo el carrusel. */
const AUTOPLAY_MS = 4000

/**
 * Px que tiene que recorrer el puntero para que el gesto cuente como arrastre.
 * Por debajo de esto es un clic y la tarjeta abre su ficha.
 */
const DRAG_THRESHOLD = 6

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Mismo easing que el CSS del proyecto, en el formato que espera `motion`. */
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const pad = (n: number) => String(n).padStart(2, '0')

/** Resto SIEMPRE positivo. El `%` de JS conserva el signo del dividendo. */
const mod = (v: number, c: number) => ((v % c) + c) % c

/**
 * Envuelve a `[-c/2, +c/2)`: la distancia CON SIGNO más corta dentro del anillo.
 * Es la única primitiva que hace falta para el infinito; todo lo demás es cuenta.
 */
const wrapCentered = (v: number, c: number) => mod(v + c / 2, c) - c / 2

/**
 * SEÑAL DE FICHA ABIERTA — contrato con quien conduce el Canvas.
 *
 * Mientras la ficha está abierta hay un panel OPACO tapando la pantalla entera:
 * el Núcleo se sigue renderizando para nadie. Esta sección NO desmonta ni pausa
 * el Canvas —eso rompería la regla 1 de ARCHITECTURE.md y encima no es suya—:
 * sólo DECLARA que hay una capa encima y deja que `App` decida.
 *
 * La vía real es `overlayStore`, que es quien escucha `App`:
 *
 *   1. `setOverlay('gallery-modal', open)`. Importar `core/` desde `sections/`
 *      es la dirección correcta de dependencia —`core` es la capa de abajo— y
 *      es lo que ya hacen `quality` y `scrollStore` unas líneas más arriba.
 *      Lo que sí estaría mal es el camino inverso: que `scenes/` importase de
 *      `sections/`. Eso no ocurre: `scenes/` no conoce a nadie de aquí.
 *
 *   2. `data-gallery-modal` en `<html>`, por si alguien engancha tarde y
 *      necesita el valor inicial (o por si el CSS quiere reaccionar).
 *
 * El id importa: `overlayStore` lleva un conjunto, no un booleano, para que dos
 * capas solapadas no se pisen al cerrarse.
 */
let modalOpen = false

function setGalleryModal(open: boolean): void {
  if (modalOpen === open) return
  modalOpen = open
  if (open) document.documentElement.dataset.galleryModal = 'open'
  else delete document.documentElement.dataset.galleryModal
  setOverlay('gallery-modal', open)
}

/**
 * Rutas que ya dieron 404, cacheadas en el MÓDULO y no en el estado.
 *
 * Hoy `public/gallery/` está vacío, así que las 8 tarjetas fallan al montar y
 * cada fallo era un `setState`. Con la caché, el primer montaje paga los 8 fallos
 * (inevitable: el navegador tiene que intentar la petición) pero cualquier
 * montaje posterior —volver al capítulo, abrir la ficha, cambiar de foto— arranca
 * ya en el placeholder y no re-renderiza NADA.
 */
const BROKEN = new Set<string>()

/** Placeholder elegante: gradiente de la paleta de Control, cero archivos. */
const placeholderBg = (i: number) => {
  const a = STOPS[i % STOPS.length]
  const b = STOPS[(i + 1) % STOPS.length]
  return `linear-gradient(${128 + i * 11}deg, ${alpha(a, 80)} 0%, ${alpha(b, 38)} 52%, ${alpha(CONTROL_BG, 92)} 100%)`
}

/* ─────────────────────────────  FOTO + FALLBACK  ───────────────────────────── */

interface ShotProps {
  src: string
  alt: string
  /** Número que se pinta en el placeholder cuando la foto no está. */
  n: number
  title: string
  /** Índice de paleta del gradiente de respaldo. */
  tone: number
  fit: 'cover' | 'contain'
  /** Proporción intrínseca declarada. Ver el comentario del componente. */
  w: number
  h: number
}

/**
 * Una foto del portfolio.
 *
 * Las imágenes reales todavía no existen: las sube el cliente en
 * `public/gallery/<id>/NN.jpg`. Hasta entonces —y ante cualquier 404 futuro— el
 * `onError` cambia ESA imagen al placeholder de gradiente con su número y su
 * título. Nunca un icono roto, nunca un hueco.
 *
 * Va siempre en `position: absolute` dentro de un contenedor con proporción
 * fijada: la imagen no puede alterar el layout ni cuando carga ni cuando falla.
 * Quien monte esto necesita un `key={src}`: sin él, cambiar de foto en la ficha
 * arrastraría el estado de error de la anterior.
 *
 * `width`/`height` van declarados aunque el CSS los pise (`absolute inset-0
 * h-full w-full`): son la proporción intrínseca que el navegador usa ANTES de
 * tener los bytes. El día que existan las fotos reales, eso evita que el layout
 * dependa de que el `aspect-ratio` del contenedor esté puesto.
 */
function Shot({ src, alt, n, title, tone, fit, w, h }: ShotProps): React.JSX.Element {
  // Inicialización perezosa contra la caché de módulo: si ya sabemos que esta
  // ruta está rota, se monta en placeholder y nos ahorramos petición y render.
  const [failed, setFailed] = useState(() => BROKEN.has(src))

  if (failed) {
    return (
      <>
        <span
          aria-hidden="true"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center"
          style={{ background: placeholderBg(tone) }}
        >
          <span className="type-mega leading-none" style={{ color: alpha(INK, 22) }}>
            {pad(n)}
          </span>
          <span className="type-label" style={{ color: alpha(INK, 60) }}>
            {title}
          </span>
          <span className="type-label" style={{ color: alpha(INK, 32) }}>
            {UI.pending}
          </span>
        </span>
        <span className="sr-only">{`${title}${UI.sep}${UI.pending}`}</span>
      </>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      width={w}
      height={h}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        BROKEN.add(src)
        setFailed(true)
      }}
      className={`absolute inset-0 h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
    />
  )
}

/* ──────────────────────────  FICHA DE PROYECTO  ────────────────────────────── */

interface ProjectDialogProps {
  item: GalleryItem
  onClose: () => void
}

/**
 * Modal de detalle.
 *
 * Va por `createPortal` a `body` y no como hijo de la sección: las tarjetas del
 * carrusel llevan `transform` por frame, y un `position: fixed` dentro de un
 * ancestro transformado se posiciona respecto a ESE ancestro, no al viewport.
 * Encima la carcasa del capítulo es `overflow-hidden`. Sería un modal
 * descolocado y recortado.
 *
 * El bloqueo de scroll sigue el mismo enfoque que `ui/Preloader.tsx`: `overflow:
 * hidden` en `html` y `body`, restaurando los valores previos al desmontar. Se
 * le suma dos cosas que el preloader no necesita:
 *   1. compensar el ancho de la barra de scroll, porque acá el documento YA
 *      estaba scrolleando y al ocultarla el layout entero saltaría a la derecha;
 *   2. cortar la burbuja de `wheel`/`touchmove` antes de window, que es donde
 *      escucha Lenis: sin esto Lenis acumula inercia mientras leés la ficha y la
 *      descarga de golpe al cerrarla.
 */
function ProjectDialog({ item, onClose }: ProjectDialogProps): React.JSX.Element {
  const titleId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [shot, setShot] = useState(0)

  const reduced = getQuality().reduced
  const accent = ACCENT[item.accent]
  const tone = ITEMS.findIndex((g) => g.id === item.id)

  // El callback puede cambiar de identidad en cada render del padre; el efecto
  // se monta una sola vez y tiene que ver siempre la versión actual.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const root = rootRef.current
    const panel = panelRef.current
    if (!root || !panel) return

    const html = document.documentElement
    const prevHtml = html.style.overflow
    const prevBody = document.body.style.overflow
    const prevPad = document.body.style.paddingRight
    // Al ocultar la barra el viewport gana esos px y TODO se corre. Se compensa
    // con padding, no con margin: el margin dispararía el `overflow-x` del body.
    const gutter = window.innerWidth - html.clientWidth

    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    if (gutter > 0) document.body.style.paddingRight = `${gutter}px`

    const swallow = (e: Event) => e.stopPropagation()
    root.addEventListener('wheel', swallow)
    root.addEventListener('touchmove', swallow)

    // El foco entra al panel, no al primer botón: así el lector de pantalla
    // anuncia el diálogo entero antes que un control suelto.
    panel.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      // Trampa de foco real: se recalcula en cada Tab porque la lista de
      // controles cambia (las miniaturas dependen de cuántas fotos haya).
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.getClientRects().length > 0,
      )
      if (nodes.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }

      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const el = document.activeElement

      if (!panel.contains(el)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && el === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && el === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      root.removeEventListener('wheel', swallow)
      root.removeEventListener('touchmove', swallow)
      html.style.overflow = prevHtml
      document.body.style.overflow = prevBody
      document.body.style.paddingRight = prevPad
    }
  }, [])

  const images = item.images
  const current = images[Math.min(shot, images.length - 1)]

  return createPortal(
    <motion.div
      ref={rootRef}
      className="fixed inset-0 z-[190] flex items-end justify-center overflow-hidden sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.28 }}
      // Sólo el backdrop cierra: un clic dentro del panel no debe escaparse.
      onClick={(e: ReactMouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose()
      }}
      // El blur es a pantalla completa y por debajo hay un canvas WebGL VIVO: el
      // backdrop se recompone cada frame que el Núcleo dibuja. El coste del
      // desenfoque crece con el radio, y a 90% de opacidad del fondo la
      // diferencia entre 12px y 7px no se ve; el frame time sí.
      style={{ backgroundColor: alpha(CONTROL_BG, 90), backdropFilter: 'blur(7px)' }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, y: reduced ? 0 : 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.55, ease: EASE }}
        /* `dvh` acá SÍ, y es el único sitio de la landing donde corresponde: el
           panel es `fixed`, no forma parte del alto del documento, así que
           seguir el viewport en vivo no puede desplazar el progreso de scroll
           de nadie. Con `vh` el 94% se medía contra el viewport GRANDE y en
           móvil el pie de la ficha —las estadísticas— quedaba debajo de la
           barra de direcciones, sin manera de llegar a él. */
        className="relative flex max-h-[94dvh] w-full max-w-[74rem] flex-col overflow-y-auto overscroll-contain outline-none sm:max-h-[88dvh]"
        // Panel OPACO: es el arreglo central de esta sección. Detrás hay 45.000
        // partículas y no pueden leerse a través de la ficha.
        // El halo era `0 0 100px`: una sombra de 100px de radio alrededor de un
        // panel de 74rem es una superficie enorme que el compositor tiene que
        // desenfocar encima del blur del backdrop. Mismo gesto —el acento
        // filtrándose por debajo— con un radio y un área muy menores.
        style={{
          backgroundColor: CONTROL_BG,
          border: `1px solid ${alpha(accent, 34)}`,
          boxShadow: `0 18px 44px -18px ${alpha(accent, 30)}`,
        }}
      >
        <div
          className="sticky top-0 z-20 flex items-center justify-between gap-4 px-5 py-3 md:px-8"
          style={{ backgroundColor: CONTROL_BG, borderBottom: `1px solid ${alpha(INK, 10)}` }}
        >
          <p className="type-label truncate" style={{ color: accent }}>
            {item.meta}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={UI.close}
            data-cursor="hover"
            className="grid size-11 shrink-0 place-items-center transition-colors duration-300"
            style={{ border: `1px solid ${alpha(INK, 20)}`, color: INK }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
              <path
                d="M4 4 L20 20 M20 4 L4 20"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
              />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* ── Galería interna ── */}
          <div className="flex flex-col">
            <div
              className="relative w-full overflow-hidden"
              // Proporción fija: la foto no puede mover el layout al cargar.
              style={{ aspectRatio: '3 / 2', backgroundColor: CONTROL_BG }}
            >
              <Shot
                key={current}
                src={current}
                alt={`${UI.imageAlt}${UI.sep}${item.title}`}
                n={shot + 1}
                title={item.title}
                tone={tone + shot}
                fit="cover"
                // 3/2, la proporción del contenedor de arriba.
                w={1200}
                h={800}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `linear-gradient(0deg, ${alpha(CONTROL_BG, 78)} 0%, transparent 42%)`,
                }}
              />
            </div>

            {images.length > 1 && (
              <div className="flex items-center gap-2 px-5 py-3 md:px-8">
                <button
                  type="button"
                  data-cursor="hover"
                  aria-label={UI.prevImage}
                  onClick={() => setShot((s) => (s - 1 + images.length) % images.length)}
                  className="grid size-11 shrink-0 place-items-center"
                  style={{ border: `1px solid ${alpha(INK, 20)}`, color: INK }}
                >
                  <Chevron dir="left" />
                </button>
                <button
                  type="button"
                  data-cursor="hover"
                  aria-label={UI.nextImage}
                  onClick={() => setShot((s) => (s + 1) % images.length)}
                  className="grid size-11 shrink-0 place-items-center"
                  style={{ border: `1px solid ${alpha(INK, 20)}`, color: INK }}
                >
                  <Chevron dir="right" />
                </button>

                <ul className="ml-2 flex flex-wrap items-center gap-2">
                  {images.map((src, i) => (
                    <li key={src}>
                      <button
                        type="button"
                        data-cursor="hover"
                        aria-label={`${UI.goToImage}${UI.sep}${pad(i + 1)}`}
                        aria-current={i === shot ? 'true' : undefined}
                        onClick={() => setShot(i)}
                        className="type-label grid size-11 place-items-center transition-opacity duration-300"
                        style={{
                          color: i === shot ? accent : alpha(INK, 45),
                          border: `1px solid ${i === shot ? alpha(accent, 55) : alpha(INK, 14)}`,
                        }}
                      >
                        {pad(i + 1)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── Ficha ── */}
          <div className="flex flex-col gap-7 px-5 pb-8 pt-5 md:px-8">
            <div className="flex flex-col gap-2">
              <h3 id={titleId} className="type-huge uppercase">
                {item.title}
              </h3>
              <p className="type-label" style={{ color: alpha(INK, 45) }}>
                {`${item.year}${UI.sep}${item.location}`}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="flex flex-col gap-1">
                <dt className="type-label" style={{ color: alpha(INK, 35) }}>
                  {UI.fields.client}
                </dt>
                <dd className="text-sm leading-snug">{item.client}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="type-label" style={{ color: alpha(INK, 35) }}>
                  {UI.fields.year}
                </dt>
                <dd className="text-sm leading-snug">{item.year}</dd>
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <dt className="type-label" style={{ color: alpha(INK, 35) }}>
                  {UI.fields.location}
                </dt>
                <dd className="text-sm leading-snug">{item.location}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2">
              <h4 className="type-label" style={{ color: alpha(INK, 35) }}>
                {UI.aboutLabel}
              </h4>
              <p className="max-w-[52ch] text-sm leading-relaxed" style={{ color: alpha(INK, 78) }}>
                {item.description}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="type-label" style={{ color: alpha(INK, 35) }}>
                {UI.fields.role}
              </h4>
              <ul className="flex flex-wrap gap-2">
                {item.role.map((r) => (
                  <li
                    key={r}
                    className="type-label px-2.5 py-1.5"
                    style={{
                      color: alpha(INK, 72),
                      border: `1px solid ${alpha(accent, 30)}`,
                      backgroundColor: alpha(accent, 8),
                    }}
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="type-label" style={{ color: alpha(INK, 35) }}>
                {UI.statsLabel}
              </h4>
              {/* Dos columnas hasta `sm`, tres a partir de ahí. A 375px la
                  tercera parte útil de la ficha son ~90px, y una etiqueta como
                  "Reproducciones" mide 126px en `type-label` (mono + 0.22em de
                  tracking): al ser UNA sola palabra no puede partirse, así que
                  la celda no encoge y el `dl` desbordaba la ficha entera. Con
                  dos columnas la celda pasa a 141px y entra la más larga. */}
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {item.stats.map((s) => (
                  <div
                    key={s.label}
                    // `flex-col-reverse`: en el DOM va `dt` y después `dd`
                    // —que es el único orden válido dentro de un `dl`— pero en
                    // pantalla la cifra manda y va arriba.
                    // `min-w-0`: sin esto una celda de grid se niega a bajar del
                    // ancho de su contenido (`min-width: auto`) y desborda.
                    className="flex min-w-0 flex-col-reverse gap-1 pt-3"
                    style={{ borderTop: `1px solid ${alpha(INK, 14)}` }}
                  >
                    <dt className="type-label" style={{ color: alpha(INK, 40) }}>
                      {s.label}
                    </dt>
                    <dd
                      className="text-2xl font-semibold leading-none md:text-3xl"
                      style={{ color: accent }}
                    >
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

/** Flecha de navegación. SVG y no un carácter: no es copy, es un icono. */
function Chevron({ dir }: { dir: 'left' | 'right' }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
      <path
        d={dir === 'left' ? 'M15 4 L7 12 L15 20' : 'M9 4 L17 12 L9 20'}
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="square"
      />
    </svg>
  )
}

/* ────────────────────────────────  CARRUSEL  ───────────────────────────────── */

interface DragState {
  /** Posición interpolada del anillo. Escalar SIN topes. */
  x: number
  /** Destino. También sin topes: un anillo no tiene bordes contra los que clampear. */
  target: number
  velocity: number
  pointer: number
  startX: number
  pressed: boolean
  dragging: boolean
  /** Un arrastre no puede terminar abriendo la ficha del proyecto. */
  suppressClick: boolean
  /** Centro NATURAL (sin transform) de cada tarjeta, desde el borde del viewport. */
  centers: number[]
  /** Ancho de una vuelta entera: tarjetas + huecos + el hueco de cierre. */
  cycle: number
  width: number
  /** Índice VIRTUAL ilimitado. `mod(vIndex, n)` es la tarjeta centrada. */
  vIndex: number
  dirty: boolean
}

/** Último `transform`/`opacity` escrito en cada tarjeta. Ver `paint()`. */
interface Painted {
  t: string
  o: string
}

/**
 * ESTADO VACÍO — lo que se ve mientras `EVENTS.gallery` no tenga proyectos.
 *
 * Se renderiza en lugar del carrusel, no encima ni además: montar un anillo
 * infinito de cero tarjetas es pedirle a `measure()` que divida por un ciclo de
 * ancho 0 y encender un ticker para no pintar nada.
 *
 * ⚠ LO QUE NO SE PUEDE HACER ES NO RENDERIZAR LA SECCIÓN. Toda la coreografía 3D
 * es scroll-linked contra `CHAPTER_MAP`: `gallery` mide 2 viewports y el Núcleo
 * cuenta con ellos. Si el capítulo desaparece del documento, el resto de la
 * landing se adelanta dos viewports respecto de la escena y se descoloca desde
 * acá hasta el footer. Por eso sigue siendo un `ChapterSection` con su id: la
 * altura la pone la carcasa, no el contenido.
 *
 * Y no es un "próximamente" de relleno: lleva salida al formulario. Si no hay
 * portfolio que enseñar, lo segundo mejor es abrir una conversación.
 */
function GalleryEmpty(): React.JSX.Element {
  return (
    <ChapterSection id="gallery" innerClassName="justify-center gap-[3vh] px-5 md:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <p className="type-label" style={{ color: CONTROL_VIOLET }}>
          {EVENTS.name}
        </p>
        <p className="type-label shrink-0" style={{ color: alpha(INK, 35) }}>
          {META.index}
        </p>
      </div>

      <div className="flex max-w-[46ch] flex-col gap-5">
        <h2 className="type-huge max-w-[16ch] uppercase">{UI.empty.title}</h2>
        <p className="text-lead text-balance" style={{ color: alpha(INK, 62) }}>
          {UI.empty.body}
        </p>
        <a
          href="#chapter-converge"
          data-cursor="cta"
          data-cursor-label={UI.empty.cta}
          className="type-label inline-flex min-h-11 items-center self-start px-5 transition-colors duration-300"
          style={{ border: `1px solid ${alpha(CONTROL_VIOLET, 45)}`, color: CONTROL_VIOLET }}
        >
          {UI.empty.cta}
        </a>
      </div>
    </ChapterSection>
  )
}

/**
 * GALERÍA — decide qué versión del capítulo se monta.
 *
 * `ITEMS` es una constante de módulo, así que esta rama se resuelve una vez y no
 * cambia en toda la sesión: no hay hooks condicionales por ningún lado, cada
 * componente monta con su propio conjunto completo.
 */
export function Gallery(): React.JSX.Element {
  return ITEMS.length === 0 ? <GalleryEmpty /> : <GalleryCarousel />
}

function GalleryCarousel(): React.JSX.Element {
  const labelId = useId()
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const activeRef = useRef(0)
  const painted = useRef<Painted[]>([])
  const state = useRef<DragState>({
    x: 0,
    target: 0,
    velocity: 0,
    pointer: 0,
    startX: 0,
    pressed: false,
    dragging: false,
    suppressClick: false,
    centers: [],
    cycle: 0,
    width: 0,
    vIndex: 0,
    dirty: true,
  })

  // Estado de BAJA frecuencia: nada de esto cambia por frame.
  const [active, setActive] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [inView, setInView] = useState(false)
  const [docVisible, setDocVisible] = useState(true)
  // "Queda movimiento pendiente". Conmuta al entrar y al salir del reposo, o sea
  // dos renders por gesto, no sesenta por segundo. Es lo que permite apagar el
  // ticker fuera del capítulo SIN congelar una inercia a medio camino.
  const [awake, setAwake] = useState(false)
  const awakeRef = useRef(false)

  const reduced = getQuality().reduced

  const wake = useCallback(() => {
    state.current.dirty = true
    if (awakeRef.current) return
    awakeRef.current = true
    setAwake(true)
  }, [])

  const sleep = useCallback(() => {
    if (!awakeRef.current) return
    awakeRef.current = false
    setAwake(false)
  }, [])

  /**
   * Destino que centra la tarjeta del índice VIRTUAL `v`.
   *
   * La vuelta entra como `k * cycle`, así que ir de la 08 a la 09 —que es la 01
   * de la vuelta siguiente— es seguir restando píxeles en el mismo sentido.
   * Acá es donde vive el "no vuelve al primero, sigue pa alante".
   */
  const targetFor = useCallback((v: number) => {
    const s = state.current
    const n = s.centers.length
    const k = Math.floor(v / n)
    return s.width / 2 - s.centers[v - k * n] - k * s.cycle
  }, [])

  /** Salta a la tarjeta `i` por el camino MÁS CORTO del anillo. */
  const goTo = useCallback(
    (i: number) => {
      const s = state.current
      const n = s.centers.length
      if (n === 0 || s.cycle <= 0) return

      // Distancia con signo dentro del anillo, en (-n/2, n/2]. Con n par el
      // empate (la tarjeta diametralmente opuesta) se resuelve hacia adelante.
      let d = mod(mod(i, n) - mod(s.vIndex, n), n)
      if (d > n / 2) d -= n

      s.vIndex += d
      s.target = targetFor(s.vIndex)
      wake()
    },
    [targetFor, wake],
  )

  /**
   * Un paso en la dirección pedida. NO delega en `goTo` a propósito: "siguiente"
   * tiene que avanzar SIEMPRE hacia adelante, también al pasar de la 08 a la 01.
   *
   * Trabaja sobre `vIndex` y no sobre `active`, que sólo se refresca por frame:
   * así dos clics dentro del mismo frame avanzan dos tarjetas y no una.
   */
  const stepTo = useCallback(
    (dir: 1 | -1) => {
      const s = state.current
      if (s.centers.length === 0 || s.cycle <= 0) return
      s.vIndex += dir
      s.target = targetFor(s.vIndex)
      wake()
    },
    [targetFor, wake],
  )

  /**
   * Deriva el índice activo desde el DESTINO, y de paso realinea `vIndex`.
   *
   * Ya no sirve comparar `centers[i] + target` a secas: en un anillo la 01 puede
   * estar A LA IZQUIERDA de la 08. Se compara la posición YA ENVUELTA, que
   * además tolera tarjetas de anchos distintos (móvil vs. desktop).
   */
  const syncIndex = useCallback(() => {
    const s = state.current
    const n = s.centers.length
    if (n === 0 || s.cycle <= 0 || s.width === 0) return

    const half = s.width / 2
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < n; i++) {
      const d = Math.abs(wrapCentered(s.centers[i] + s.target - half, s.cycle))
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }

    // Vuelta a la que pertenece el destino. Es lo que mantiene `vIndex` pegado a
    // `target` después de un arrastre, una rueda o una normalización: sin esto,
    // arrastrar tres vueltas y darle a "siguiente" retrocedería tres vueltas.
    s.vIndex = Math.round((half - s.centers[best] - s.target) / s.cycle) * n + best

    if (best !== activeRef.current) {
      activeRef.current = best
      setActive(best)
    }
  }, [])

  /**
   * Escribe la posición de las 8 tarjetas. Cero lecturas del DOM: todo sale de
   * `centers`, que se midió una vez en `measure()`.
   */
  const paint = useCallback(() => {
    const track = trackRef.current
    const s = state.current
    if (!track || s.cycle <= 0 || s.width === 0) return

    const half = s.width / 2
    const cards = track.children
    const total = Math.min(cards.length, s.centers.length)
    const prev = painted.current

    for (let i = 0; i < total; i++) {
      // Desplazamiento respecto al centro, envuelto a media vuelta a cada lado.
      // Acá es donde la tarjeta que se fue por la derecha reaparece por la
      // izquierda: su `rel` cruza `+cycle/2` y sale por `-cycle/2`.
      const rel = wrapCentered(s.centers[i] + s.x - half, s.cycle)
      const tx = half + rel - s.centers[i]

      // -1 = borde izquierdo, 0 = centro exacto, 1 = borde derecho.
      const d = Math.max(-1.6, Math.min(1.6, rel / half))

      // `translate3d` PRIMERO: la perspectiva y el giro tienen que aplicarse
      // sobre la tarjeta ya colocada, o el muro se curvaría alrededor del
      // origen del track en vez de alrededor del centro de cada tarjeta.
      const transform = reduced
        ? `translate3d(${tx.toFixed(2)}px, 0, 0)`
        : `translate3d(${tx.toFixed(2)}px, 0, 0) perspective(1400px) rotateY(${(-d * 16).toFixed(2)}deg) scale(${(1 - Math.abs(d) * 0.08).toFixed(3)})`
      const opacity = reduced ? '1' : (1 - Math.abs(d) * 0.24).toFixed(3)

      // Sólo se escribe lo que CAMBIÓ: asignar el mismo valor a `style` sigue
      // costando invalidación. Mismo criterio que `ScrollHUD` y `Cursor`.
      const card = cards[i] as HTMLElement
      const last = prev[i]
      if (last === undefined) {
        card.style.transform = transform
        card.style.opacity = opacity
        prev[i] = { t: transform, o: opacity }
        continue
      }
      if (last.t !== transform) {
        card.style.transform = transform
        last.t = transform
      }
      if (last.o !== opacity) {
        card.style.opacity = opacity
        last.o = opacity
      }
    }
  }, [reduced])

  // ── Medición: centros y ancho de vuelta ───────────────────────────────────
  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const measure = () => {
      const s = state.current
      const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-card]'))
      const virgin = s.cycle === 0

      s.width = viewport.clientWidth
      s.centers = cards.map((card) => card.offsetLeft + card.offsetWidth / 2)

      // Una vuelta va del borde izquierdo de la primera al derecho de la última
      // MÁS el hueco de cierre. Sin ese hueco, la 08 y la 01 quedarían pegadas
      // justo al envolver y el ritmo del muro se rompería una vez por vuelta.
      // No se usa `track.scrollWidth` porque incluye el padding del track, que
      // no forma parte del periodo.
      const gap = Number.parseFloat(getComputedStyle(track).columnGap)
      const last = cards[cards.length - 1]
      s.cycle =
        cards.length > 0
          ? last.offsetLeft +
            last.offsetWidth -
            cards[0].offsetLeft +
            (Number.isNaN(gap) ? 0 : gap)
          : 0

      // Tras remedir, la tarjeta centrada tiene que seguir siendo la misma.
      // Salvo que haya un dedo apoyado: en móvil la barra de direcciones dispara
      // el ResizeObserver a mitad de arrastre y no se le roba el gesto a nadie.
      if (!s.pressed && s.cycle > 0) {
        s.target = targetFor(s.vIndex)
        // Primera medición: se coloca YA, sin animar desde el layout natural.
        if (virgin) s.x = s.target
      }

      // Cambió la geometría: lo escrito hasta ahora deja de ser comparable.
      painted.current = []
      wake()
    }

    measure()
    // ResizeObserver y no `window.resize`: las tarjetas miden en `vw`/`vh`, así
    // que también hay que remedir cuando se retrae la barra de direcciones del
    // móvil o cambia una scrollbar — cosas que NO disparan `resize` en todos
    // los navegadores. Además dispara una vez al observar, sin medición manual.
    const ro = new ResizeObserver(measure)
    ro.observe(viewport)
    return () => ro.disconnect()
  }, [targetFor, wake])

  // ── Rueda horizontal (trackpad) ───────────────────────────────────────────
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onWheel = (e: WheelEvent) => {
      // Lo PRIMERO de todo: si el gesto es vertical el scroll es de la página y
      // no se toca nada, ni siquiera el estado. El listener es `passive: false`,
      // así que este early return es lo que evita penalizar el scroll normal.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      // Sin clamp: el anillo no tiene bordes contra los que frenar.
      state.current.target -= e.deltaX
      wake()
    }

    // `passive: false` es obligatorio: sin él el navegador ignora preventDefault.
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [wake])

  // ── Señales de pausa del autoplay ─────────────────────────────────────────

  // El capítulo cambia 13 veces en toda la landing: caso de libro para
  // `subscribeChapter`. Un carrusel girando fuera de pantalla es batería tirada.
  useEffect(() => subscribeChapter((s) => setInView(s.chapter === 'gallery')), [])

  useEffect(() => {
    const sync = () => setDocVisible(!document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  // Con reduced motion NO hay autoplay: nunca, bajo ninguna condición.
  const autoplay = !reduced && inView && docVisible && !hovered && !focused && openId === null

  useEffect(() => {
    if (!autoplay) return
    const id = window.setInterval(() => {
      // El dedo manda: mientras haya un puntero apoyado, el reloj espera.
      if (state.current.pressed) return
      // Sin casos especiales: el anillo no se acaba nunca, siempre hay siguiente.
      stepTo(1)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [autoplay, stepTo])

  // Aviso a quien conduce el Canvas. Ver `galleryModal` arriba.
  useEffect(() => {
    setGalleryModal(openId !== null)
    return () => setGalleryModal(false)
  }, [openId])

  // ── Loop: suavizado + muro curvo infinito ─────────────────────────────────
  //
  // `enabled` no es sólo `inView`: si el usuario se va del capítulo con una
  // inercia a medias, cortarle el ticker congelaría el muro torcido y al volver
  // aparecería un salto. Corre mientras el capítulo esté en pantalla O queden
  // píxeles por recorrer; en cuanto se asienta, se desengancha solo.
  useFrameLoop(() => {
    const s = state.current
    if (!trackRef.current) return

    const distance = s.target - s.x
    if (!s.dirty && Math.abs(distance) < 0.05) {
      sleep()
      return
    }

    // Normalización de precisión. `target` crece sin techo mientras el carrusel
    // gira, y un double acaba perdiendo resolución sub-píxel. Se resta un número
    // ENTERO de vueltas a los DOS escalares: la diferencia (target - x) queda
    // intacta, y como restar una vuelta no mueve ninguna posición envuelta, no
    // se ve absolutamente nada. `syncIndex` reconstruye `vIndex` justo después.
    if (s.cycle > 0 && Math.abs(s.x) > s.cycle * 512) {
      const turns = Math.round(s.x / s.cycle) * s.cycle
      s.x -= turns
      s.target -= turns
    }

    // Índice activo desde el DESTINO, no desde la posición interpolada: así los
    // puntos y el anuncio cambian una sola vez por tarjeta y no titilan durante
    // el frenado. `setActive` sólo se llama cuando el entero cambia de verdad.
    syncIndex()

    // Suavizado exponencial: es lo que convierte un arrastre en un peso.
    s.x = reduced ? s.target : s.x + distance * 0.11
    if (Math.abs(s.target - s.x) < 0.05) {
      s.x = s.target
      s.dirty = false
    }

    // El track NO se mueve: se mueve cada tarjeta por separado. Es lo único que
    // permite envolver sin clonar nodos.
    paint()
  }, inView || awake)

  // ── Puntero ───────────────────────────────────────────────────────────────
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = state.current
    s.pressed = true
    s.dragging = false
    s.suppressClick = false
    s.startX = e.clientX
    s.pointer = e.clientX
    s.velocity = 0
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = state.current
    if (!s.pressed) return

    const dx = e.clientX - s.pointer
    s.pointer = e.clientX

    if (!s.dragging) {
      if (Math.abs(e.clientX - s.startX) < DRAG_THRESHOLD) return
      // La captura se pide ACÁ, no en el pointerdown. Capturar de entrada
      // redirige el `click` al contenedor y las tarjetas dejan de ser clicables:
      // es el bug clásico de los carruseles arrastrables.
      s.dragging = true
      s.suppressClick = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    // Velocidad suavizada: el último delta suelto es demasiado nervioso para
    // calcular una inercia creíble.
    s.velocity = s.velocity * 0.68 + dx * 0.32
    s.target += dx
    wake()
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = state.current
    if (!s.pressed) return
    s.pressed = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!s.dragging) return
    s.dragging = false
    // Inercia libre: ya no hay bordes contra los que recortar el lanzamiento, y
    // el suavizado del loop se encarga de frenarlo. Un empujón fuerte puede
    // cruzar varias tarjetas y `syncIndex` lo resuelve solo.
    s.target += s.velocity * 9
    s.velocity = 0
    wake()
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const n = state.current.centers.length
    // Las flechas dan un paso EXACTO de tarjeta —igual que los botones— en vez
    // de empujar píxeles sueltos: con el anillo no hay tope contra el que
    // apoyarse, así que un desplazamiento libre dejaría el muro descentrado.
    if (e.key === 'ArrowRight') stepTo(1)
    else if (e.key === 'ArrowLeft') stepTo(-1)
    else if (e.key === 'Home') goTo(0)
    else if (e.key === 'End') goTo(n - 1)
    else return
    e.preventDefault()
  }

  // El foco entra y sale de los hijos: `onFocus`/`onBlur` de React burbujean
  // (son focusin/focusout), pero hay que ignorar los saltos internos.
  const onFocusIn = () => setFocused(true)
  const onFocusOut = (e: ReactFocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false)
  }

  const openProject = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    // En táctil el `click` sintético llega igual después de un arrastre.
    if (state.current.suppressClick) {
      state.current.suppressClick = false
      return
    }
    openerRef.current = e.currentTarget
    setOpenId(id)
  }

  const closeProject = useCallback(() => {
    setOpenId(null)
    // El foco vuelve a la tarjeta que abrió la ficha. Sin esto, quien navega con
    // teclado aterriza al principio del documento y pierde el sitio.
    //
    // `preventScroll` NO es opcional: la tarjeta está desplazada dentro de un
    // contenedor `overflow-hidden`, y el scroll automático del foco movería el
    // documento por debajo de Lenis, que no se entera y queda desincronizado.
    openerRef.current?.focus({ preventScroll: true })
    openerRef.current = null
  }, [])

  const openItem = openId === null ? null : (ITEMS.find((g) => g.id === openId) ?? null)
  const activeItem = ITEMS[Math.min(active, ITEMS.length - 1)]

  return (
    <ChapterSection id="gallery" innerClassName="justify-center gap-[2.5vh]">
      <div className="flex items-baseline justify-between gap-4 px-5 md:px-10">
        <h2 className="type-label" id={labelId} style={{ color: CONTROL_VIOLET }}>
          {EVENTS.name}
        </h2>
        <p className="type-label shrink-0" style={{ color: alpha(INK, 35) }}>
          {META.index}
        </p>
      </div>

      <div
        ref={viewportRef}
        role="group"
        aria-labelledby={labelId}
        tabIndex={0}
        data-cursor="drag"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={onFocusIn}
        onBlur={onFocusOut}
        // `pan-y`: el navegador se queda el scroll vertical, nosotros el horizontal.
        style={{ touchAction: 'pan-y' }}
        className="relative h-[56svh] w-full select-none md:h-[62svh]"
      >
        {/* El track ya NO se transforma: es sólo el layout de referencia del que
            se leen los centros. Lo que se mueve es cada `<li>`. */}
        <ul
          ref={trackRef}
          className="absolute inset-y-0 left-0 flex items-center gap-4 px-5 md:gap-8 md:px-10"
        >
          {ITEMS.map((item, i) => {
            const accent = ACCENT[item.accent]
            return (
              <li
                key={item.id}
                data-card
                // Ancho explícito + `aspect-[4/5]`: la proporción del contenedor
                // está fijada ANTES de que exista la foto, así que la imagen no
                // puede provocar un salto de layout al cargar. `max-h-full` es
                // el seguro: en pantallas bajas (o móvil apaisado) recorta el
                // alto en vez de desbordar el viewport del carrusel.
                //
                // `gpu` va acá y no en el track: ahora cada tarjeta es la que
                // anima su propio `transform`, así que cada una quiere su capa.
                //
                // `min-[3200px]` NO es capricho de diseño, es el requisito del
                // anillo: una vuelta tiene que medir MÁS que el viewport o una
                // misma tarjeta tendría que verse por los dos bordes a la vez,
                // y sólo hay un nodo por tarjeta. Con 8×(24rem+2rem)=3328px la
                // vuelta aguanta hasta 3200px de ancho; por encima (ultrawide,
                // 4K) las tarjetas crecen a 30rem y la vuelta pasa a 4096px.
                //
                // ⚠ ESTA CUENTA DEPENDE DEL NÚMERO DE PROYECTOS, y el array está
                // vacío esperando los reales. Son ~416px por proyecto: con menos
                // de 5 la vuelta no cubre una pantalla normal y aparece una
                // costura en los extremos. Ver el bloque de `GALLERY` en
                // `@/content` antes de publicar tres proyectos y confiar.
                className="gpu relative aspect-[4/5] max-h-full w-[70vw] shrink-0 overflow-hidden sm:w-[44vw] md:w-[34vw] lg:w-[24rem] min-[3200px]:w-[30rem]"
                style={{
                  // OPACA. Éste es el arreglo: sin esto se ven las partículas
                  // del Núcleo a través de la foto.
                  backgroundColor: CONTROL_BG,
                  border: `1px solid ${alpha(accent, 26)}`,
                }}
              >
                <button
                  type="button"
                  data-cursor="cta"
                  data-cursor-label={UI.cta}
                  aria-haspopup="dialog"
                  aria-label={`${UI.cta}${UI.sep}${item.title}${UI.sep}${item.meta}`}
                  onClick={(e) => openProject(e, item.id)}
                  className="group flex h-full w-full flex-col text-left outline-offset-[-4px]"
                >
                  {/* Media: `flex-1` dentro de una tarjeta de alto fijo, o sea
                      alto determinista. La foto va absolute encima: no puede
                      empujar el layout ni al cargar ni al fallar. */}
                  <span className="relative block w-full min-h-0 flex-1 overflow-hidden">
                    <Shot
                      src={item.images[0]}
                      alt={`${UI.imageAlt}${UI.sep}${item.title}`}
                      n={i + 1}
                      title={item.title}
                      tone={i}
                      fit="cover"
                      // 4/5, la proporción de la tarjeta.
                      w={384}
                      h={480}
                    />

                    {/* Degradado: funde la foto con la franja de datos y sostiene
                        el número. Sobre fondo opaco, así que no deja pasar nada. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: `linear-gradient(0deg, ${CONTROL_BG} 0%, ${alpha(CONTROL_BG, 55)} 26%, transparent 58%), linear-gradient(180deg, ${alpha(accent, 16)} 0%, transparent 30%)`,
                      }}
                    />

                    <span
                      aria-hidden="true"
                      className="type-label absolute left-4 top-4"
                      style={{ color: alpha(INK, 70) }}
                    >
                      {pad(i + 1)}
                    </span>
                  </span>

                  {/* Franja de datos: fondo sólido, sin excepción. */}
                  <span
                    className="relative block shrink-0 px-4 pb-4 pt-1"
                    style={{ backgroundColor: CONTROL_BG }}
                  >
                    <span
                      className="type-label block truncate"
                      style={{ color: alpha(accent, 90) }}
                    >
                      {item.meta}
                    </span>
                    <span className="mt-1 block text-2xl font-semibold uppercase leading-none md:text-3xl">
                      {item.title}
                    </span>
                    <span
                      className="type-label mt-2 block truncate"
                      style={{ color: alpha(INK, 42) }}
                    >
                      {`${item.year}${UI.sep}${item.client}`}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Controles ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 md:px-10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-cursor="hover"
            aria-label={UI.prev}
            // `stepTo` y no `goTo(active - 1)`: retrocede SIEMPRE, también desde
            // la 01, donde entra la 08 por la izquierda.
            onClick={() => stepTo(-1)}
            className="grid size-11 place-items-center transition-colors duration-300"
            style={{ border: `1px solid ${alpha(INK, 20)}`, color: INK }}
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            data-cursor="hover"
            aria-label={UI.next}
            // Avanza SIEMPRE hacia adelante: desde la 08 sigue de largo y entra
            // la 01 por la derecha. Nunca se queda muerto.
            onClick={() => stepTo(1)}
            className="grid size-11 place-items-center transition-colors duration-300"
            style={{ border: `1px solid ${alpha(INK, 20)}`, color: INK }}
          >
            <Chevron dir="right" />
          </button>
        </div>

        {/* ÁREA TÁCTIL DE LOS PUNTOS.
            El punto sigue midiendo 6px: lo que crece es la caja que lo caza,
            que antes eran 20×20 —menos de la mitad del mínimo táctil— y ahora
            son 40×40 en móvil y 44×44 desde `sm`.

            Los 40 de móvil no son pereza, es aritmética: ocho objetivos de
            44px son 352px, y a 375px de ancho con los 20px de medianil a cada
            lado sólo quedan 335. Cuarenta es el máximo que entra sin que la
            fila desborde ni haya que esconder controles. `flex-wrap` es el
            seguro por si algún día se añade un noveno proyecto. */}
        <ul className="flex flex-wrap items-center gap-0 sm:gap-1.5">
          {ITEMS.map((item, i) => (
            <li key={item.id} className="flex">
              <button
                type="button"
                data-cursor="hover"
                aria-label={`${UI.goTo}${UI.sep}${item.title}`}
                aria-current={i === active ? 'true' : undefined}
                onClick={() => goTo(i)}
                className="grid size-10 place-items-center sm:size-11"
              >
                {/* Sólo se anima `transform`: el punto activo se ESCALA, no
                    cambia de tamaño de caja. */}
                <span
                  aria-hidden="true"
                  className="block size-1.5 rounded-full transition-transform duration-500"
                  style={{
                    backgroundColor: i === active ? ACCENT[item.accent] : alpha(INK, 28),
                    transform: i === active ? 'scale(1.9)' : 'scale(1)',
                    transitionTimingFunction: EASE_OUT_EXPO,
                  }}
                />
              </button>
            </li>
          ))}
        </ul>

        <p
          aria-live="polite"
          aria-atomic="true"
          className="type-label ml-auto min-w-0 truncate"
          style={{ color: alpha(INK, 45) }}
        >
          {`${pad(active + 1)} / ${pad(ITEMS.length)}${UI.sep}${activeItem.title}`}
        </p>

        <p className="type-label hidden w-full lg:block" style={{ color: alpha(INK, 26) }}>
          {UI.hint}
        </p>
      </div>

      {openItem !== null && <ProjectDialog item={openItem} onClose={closeProject} />}
    </ChapterSection>
  )
}
