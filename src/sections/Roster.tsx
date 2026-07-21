import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import type {
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
 * ROSTER — los artistas de Mood Agency como CARTAS COLECCIONABLES.
 *
 * Ocupa el capítulo `gallery`. El id NO se renombra: está cableado en
 * `ChapterId`, en la coreografía 3D y en `CHAPTER_MAP`, y su `vh` define un
 * tramo del timeline scroll-linked. Lo que cambió es el contenido, no el hueco.
 *
 * ── POR QUÉ NO HAY NI UNA FOTO ──────────────────────────────────────────────
 *
 * Del roster REAL sólo se conoce el NOMBRE (ver `ARTISTS` en `@/content`). No
 * hay retratos con derechos, no hay género musical y no hay trayectoria. En vez
 * de dejar cuatro huecos esperando un JPG, el "retrato" se GENERA: un hash del
 * nombre siembra un PRNG y de ahí salen ángulos, centros y paradas de color.
 * Determinista de verdad — mismo nombre, misma carta, en todos los navegadores
 * y en todos los despliegues. Cero peticiones, cero 404, cero placeholder roto.
 *
 * ── LOS TRES EFECTOS, Y POR QUÉ SON BARATOS ─────────────────────────────────
 *
 * 1. INCLINACIÓN. `rotateX`/`rotateY` con la `perspective()` dentro de la propia
 *    función de transform, no en el contenedor: así cada carta tiene su punto de
 *    fuga y las de los extremos no salen deformadas. El puntero NO manda directo
 *    sobre el ángulo: alimenta un muelle (velocidad + rigidez + amortiguación)
 *    que al soltar devuelve la carta a plano con un rebote corto. Un lerp puro
 *    frena y ya; el rebote es lo que hace que pese como un cartón plastificado.
 *
 * 2. HOLOGRAFÍA. Una lámina SOBREDIMENSIONADA con bandas iridiscentes fijas que
 *    se TRASLADA con el puntero, en `mix-blend-mode: color-dodge`. La clave de
 *    rendimiento: el degradado nunca se recalcula. Mover el origen de un
 *    `linear-gradient` por frame obliga a repintar la capa entera; trasladar una
 *    lámina ya pintada lo resuelve el compositor. Se ve igual y cuesta nada.
 *    `color-dodge` y no `screen` porque sobre el negro de Mood Agency el screen
 *    lava el color y pierde el arcoíris; el dodge lo satura, que es justo el
 *    gesto de una carta holo. Las alfas van bajas a propósito para que no queme.
 *
 * 3. BARRIDO (glare). Otra lámina, una sola banda diagonal en `screen`, que se
 *    desplaza MÁS que la holografía. Ese desfase entre las dos capas es lo que
 *    el ojo lee como "superficie satinada" y no como "dos degradados".
 *
 * ── MOVIMIENTO EN REPOSO ────────────────────────────────────────────────────
 *
 * Sin puntero encima, cada carta sigue una deriva senoidal lenta con una fase
 * distinta (sacada de la misma semilla) para que las cuatro no respiren a la
 * vez. Es también lo único que se ve en táctil, donde no hay hover: la sección
 * está viva igual con el dedo que con el ratón.
 *
 * ── LO QUE NO SE HACE, Y ES DELIBERADO ──────────────────────────────────────
 *
 * - Cero estado de React por frame: la posición vive en refs y sólo se escriben
 *   `transform` y `opacity`, y sólo si el valor CAMBIÓ respecto al frame previo.
 * - Cero `getBoundingClientRect()` en el loop. El rect se mide al ENTRAR el
 *   puntero y en cada `ResizeObserver`, nunca a 60Hz.
 * - El ticker no corre fuera del capítulo, con la pestaña oculta, con el detalle
 *   abierto ni con `reduced`. Cuatro cartas girando para nadie es batería tirada.
 */

const META = chapterMeta('gallery')
const ITEMS = EVENTS.artists
const UI = EVENTS.artistsUI

type Artist = (typeof ITEMS)[number]
type Accent = Artist['accent']

/** El acento es DATO (`content.ts`); acá sólo se traduce a token. Cero hex. */
const ACCENT: Record<Accent, string> = {
  violet: CONTROL_VIOLET,
  blue: CONTROL_BLUE,
  red: CONTROL_RED,
}

/** Los tres neones de Mood Agency. La paleta del arte generativo sale de acá. */
const NEONS = [CONTROL_VIOLET, CONTROL_BLUE, CONTROL_RED]

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Mismo easing que el CSS del proyecto, en el formato que espera `motion`. */
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const pad = (n: number) => String(n).padStart(2, '0')

/* ──────────────────────  ARTE GENERATIVO DETERMINISTA  ─────────────────────── */

/**
 * FNV-1a de 32 bits. No es criptografía: es un revuelto barato y ESTABLE.
 * `Math.imul` no es capricho — la multiplicación normal de JS desborda a coma
 * flotante y el mismo nombre daría hashes distintos según el motor.
 */
function hashName(value: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: PRNG de 32 bits, una línea de estado y distribución decente. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface CardArt {
  /** Capa base: el "retrato". Cónico, para que gire con la deriva. */
  portrait: string
  /** Retícula fina encima. Es lo que da textura de cromo impreso. */
  grid: string
  /** Halo radial que centra la mirada donde nace el cónico. */
  glow: string
  /** Grados por segundo de la deriva en reposo. Con signo: unas giran al revés. */
  spin: number
  /** Desfase de la respiración. Evita que las cuatro cartas latan a la vez. */
  phase: number
}

/**
 * Traduce un nombre a una carta. TODO sale de la semilla salvo el acento, que es
 * decisión editorial y viene de `content.ts`.
 *
 * Se llama UNA vez por artista en tiempo de módulo (ver `ART`): son cadenas CSS
 * constantes, no hay motivo para recalcularlas en cada render.
 */
function artFor(artist: Artist): CardArt {
  const accent = ACCENT[artist.accent]
  const rnd = seeded(hashName(artist.name))

  const second = NEONS[Math.floor(rnd() * NEONS.length)]
  const third = NEONS[Math.floor(rnd() * NEONS.length)]
  const from = Math.round(rnd() * 360)
  // El centro nunca llega al borde: un cónico anclado en una esquina se lee como
  // un error de gradiente, no como una composición.
  const cx = 24 + Math.round(rnd() * 50)
  const cy = 22 + Math.round(rnd() * 46)
  const gridDeg = Math.round(rnd() * 180)
  const gridGap = 6 + Math.floor(rnd() * 7)
  const spin = (rnd() < 0.5 ? -1 : 1) * (2.2 + rnd() * 3.4)
  const phase = rnd() * Math.PI * 2

  return {
    portrait: `conic-gradient(from ${from}deg at ${cx}% ${cy}%, ${alpha(accent, 92)} 0turn, ${alpha(second, 46)} 0.24turn, ${alpha(CONTROL_BG, 96)} 0.5turn, ${alpha(third, 58)} 0.74turn, ${alpha(accent, 92)} 1turn)`,
    grid: `repeating-linear-gradient(${gridDeg}deg, ${alpha(INK, 10)} 0 1px, transparent 1px ${gridGap}px)`,
    glow: `radial-gradient(circle at ${cx}% ${cy}%, ${alpha(INK, 24)} 0%, transparent 52%)`,
    spin,
    phase,
  }
}

const ART: readonly CardArt[] = ITEMS.map(artFor)

/**
 * BANDAS HOLO. Fijas y compartidas: la lámina se TRASLADA, nunca se repinta, así
 * que una sola cadena sirve para las cuatro cartas y para el detalle.
 */
const HOLO = `repeating-linear-gradient(112deg,
  transparent 0%,
  ${alpha(CONTROL_VIOLET, 46)} 7%,
  ${alpha(CONTROL_BLUE, 44)} 12%,
  ${alpha(CONTROL_RED, 38)} 17%,
  transparent 24%)`

/** Banda única del barrido satinado. */
const GLARE = `linear-gradient(104deg, transparent 34%, ${alpha(INK, 30)} 50%, transparent 66%)`

/**
 * Prefijo de centrado de las láminas sobredimensionadas.
 *
 * Las tres capas se anclan con `left-1/2 top-1/2` y se recentran con esto. Va
 * en el `transform` —y no en clases de traslación de Tailwind— porque el loop
 * REESCRIBE `style.transform` entero sesenta veces por segundo: si el centrado
 * viviera en otra propiedad, mantenerlo dependería del orden de composición de
 * CSS, que es exactamente la clase de detalle que se rompe en silencio.
 */
const CENTER = 'translate(-50%, -50%)'

/* ──────────────────────────  SEÑAL DE CAPA ENCIMA  ─────────────────────────── */

/**
 * Mientras el detalle está abierto hay un panel OPACO tapando la pantalla: el
 * Núcleo se sigue renderizando para nadie. Esta sección NO desmonta ni pausa el
 * Canvas —eso rompería la regla 1 de ARCHITECTURE.md y encima no es suya—: sólo
 * DECLARA que hay una capa encima, vía `overlayStore`, y deja que `App` decida.
 * El `data-*` en `<html>` es para quien enganche tarde o para el CSS.
 */
let modalOpen = false

function setRosterModal(open: boolean): void {
  if (modalOpen === open) return
  modalOpen = open
  if (open) document.documentElement.dataset.rosterModal = 'open'
  else delete document.documentElement.dataset.rosterModal
  setOverlay('roster-modal', open)
}

/* ────────────────────────────  CAPAS DE LA CARTA  ──────────────────────────── */

interface ArtworkProps {
  art: CardArt
  /** Opacidad base de la holografía. El loop la sube al pasar el puntero. */
  holoOpacity: number
}

/**
 * Las tres láminas del cromo, en orden de pintado.
 *
 * Los `data-l` NO son decoración: son cómo el loop encuentra las capas que tiene
 * que mover sin guardar tres refs por carta ni re-renderizar para asignarlas.
 * Se consultan una sola vez, cuando React entrega el nodo raíz.
 *
 * Todas van `absolute inset-0` dentro de un contenedor de proporción fijada: una
 * capa de estas no puede mover el layout ni cuando entra ni cuando se anima.
 */
function Artwork({ art, holoOpacity }: ArtworkProps): React.JSX.Element {
  return (
    <>
      {/* Retrato. Sobredimensionado y centrado porque va a GIRAR: a tamaño
          exacto, la esquina del cónico dejaría un triángulo vacío al rotar.

          ⚠ EL CENTRADO VA EN EL `transform` INLINE, no en clases de Tailwind.
          El loop reescribe `style.transform` entero, así que un centrado que
          viviera en otra propiedad quedaría a merced del orden de composición
          de CSS. Acá está declarado en el MISMO sitio que lo va a pisar: ver
          `CENTER` en el loop, que reconstruye este prefijo en cada frame. */}
      <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <span
          data-l="art"
          className="gpu absolute left-1/2 top-1/2 block h-[170%] w-[170%]"
          style={{
            backgroundImage: `${art.glow}, ${art.grid}, ${art.portrait}`,
            transform: CENTER,
          }}
        />
      </span>

      {/* Holografía. `color-dodge` sobre el negro de Mood Agency: satura el
          arcoíris en vez de lavarlo. La lámina mide 200% para que trasladarla
          nunca destape un borde. */}
      <span
        aria-hidden="true"
        data-l="holo"
        className="gpu pointer-events-none absolute left-1/2 top-1/2 block h-[200%] w-[200%]"
        style={{
          backgroundImage: HOLO,
          mixBlendMode: 'color-dodge',
          opacity: holoOpacity,
          transform: CENTER,
        }}
      />

      {/* Barrido satinado. Se mueve MÁS que la holografía: ese desfase es el
          efecto. `screen` y no `dodge` — acá se quiere luz, no saturación. */}
      <span
        aria-hidden="true"
        data-l="glare"
        className="gpu pointer-events-none absolute left-1/2 top-1/2 block h-[200%] w-[200%]"
        style={{
          backgroundImage: GLARE,
          mixBlendMode: 'screen',
          opacity: 0.5,
          transform: CENTER,
        }}
      />
    </>
  )
}

/* ──────────────────────────────  DETALLE  ─────────────────────────────────── */

interface ArtistDialogProps {
  artist: Artist
  index: number
  onClose: () => void
}

/**
 * DETALLE — modal, no volteo de carta. Y el porqué importa:
 *
 * Un volteo es más bonito de contar y peor de usar acá. El reverso heredaría el
 * tamaño de la carta (13.5rem en escritorio, ~255px en móvil) y una `bio` de tres
 * frases con enlaces no entra: o se hace scroll dentro de un cartón inclinado, o
 * se le recorta el texto al artista. Encima el reverso vive dentro de un ancestro
 * con `transform`, así que atrapar el foco ahí obliga a pelearse con la
 * inclinación y con el `overflow-hidden` del capítulo.
 *
 * El modal sale por `createPortal` a `body` por esa misma razón: un `fixed`
 * dentro de un ancestro transformado se posiciona respecto a ESE ancestro, no al
 * viewport, y la carcasa del capítulo es `overflow-hidden`. Sería un panel
 * descolocado y recortado.
 *
 * Y da lo que el volteo no puede: la carta EN GRANDE, que es lo que se quiere
 * mirar cuando todavía no hay biografía que leer.
 *
 * El bloqueo de scroll sigue el enfoque de `ui/Preloader.tsx` —`overflow:hidden`
 * en `html` y `body`, restaurando al desmontar— más dos cosas que el preloader
 * no necesita: compensar el ancho de la barra (acá el documento YA estaba
 * scrolleando y al ocultarla todo saltaría a la derecha) y cortar la burbuja de
 * `wheel`/`touchmove` antes de `window`, que es donde escucha Lenis; sin eso
 * Lenis acumula inercia mientras leés y la descarga de golpe al cerrar.
 */
function ArtistDialog({ artist, index, onClose }: ArtistDialogProps): React.JSX.Element {
  const titleId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const reduced = getQuality().reduced
  const accent = ACCENT[artist.accent]
  const art = ART[index]
  const links = artist.links ?? []

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
    // Se compensa con padding, no con margin: el margin dispararía el
    // `overflow-x` del body, que es justo lo que no puede pasar.
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
      // controles depende de cuántos `links` tenga el artista, que hoy son cero
      // y mañana pueden ser tres.
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
      // backdrop se recompone cada frame que el Núcleo dibuja. El coste crece
      // con el radio, y a 90% de opacidad del fondo 7px y 12px se ven igual.
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
        /* `dvh` acá SÍ, y es el único sitio donde corresponde: el panel es
           `fixed`, no forma parte del alto del documento, así que seguir el
           viewport en vivo no puede desplazar el progreso de scroll de nadie.
           Con `vh` el 94% se mide contra el viewport GRANDE y en móvil el pie de
           la ficha queda debajo de la barra de direcciones, inalcanzable. */
        className="relative flex max-h-[94dvh] w-full max-w-[62rem] flex-col overflow-y-auto overscroll-contain outline-none sm:max-h-[88dvh]"
        // Panel OPACO, sin excepción: detrás hay 45.000 partículas y no pueden
        // leerse a través del detalle.
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
            {`${UI.cardLabel} ${pad(index + 1)} / ${pad(ITEMS.length)}`}
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
              <path d="M4 4 L20 20 M20 4 L4 20" stroke="currentColor" strokeWidth="1.6" fill="none" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 px-5 pb-8 pt-6 md:px-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* ── La carta, en grande y quieta ──
              Sin inclinación ni deriva: acá se viene a LEER, y un cartón
              moviéndose al lado del texto es ruido. Mantiene las tres láminas
              para que sea reconociblemente la misma carta que se pulsó. */}
          <div
            className="relative mx-auto w-full max-w-[20rem] overflow-hidden"
            style={{ aspectRatio: '5 / 7', border: `1px solid ${alpha(accent, 38)}` }}
          >
            <Artwork art={art} holoOpacity={0.42} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: `linear-gradient(0deg, ${CONTROL_BG} 0%, ${alpha(CONTROL_BG, 40)} 34%, transparent 62%)`,
              }}
            />
            <span
              className="absolute inset-x-0 bottom-0 block px-5 pb-5"
              style={{ color: INK }}
            >
              <span className="block text-3xl font-semibold uppercase leading-none">
                {artist.name}
              </span>
            </span>
          </div>

          {/* ── Ficha ── */}
          <div className="flex flex-col gap-7">
            <h3 id={titleId} className="type-huge uppercase">
              {artist.name}
            </h3>

            {/* Cada bloque aparece SOLO cuando su campo existe. Hoy los tres
                están vacíos y no se ve ninguno: no hay "próximamente", no hay
                guion suelto y no hay enlace muerto. En cuanto el cliente rellene
                `role`, `bio` o `links` en `content.ts` salen sin tocar esto. */}
            {artist.role !== undefined && (
              <div className="flex flex-col gap-2">
                <h4 className="type-label" style={{ color: alpha(INK, 35) }}>
                  {UI.fields.role}
                </h4>
                <p className="text-sm leading-relaxed" style={{ color: alpha(INK, 78) }}>
                  {artist.role}
                </p>
              </div>
            )}

            {artist.bio !== undefined && (
              <div className="flex flex-col gap-2">
                <h4 className="type-label" style={{ color: alpha(INK, 35) }}>
                  {UI.fields.about}
                </h4>
                <p className="max-w-[52ch] text-sm leading-relaxed" style={{ color: alpha(INK, 78) }}>
                  {artist.bio}
                </p>
              </div>
            )}

            {links.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="type-label" style={{ color: alpha(INK, 35) }}>
                  {UI.fields.links}
                </h4>
                <ul className="flex flex-wrap gap-2">
                  {links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-cursor="hover"
                        className="type-label inline-flex min-h-11 items-center px-3"
                        style={{ border: `1px solid ${alpha(accent, 38)}`, color: alpha(INK, 82) }}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CIERRE SIEMPRE PRESENTE. Es lo que sostiene la ficha mientras los
                tres bloques de arriba estén vacíos: en vez de rellenar con datos
                que nadie confirmó, se abre una conversación. Y cuando el cliente
                los rellene sigue teniendo sentido, así que no es un parche. */}
            <div
              className="flex flex-col items-start gap-4 pt-6"
              style={{ borderTop: `1px solid ${alpha(INK, 14)}` }}
            >
              <p className="max-w-[46ch] text-sm leading-relaxed" style={{ color: alpha(INK, 62) }}>
                {UI.booking.body}
              </p>
              <a
                href={UI.booking.href}
                onClick={onClose}
                data-cursor="cta"
                data-cursor-label={UI.booking.cta}
                className="type-label inline-flex min-h-11 items-center px-5 transition-colors duration-300"
                style={{ border: `1px solid ${alpha(accent, 50)}`, color: accent }}
              >
                {UI.booking.cta}
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

/* ────────────────────────────────  SECCIÓN  ────────────────────────────────── */

/** Nodo raíz de una carta + sus tres láminas, resueltas una sola vez. */
interface CardNodes {
  root: HTMLButtonElement
  art: HTMLElement
  holo: HTMLElement
  glare: HTMLElement
}

/** Estado de movimiento de una carta. Vive en un ref: nunca en `useState`. */
interface CardMotion {
  /** Objetivo del puntero, normalizado a [-1, 1] desde el centro de la carta. */
  tx: number
  ty: number
  /** Posición actual del muelle. */
  cx: number
  cy: number
  /** Velocidad del muelle. Es lo que produce el rebote al volver a plano. */
  vx: number
  vy: number
  /** Cuánto manda el puntero (1) frente a la deriva en reposo (0). */
  hover: number
  hoverTarget: number
  /** Rect medido al entrar el puntero. NUNCA se lee dentro del loop. */
  left: number
  top: number
  width: number
  height: number
}

/** Último valor escrito en cada capa. Ver el bucle de pintado. */
interface Painted {
  root: string
  art: string
  holo: string
  holoOpacity: string
  glare: string
}

const newMotion = (): CardMotion => ({
  tx: 0,
  ty: 0,
  cx: 0,
  cy: 0,
  vx: 0,
  vy: 0,
  hover: 0,
  hoverTarget: 0,
  left: 0,
  top: 0,
  width: 1,
  height: 1,
})

/** Opacidad de la holografía en reposo. El puntero la sube hasta ~0.9. */
const HOLO_BASE = 0.34

export function Roster(): React.JSX.Element {
  const labelId = useId()
  const rowRef = useRef<HTMLUListElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  const nodes = useRef<(CardNodes | null)[]>([])
  const painted = useRef<(Painted | null)[]>([])
  const motionState = useRef<CardMotion[]>(ITEMS.map(newMotion))

  // Estado de BAJA frecuencia: nada de esto cambia por frame.
  const [openId, setOpenId] = useState<string | null>(null)
  const [inView, setInView] = useState(false)
  const [docVisible, setDocVisible] = useState(true)

  const reduced = getQuality().reduced

  /**
   * Guarda el nodo y RESUELVE sus tres láminas de una vez.
   *
   * Se hace acá y no con tres refs por carta porque las capas son detalle de
   * implementación de `Artwork`: sacarlas a props obligaría a que la sección
   * conozca la estructura interna de la carta, y a re-renderizar para asignar
   * refs que el loop sólo necesita leer.
   */
  const bindCard = useCallback(
    (i: number) => (el: HTMLButtonElement | null) => {
      if (el === null) {
        nodes.current[i] = null
        painted.current[i] = null
        return
      }
      const art = el.querySelector<HTMLElement>('[data-l="art"]')
      const holo = el.querySelector<HTMLElement>('[data-l="holo"]')
      const glare = el.querySelector<HTMLElement>('[data-l="glare"]')
      if (art !== null && holo !== null && glare !== null) {
        nodes.current[i] = { root: el, art, holo, glare }
      }
    },
    [],
  )

  /** Mide UNA carta. Se llama al entrar el puntero y al redimensionar, jamás por frame. */
  const measure = useCallback((i: number) => {
    const node = nodes.current[i]
    if (node === null || node === undefined) return
    const m = motionState.current[i]
    const rect = node.root.getBoundingClientRect()
    m.left = rect.left
    m.top = rect.top
    m.width = rect.width || 1
    m.height = rect.height || 1
  }, [])

  // ── Señales de pausa ──────────────────────────────────────────────────────

  // El capítulo cambia 13 veces en toda la landing: caso de libro para
  // `subscribeChapter`, que sólo emite al cambiar de capítulo.
  useEffect(() => subscribeChapter((s) => setInView(s.chapter === 'gallery')), [])

  useEffect(() => {
    const sync = () => setDocVisible(!document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  // Aviso a quien conduce el Canvas. Ver `setRosterModal` arriba.
  useEffect(() => {
    setRosterModal(openId !== null)
    return () => setRosterModal(false)
  }, [openId])

  // ── Remedición ────────────────────────────────────────────────────────────
  //
  // ResizeObserver sobre la fila y no `window.resize`: las cartas miden en `vw`,
  // así que también hay que remedir cuando se retrae la barra de direcciones del
  // móvil o aparece una scrollbar, cosas que NO disparan `resize` en todos los
  // navegadores. Además dispara una vez al observar, sin medición manual.
  useEffect(() => {
    const row = rowRef.current
    if (row === null) return
    const ro = new ResizeObserver(() => {
      for (let i = 0; i < ITEMS.length; i++) measure(i)
    })
    ro.observe(row)
    return () => ro.disconnect()
  }, [measure])

  // ── Loop ──────────────────────────────────────────────────────────────────
  //
  // `time` viene en SEGUNDOS del ticker de GSAP, que es el mismo loop que conduce
  // a Lenis: un rAF paralelo iría medio frame por detrás y ese medio frame se ve.
  //
  // Con `reduced` el ticker ni se engancha: las cartas se quedan con los estilos
  // estáticos del render, planas y legibles, y el detalle sigue abriéndose.
  useFrameLoop(
    (time) => {
      const total = ITEMS.length
      for (let i = 0; i < total; i++) {
        const node = nodes.current[i]
        if (node === null || node === undefined) continue

        const m = motionState.current[i]
        const art = ART[i]

        // Traspaso suave entre "manda el puntero" y "manda la deriva". Sin esto,
        // al salir el ratón la carta saltaría de un ángulo a otro.
        m.hover += (m.hoverTarget - m.hover) * 0.1
        const idle = 1 - m.hover

        // Deriva en reposo: dos senos de periodo distinto y desfase sembrado, así
        // las cuatro cartas no respiran a la vez. Es lo ÚNICO que se ve en
        // táctil, donde no existe el hover.
        const driftX = Math.sin(time * 0.5 + art.phase) * 0.3
        const driftY = Math.cos(time * 0.37 + art.phase) * 0.24

        const tx = m.tx * m.hover + driftX * idle
        const ty = m.ty * m.hover + driftY * idle

        // MUELLE, no lerp. El lerp frena y se para; el muelle pasa un poco de
        // largo y vuelve, que es el rebote elástico que se pidió al soltar.
        // Rigidez 0.14 + amortiguación 0.76 → un solo rebote corto, sin marear.
        m.vx = (m.vx + (tx - m.cx) * 0.14) * 0.76
        m.vy = (m.vy + (ty - m.cy) * 0.14) * 0.76
        m.cx += m.vx
        m.cy += m.vy

        // `perspective()` DENTRO de la función y no en el contenedor: así cada
        // carta tiene su propio punto de fuga y las de los extremos de la fila no
        // salen deformadas hacia el centro.
        const lift = 1 + m.hover * 0.035
        const root = `perspective(760px) rotateX(${(-m.cy * 9).toFixed(2)}deg) rotateY(${(m.cx * 11).toFixed(2)}deg) scale(${lift.toFixed(3)})`

        // El retrato gira despacio y se contra-mueve un pelín: el paralaje entre
        // el arte y el marco es lo que da profundidad de cromo.
        // `CENTER` primero, SIEMPRE: estas tres láminas están ancladas al 50/50
        // de la carta y miden 170%/200%, así que sin recentrarlas cada frame se
        // irían a la esquina inferior derecha.
        const artT = `${CENTER} translate3d(${(-m.cx * 2.2).toFixed(2)}%, ${(-m.cy * 2.2).toFixed(2)}%, 0) rotate(${((time * art.spin) % 360).toFixed(2)}deg)`

        // Las dos láminas se mueven en el MISMO sentido pero a distinta escala:
        // ese desfase es lo que el ojo lee como superficie satinada.
        const holoT = `${CENTER} translate3d(${(m.cx * 16).toFixed(2)}%, ${(m.cy * 16).toFixed(2)}%, 0)`
        const glareT = `${CENTER} translate3d(${(m.cx * 30).toFixed(2)}%, ${(m.cy * 26).toFixed(2)}%, 0)`
        const holoO = (HOLO_BASE + m.hover * 0.54).toFixed(3)

        // Sólo se escribe lo que CAMBIÓ: asignar el mismo valor a `style` sigue
        // costando invalidación. Mismo criterio que `ScrollHUD` y `Cursor`.
        const prev = painted.current[i]
        if (prev === null || prev === undefined) {
          node.root.style.transform = root
          node.art.style.transform = artT
          node.holo.style.transform = holoT
          node.holo.style.opacity = holoO
          node.glare.style.transform = glareT
          painted.current[i] = { root, art: artT, holo: holoT, holoOpacity: holoO, glare: glareT }
          continue
        }
        if (prev.root !== root) {
          node.root.style.transform = root
          prev.root = root
        }
        if (prev.art !== artT) {
          node.art.style.transform = artT
          prev.art = artT
        }
        if (prev.holo !== holoT) {
          node.holo.style.transform = holoT
          prev.holo = holoT
        }
        if (prev.holoOpacity !== holoO) {
          node.holo.style.opacity = holoO
          prev.holoOpacity = holoO
        }
        if (prev.glare !== glareT) {
          node.glare.style.transform = glareT
          prev.glare = glareT
        }
      }
    },
    !reduced && inView && docVisible && openId === null,
  )

  // ── Puntero ───────────────────────────────────────────────────────────────

  const onEnter = (i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    // Sin hover no hay inclinación: en táctil el `pointerenter` llega junto al
    // tap y dejaría la carta torcida hasta el siguiente toque. Ahí manda la
    // deriva, que ya está corriendo.
    if (e.pointerType === 'touch') return
    measure(i)
    motionState.current[i].hoverTarget = 1
  }

  const onMove = (i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'touch') return
    const m = motionState.current[i]
    // Normalizado a [-1, 1] contra el rect CACHEADO. Cero lecturas del DOM acá.
    m.tx = ((e.clientX - m.left) / m.width) * 2 - 1
    m.ty = ((e.clientY - m.top) / m.height) * 2 - 1
  }

  const onLeave = (i: number) => () => {
    const m = motionState.current[i]
    m.hoverTarget = 0
    m.tx = 0
    m.ty = 0
  }

  // Teclado: el foco enciende la holografía pero NO inclina. Inclinar sin un
  // puntero que lo justifique se lee como un glitch, y quien tabula necesita el
  // texto quieto para leerlo.
  const onFocusCard = (i: number) => () => {
    motionState.current[i].hoverTarget = 1
    motionState.current[i].tx = 0
    motionState.current[i].ty = 0
  }

  const openCard = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    openerRef.current = e.currentTarget
    setOpenId(id)
  }

  const closeCard = useCallback(() => {
    setOpenId(null)
    // El foco vuelve a la carta que abrió el detalle. Sin esto, quien navega con
    // teclado aterriza al principio del documento y pierde el sitio.
    //
    // `preventScroll` NO es opcional: la carta vive dentro de un contenedor con
    // scroll horizontal y de un capítulo `overflow-hidden`, y el scroll
    // automático del foco movería el documento por debajo de Lenis, que no se
    // entera y queda desincronizado.
    openerRef.current?.focus({ preventScroll: true })
    openerRef.current = null
  }, [])

  const openIndex = openId === null ? -1 : ITEMS.findIndex((a) => a.id === openId)

  return (
    <ChapterSection id="gallery" innerClassName="justify-center gap-[3vh]">
      <div className="flex items-baseline justify-between gap-4 px-5 md:px-10">
        <p className="type-label" style={{ color: CONTROL_VIOLET }}>
          {EVENTS.name}
        </p>
        <p className="type-label shrink-0" style={{ color: alpha(INK, 35) }}>
          {META.index}
        </p>
      </div>

      <div className="flex flex-col gap-3 px-5 md:px-10">
        <p className="type-label" style={{ color: alpha(INK, 40) }}>
          {UI.kicker}
        </p>
        <h2 id={labelId} className="type-huge max-w-[18ch] uppercase">
          {UI.title}
        </h2>
      </div>

      {/*
        FILA DE CARTAS.

        `overflow-x-auto` + `snap-x` en TODOS los tamaños, y en `lg` las cuatro
        entran de largo y el scroll no llega a existir: 4 × 13rem + 3 huecos de
        24px + 80px de medianiles = 984px, y `lg` empieza en 1024. Los 40px de
        margen son el hueco de una barra de scroll vertical, que si no existiera
        dejaría el `lg:justify-center` centrando contenido desbordado — y ahí el
        principio de la fila se vuelve INALCANZABLE. O sea: una sola
        implementación, sin ramas, que en escritorio es una fila y en móvil es un
        carrusel nativo. El scroll nativo con snap le gana a cualquier carrusel
        propio en táctil — tiene el fling del sistema, respeta la accesibilidad y
        no hay que mantenerlo.

        El `py-8` es funcional: la carta se INCLINA y crece un 3.5% al pasar el
        puntero, y sin ese aire el `overflow` del scroller le recortaría el borde
        de arriba y el halo de abajo.

        `overscroll-x-contain`: al llegar al final de la fila el gesto NO se
        propaga al documento. Sin esto, en trackpad, terminar el carrusel dispara
        el "atrás" del navegador en algunos sistemas.
      */}
      <ul
        ref={rowRef}
        aria-label={UI.groupLabel}
        className="flex list-none snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-5 py-8 md:gap-6 md:px-10 lg:justify-center"
      >
        {ITEMS.map((artist, i) => {
          const accent = ACCENT[artist.accent]
          const art = ART[i]
          return (
            <li key={artist.id} className="shrink-0 snap-center">
              <button
                type="button"
                ref={bindCard(i)}
                data-cursor="cta"
                data-cursor-label={UI.cardCta}
                aria-haspopup="dialog"
                aria-label={`${UI.open} ${artist.name}`}
                onClick={(e) => openCard(e, artist.id)}
                onPointerEnter={onEnter(i)}
                onPointerMove={onMove(i)}
                onPointerLeave={onLeave(i)}
                onFocus={onFocusCard(i)}
                onBlur={onLeave(i)}
                // `gpu`: cada carta anima su propio `transform`, así que cada una
                // quiere su capa de composición.
                //
                // El ancho crece por breakpoints en `vw` hasta un tope en `rem`:
                // a 375px la carta ocupa 68vw (255px, se ve la siguiente asomando
                // y se entiende que hay más) y en escritorio se congela para que
                // las cuatro quepan en fila.
                // `max-h-[54svh]` es un SEGURO, no una medida de diseño: en
                // vertical no llega a activarse en ningún móvil real (a 68vw la
                // carta pide 0.95× el ancho de alto, y 54svh siempre da más),
                // pero en un móvil apaisado —donde el alto se desploma— recorta
                // la proporción en vez de dejar que la carta desborde el
                // capítulo, que es `overflow-hidden` y la cortaría en seco.
                className="group gpu relative block aspect-[5/7] max-h-[54svh] w-[68vw] max-w-[16rem] overflow-hidden text-left outline-offset-4 sm:w-[14rem] lg:w-[13rem] xl:w-[16rem]"
                style={{
                  // OPACA. El Núcleo 3D vive detrás de todo el DOM: con fondo
                  // translúcido las partículas se leen A TRAVÉS de la carta y no
                  // hay separación entre figura y fondo.
                  backgroundColor: CONTROL_BG,
                  // Marco metálico: doble filo del acento sin una sola sombra
                  // desenfocada, que es lo caro. El `inset` de dentro simula el
                  // bisel del plastificado.
                  border: `1px solid ${alpha(accent, 46)}`,
                  boxShadow: `inset 0 0 0 1px ${alpha(INK, 8)}, 0 14px 34px -20px ${alpha(accent, 60)}`,
                }}
              >
                <Artwork art={art} holoOpacity={HOLO_BASE} />

                {/* Velo inferior: es lo que sostiene el nombre sobre el arte.
                    Sólido en la base, así que no deja pasar nada de detrás. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `linear-gradient(0deg, ${CONTROL_BG} 0%, ${alpha(CONTROL_BG, 46)} 32%, transparent 60%)`,
                  }}
                />

                {/* Número de carta, arriba. Lenguaje de cromo: la posición en la
                    colección va antes que el nombre. */}
                <span
                  aria-hidden="true"
                  className="type-label absolute left-4 top-4"
                  style={{ color: alpha(INK, 74) }}
                >
                  {`${pad(i + 1)} / ${pad(ITEMS.length)}`}
                </span>

                {/* Franja de datos, abajo. `role` sale solo el día que exista. */}
                <span className="absolute inset-x-0 bottom-0 block px-4 pb-4">
                  <span
                    aria-hidden="true"
                    className="mb-2 block h-px w-10"
                    style={{ backgroundColor: alpha(accent, 80) }}
                  />
                  <span className="block text-2xl font-semibold uppercase leading-none">
                    {artist.name}
                  </span>
                  {artist.role !== undefined && (
                    <span
                      className="type-label mt-2 block truncate"
                      style={{ color: alpha(INK, 48) }}
                    >
                      {artist.role}
                    </span>
                  )}
                </span>

                {/* Realce del marco al pasar el puntero o al enfocar. Sólo
                    `opacity`, que es compositable: el borde de abajo no cambia. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${alpha(accent, 90)}`,
                    transitionTimingFunction: EASE_OUT_EXPO,
                  }}
                />
              </button>
            </li>
          )
        })}
      </ul>

      <p className="type-label px-5 md:px-10" style={{ color: alpha(INK, 26) }}>
        {UI.hint}
      </p>

      {openIndex >= 0 && (
        <ArtistDialog artist={ITEMS[openIndex]} index={openIndex} onClose={closeCard} />
      )}
    </ChapterSection>
  )
}
