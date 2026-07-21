import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react'
import { EVENTS } from '@/content'
import { setOverlay } from '@/core/overlayStore'
import { getQuality } from '@/core/quality'
import { subscribeChapter } from '@/core/scrollStore'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
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
 * ── LA FOTO Y EL ARTE GENERATIVO CONVIVEN ───────────────────────────────────
 *
 * El "retrato" se GENERA: un hash del nombre siembra un PRNG y de ahí salen
 * ángulos, centros y paradas de color. Determinista de verdad — mismo nombre,
 * misma carta, en todos los navegadores y en todos los despliegues.
 *
 * Encima de ese arte va la FOTO del artista, cuando existe. Y "cuando existe" es
 * literal: hoy `public/artists/*` está VACÍO. La foto no se trata como un
 * requisito sino como una MEJORA — si el `<img>` falla, se retira y abajo ya
 * está el arte generativo, que nunca dejó de pintarse. Cero iconos rotos, cero
 * huecos, cero `alt` colgando en medio de la carta. La landing es publicable hoy
 * y mejora sola el día que el cliente suba los cuatro JPG.
 *
 * Las cuatro fotos vienen con encuadres MUY distintos (dos verticales, una casi
 * cuadrada y una de grupo horizontal). Para que se lean como una COLECCIÓN y no
 * como cuatro recortes sueltos, se imponen tres cosas: una proporción única
 * (`PHOTO_RATIO`), `object-fit: cover` y un `object-position` alto —las caras
 * están arriba en las cuatro, y centrar verticalmente decapitaría a la banda—.
 * La proporción vive en el CONTENEDOR, así que el layout está fijado antes de
 * que la imagen empiece a descargarse: no hay salto posible.
 *
 * El color se unifica con CAPAS DE MEZCLA ESTÁTICAS, nunca con `filter` por
 * frame. Las fotos son casi monocromas, así que un `mix-blend-mode: color` con
 * un degradado de dos neones les impone el tono de Mood Agency conservando su
 * luminancia: duotono real, coste de composición, cero JS. La holografía y el
 * barrido van POR ENCIMA de la foto — es exactamente eso lo que hace que se lea
 * como un cromo plastificado y no como una foto con marco.
 *
 * ── EL SOBRE ────────────────────────────────────────────────────────────────
 *
 * La sección arranca CERRADA, como un sobre de cromos, y al pulsarlo las cuatro
 * cartas salen escalonadas. Tres decisiones que no son negociables:
 *
 * 1. La apertura NO se ata al scroll. Es una acción del usuario. El respaldo por
 *    si nadie pulsa es un `IntersectionObserver` con retardo, NO un ScrollTrigger:
 *    en este proyecto los triggers se miden con el preloader puesto y quedan
 *    obsoletos (está documentado en `App.tsx`), y encima esto no es coreografía
 *    de timeline sino un "llevo dos segundos mirándolo y no ha pasado nada".
 *
 * 2. Las CARTAS NUNCA SE DESMONTAN. El sobre es una capa por encima, no un
 *    interruptor de contenido. Quien navega con teclado tabula a la primera carta
 *    aunque jamás dispare la animación: el foco entrando en la fila abre el sobre
 *    de golpe, sin animación. La información no puede vivir detrás de un gesto.
 *
 * 3. Con `reduced` no hay sobre. Las cuatro cartas están puestas desde el primer
 *    frame. Una animación no puede ser el peaje para leer un roster.
 *
 * El sobre arranca CERRADO en cada carga de la página, y hay un botón discreto
 * para repetirlo: la gente quiere verlo dos veces, y negárselo es peor que
 * ofrecerlo.
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

/**
 * Foto lista para pintar, o nada. El `alt` se COMPONE con copy de `content.ts`:
 * describir una imagen es texto de cara al usuario tanto como un titular, y no
 * se escribe a mano en un `.tsx`.
 */
function photoFor(artist: Artist): { src: string; alt: string } | undefined {
  if (artist.image === undefined) return undefined
  return { src: artist.image, alt: `${UI.photoAlt} ${artist.name}` }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Mismo easing que el CSS del proyecto, en el formato que espera `motion`. */
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * PROPORCIÓN ÚNICA DE TODAS LAS FOTOS.
 *
 * 5/6 sobre una carta de 5/7 deja la foto ocupando ~86% del alto y le cede la
 * franja de abajo al nombre. Vive en el CONTENEDOR, no en el `<img>`: así el
 * hueco está reservado antes de que empiece la descarga y da igual que la imagen
 * llegue tarde, llegue distinta o no llegue.
 */
const PHOTO_RATIO = '5 / 6'

/**
 * Encuadre vertical de la foto. Las cuatro tienen las caras en el tercio alto —
 * incluida la horizontal de grupo—, así que centrar (50%) las cortaría por el
 * cuello. 18% baja lo justo para no pegar las cabezas al borde.
 */
const PHOTO_POSITION = '50% 18%'

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
  /**
   * DUOTONO de la foto. Degradado de dos neones que se aplica en
   * `mix-blend-mode: color`: toma tono y saturación de acá y la LUMINANCIA de la
   * foto. Sobre imágenes casi monocromas es un duotono de manual, y como es una
   * capa estática el compositor lo resuelve una vez y no vuelve a tocarlo.
   */
  duotone: string
  /**
   * Realce de sombras del mismo acento, en `soft-light`. El duotono solo iguala
   * el tono pero aplana; esto le devuelve el contraste sin recurrir a `filter`.
   */
  shade: string
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
    // Los DOS colores del duotono son el acento del artista y el segundo neón que
    // ya salió de la semilla: la foto acaba teñida con la misma pareja de colores
    // que su propio arte generativo. Es lo que hace que las cuatro fotos —de
    // orígenes y encuadres distintos— se lean como una sola colección.
    duotone: `linear-gradient(158deg, ${accent} 0%, ${second} 100%)`,
    shade: `linear-gradient(196deg, ${alpha(accent, 55)} 0%, ${alpha(CONTROL_BG, 92)} 100%)`,
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

/**
 * FOTOS QUE YA SABEMOS QUE NO ESTÁN.
 *
 * La misma foto se pinta en dos sitios (la carta de la fila y la carta grande del
 * detalle). Sin esta memoria compartida, abrir el detalle volvería a pedir un
 * archivo que ya falló y volvería a montar un `<img>` roto durante un frame.
 *
 * Es un `Set` de módulo y no estado de React a propósito: describe el SERVIDOR,
 * no la vista, y sobrevive a que la carta se desmonte y se vuelva a montar.
 */
const brokenPhotos = new Set<string>()

interface CardPhotoProps {
  src: string
  alt: string
  art: CardArt
}

/**
 * LA FOTO DEL ARTISTA, tratada como carta.
 *
 * El `onError` NO es una red de seguridad defensiva: es el camino que se recorre
 * HOY, porque las carpetas de `public/artists/` están vacías. Al fallar, el
 * componente se retira ENTERO —imagen y capas de mezcla— y debajo queda el arte
 * generativo intacto. Retirar también las capas importa: un duotono en
 * `mix-blend-mode` sobre el arte generativo le aplanaría los colores, y el arte
 * ya está resuelto sin ayuda.
 *
 * `loading="lazy"` porque el capítulo `gallery` está a nueve viewports del hero:
 * descargar cuatro retratos que nadie va a mirar hasta dentro de medio minuto
 * compite con el Núcleo justo cuando más caro es. `decoding="async"` para que el
 * descodificado no bloquee el hilo principal en mitad del scroll.
 */
function CardPhoto({ src, alt, art }: CardPhotoProps): React.JSX.Element | null {
  // El estado inicial CONSULTA el `Set`: si ya se sabe que falta, este `<img>` no
  // llega a existir y no se pide el archivo por segunda vez.
  const [broken, setBroken] = useState(() => brokenPhotos.has(src))
  if (broken) return null

  return (
    <span
      className="pointer-events-none absolute inset-x-0 top-0 block overflow-hidden"
      // La proporción va acá y no en el `<img>`: el hueco queda reservado desde
      // el primer layout, antes de saber siquiera el tamaño real del archivo.
      style={{ aspectRatio: PHOTO_RATIO }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => {
          brokenPhotos.add(src)
          setBroken(true)
        }}
        className="absolute inset-0 block h-full w-full object-cover"
        style={{ objectPosition: PHOTO_POSITION }}
      />

      {/* DUOTONO. `color` toma tono+saturación de este degradado y luminancia de
          la foto: sobre imágenes casi monocromas es un duotono de verdad, y no
          cuesta ni un frame de JS. La opacidad deja pasar una pizca del original
          para que no quede plastificado de más. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 block"
        style={{ backgroundImage: art.duotone, mixBlendMode: 'color', opacity: 0.78 }}
      />

      {/* Contraste. `soft-light` hunde las sombras hacia el acento en vez de
          hacia el gris: es lo que evita que el duotono se vea lavado. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 block"
        style={{ backgroundImage: art.shade, mixBlendMode: 'soft-light', opacity: 0.9 }}
      />

      {/* Costura con el arte generativo: la foto se disuelve por abajo en el
          fondo de la carta en vez de terminar en un corte recto. Sin esto se ve
          "foto pegada sobre un fondo", que es justo lo contrario de un cromo. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 block"
        style={{
          background: `linear-gradient(0deg, ${CONTROL_BG} 0%, ${alpha(CONTROL_BG, 30)} 26%, transparent 58%)`,
        }}
      />
    </span>
  )
}

interface ArtworkProps {
  art: CardArt
  /** Opacidad base de la holografía. El loop la sube al pasar el puntero. */
  holoOpacity: number
  /** La foto, si el artista tiene una declarada. Puede fallar; está previsto. */
  photo?: { src: string; alt: string }
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
function Artwork({ art, holoOpacity, photo }: ArtworkProps): React.JSX.Element {
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

      {/* LA FOTO, si existe y si carga. Va por ENCIMA del arte generativo —que
          pasa a ser fondo y marco— y por DEBAJO de las dos láminas de abajo.
          Ese sándwich es el efecto entero: holografía y barrido cruzando la cara
          del artista es lo que se lee como cromo plastificado. Al revés sería
          una foto con un marco de colores. */}
      {photo !== undefined && <CardPhoto src={photo.src} alt={photo.alt} art={art} />}

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
            className="isolate relative mx-auto w-full max-w-[20rem] overflow-hidden"
            style={{ aspectRatio: '5 / 7', border: `1px solid ${alpha(accent, 38)}` }}
          >
            <Artwork art={art} holoOpacity={0.42} photo={photoFor(artist)} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: `linear-gradient(0deg, ${CONTROL_BG} 0%, ${alpha(CONTROL_BG, 40)} 34%, transparent 62%)`,
              }}
            />
            {/* Tipo de acto, arriba a la derecha: mismo sitio que en la carta
                pequeña, para que se reconozca como LA MISMA carta ampliada. */}
            <span
              aria-hidden="true"
              className="type-label absolute right-5 top-5 px-2 py-1"
              style={{ border: `1px solid ${alpha(accent, 60)}`, color: accent }}
            >
              {UI.kinds[artist.kind]}
            </span>
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
            <div className="flex flex-col gap-3">
              <h3 id={titleId} className="type-huge uppercase">
                {artist.name}
              </h3>
              {/* El tipo de acto SÍ se anuncia acá (la insignia de la carta es
                  decorativa y va `aria-hidden`): quien no ve la carta necesita
                  saber que Rock & Bikes es una banda y no un DJ. */}
              <p className="type-label" style={{ color: alpha(INK, 45) }}>
                {UI.kinds[artist.kind]}
              </p>
            </div>

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

/* ──────────────────────────────  EL SOBRE  ─────────────────────────────────── */

/**
 * `sealed` → el sobre tapa la fila. `opening` → corre la animación de GSAP.
 * `open` → el sobre ya no existe y mandan las cartas.
 *
 * No hay un cuarto estado "cerrándose": el botón de repetir vuelve a `sealed` de
 * golpe, porque lo que la gente quiere volver a ver es la APERTURA, no un sobre
 * rearmándose hacia atrás.
 */
type PackPhase = 'sealed' | 'opening' | 'open'

/**
 * EL SOBRE ARRANCA CERRADO EN CADA CARGA. Decisión de producto del cliente.
 *
 * Antes se recordaba en `sessionStorage` para no repetir la animación a quien
 * volvía desde otra pestaña. Se quitó a propósito: abrir el sobre ES el momento
 * de la sección, y llegar a un sobre ya abierto es llegar tarde a tu propia
 * fiesta. Recargar es barato; la primera impresión no se repite.
 *
 * El estado vive dentro del componente y muere con la página, que es justo lo
 * que se busca. No hay almacenamiento de por medio: cero permisos, cero
 * `try/catch` por políticas de cookies, cero estado que se pueda corromper.
 *
 * (Sigue existiendo el botón "abrir otra vez" para repetirla sin recargar, y
 * `reduced` sigue saltándose la animación entera.)
 */

/**
 * Retardo del respaldo automático. Dos segundos y pico: suficiente para que
 * quien QUIERE pulsarlo lo pulse él, y lo bastante corto para que quien pasa de
 * largo no se quede mirando un sobre cerrado preguntándose dónde está el roster.
 */
const AUTO_OPEN_MS = 2200

/**
 * Chispas de la apertura. Doce, repartidas en círculo y con los tres neones
 * alternados: son `<span>` de 6px que sólo mueven `transform` y `opacity`.
 * Deterministas, así que la explosión es idéntica en cada repetición.
 */
const BURST = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
    color: NEONS[i % NEONS.length],
  }
})

/** Radio máximo de la explosión, en px. */
const BURST_RADIUS = 150

/* Pieles del sobre. Cadenas constantes: se calculan una vez por módulo. */
const PACK_SKIN = `linear-gradient(152deg, ${alpha(CONTROL_VIOLET, 76)} 0%, ${alpha(CONTROL_BLUE, 32)} 46%, ${alpha(CONTROL_RED, 68)} 100%)`
const PACK_GRID = `repeating-linear-gradient(64deg, ${alpha(INK, 9)} 0 1px, transparent 1px 9px)`
const PACK_SHEEN = `linear-gradient(100deg, transparent 0%, ${alpha(INK, 48)} 50%, transparent 100%)`
/** Tira de rasgado. Es el detalle que dice "esto se abre por AQUÍ". */
const PACK_TEAR = `repeating-linear-gradient(90deg, ${alpha(INK, 46)} 0 6px, transparent 6px 12px)`
const PACK_FLASH = `radial-gradient(circle at 50% 50%, ${alpha(INK, 92)} 0%, ${alpha(CONTROL_VIOLET, 44)} 26%, transparent 62%)`

interface PackProps {
  packRef: RefObject<HTMLButtonElement | null>
  flashRef: RefObject<HTMLSpanElement | null>
  burstRef: RefObject<HTMLSpanElement | null>
  onOpen: () => void
}

/**
 * EL SOBRE CERRADO.
 *
 * Es un `<button>` de verdad —no un `div` con `onClick`—, así que Enter y Espacio
 * funcionan solos, sale en el orden de tabulación y hereda el `:focus-visible`
 * global. `aria-expanded={false}` porque describe literalmente lo que pasa: hay
 * contenido detrás de este control y ahora mismo no está desplegado.
 *
 * Mide como una carta (misma proporción, mismo tope de alto) para que al abrirse
 * las cartas parezcan salir de él y no reemplazarlo.
 *
 * ⚠ EL `transform` DEL BOTÓN ES DE GSAP. La respiración y el barrido de reposo
 * viven en spans INTERIORES con animaciones CSS: si respirara el propio botón,
 * la animación CSS y la timeline de apertura se pelearían por la misma propiedad
 * y el sobre parpadearía justo en el frame que más se mira.
 */
function Pack({ packRef, flashRef, burstRef, onOpen }: PackProps): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <button
        type="button"
        ref={packRef}
        onClick={onOpen}
        aria-label={UI.pack.label}
        aria-expanded={false}
        data-cursor="cta"
        data-cursor-label={UI.pack.cta}
        // `w-[64vw]` con tope en `rem` y el mismo `max-h-[54svh]` que las cartas:
        // en un móvil apaisado se recorta igual que ellas en vez de desbordar el
        // capítulo, que es `overflow-hidden`. A 375px mide 240×336: muy por
        // encima de los 44px de área táctil mínima.
        /* Mismo motivo que en las cartas: sin `isolate`, las tres láminas del
           sobre se mezclan contra la escena 3D en cada frame. */
        className="gpu isolate pointer-events-auto relative block aspect-[5/7] max-h-[54svh] w-[64vw] max-w-[15rem] overflow-hidden outline-offset-4"
        style={{
          backgroundColor: CONTROL_BG,
          border: `1px solid ${alpha(CONTROL_VIOLET, 62)}`,
          boxShadow: `inset 0 0 0 1px ${alpha(INK, 10)}, 0 18px 48px -22px ${alpha(CONTROL_VIOLET, 85)}`,
        }}
      >
        {/* Piel del sobre. Respira: es lo que lo delata como pulsable sin tener
            que escribir "pulsá aquí" dos veces. */}
        <span
          aria-hidden="true"
          className="pack-breathe absolute inset-0 block"
          style={{ backgroundImage: `${PACK_GRID}, ${PACK_SKIN}` }}
        />

        {/* Mismas bandas holográficas que las cartas: el sobre pertenece a la
            colección, no es un envoltorio genérico. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 block"
          style={{ backgroundImage: HOLO, mixBlendMode: 'color-dodge', opacity: 0.32 }}
        />

        {/* Brillo que recorre el foil. Traslada una lámina ya pintada; el
            degradado nunca se recalcula, igual que en las cartas. */}
        <span
          aria-hidden="true"
          className="pack-sheen pointer-events-none absolute inset-y-0 left-0 block w-1/2"
          style={{ backgroundImage: PACK_SHEEN, mixBlendMode: 'screen' }}
        />

        {/* Tira de rasgado. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[16%] block h-px"
          style={{ backgroundImage: PACK_TEAR }}
        />

        <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
          <span className="type-label" style={{ color: alpha(INK, 58) }}>
            {`${pad(ITEMS.length)} ${UI.pack.countLabel}`}
          </span>
          <span
            className="text-2xl font-semibold uppercase leading-none"
            style={{ color: INK }}
          >
            {EVENTS.name}
          </span>
          <span className="type-label" style={{ color: CONTROL_VIOLET }}>
            {UI.pack.cta}
          </span>
        </span>
      </button>

      {/* DESTELLO. Cubre toda la fila, no sólo el sobre: es lo que vende el
          "reventón" y lo que tapa el frame en el que las cartas aparecen. */}
      <span
        ref={flashRef}
        aria-hidden="true"
        className="gpu pointer-events-none absolute inset-0 block"
        style={{ backgroundImage: PACK_FLASH, mixBlendMode: 'screen', opacity: 0 }}
      />

      {/* CHISPAS. Se montan siempre que hay sobre para que la timeline las
          encuentre ya en el DOM en el mismo frame en que arranca. */}
      <span
        ref={burstRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 block size-0"
      >
        {BURST.map((p, i) => (
          <span
            key={i}
            data-burst=""
            className="gpu absolute block size-1.5 rounded-full"
            style={{ backgroundColor: p.color, opacity: 0 }}
          />
        ))}
      </span>
    </div>
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

  // ── EL SOBRE ──────────────────────────────────────────────────────────────

  const stageRef = useRef<HTMLDivElement>(null)
  const packRef = useRef<HTMLButtonElement>(null)
  const flashRef = useRef<HTMLSpanElement>(null)
  const burstRef = useRef<HTMLSpanElement>(null)
  /** Los `<li>`. GSAP anima ESTOS, nunca el `<button>` de dentro: ver abajo. */
  const wraps = useRef<(HTMLLIElement | null)[]>([])

  /**
   * Con `reduced` o con el sobre ya abierto en esta sesión, se ARRANCA abierto.
   * No es que la animación se salte: es que nunca llega a existir, y las cuatro
   * cartas están puestas desde el primer frame.
   */
  // Cerrado SIEMPRE al cargar. La única excepción sigue siendo `reduced`: ahí no
  // puede haber información escondida detrás de una animación.
  const [phase, setPhase] = useState<PackPhase>(() => (reduced ? 'open' : 'sealed'))

  /**
   * Espejo síncrono de `phase`. Los disparadores del sobre llegan desde un
   * `setTimeout`, desde un `IntersectionObserver` y desde dos manejadores de
   * evento distintos: todos tienen que poder preguntar "¿sigue cerrado?" y
   * responderse SIN esperar al siguiente render, o dos de ellos abren el mismo
   * sobre dos veces y la timeline se monta encima de sí misma.
   */
  const phaseRef = useRef<PackPhase>(phase)
  /** ¿La apertura la pidió una PERSONA? Sólo entonces se mueve el foco. */
  const focusOnOpen = useRef(false)
  /** Tras "abrir otra vez", el foco vuelve al sobre: si no, se queda en la nada. */
  const focusPackAgain = useRef(false)

  const openPack = useCallback((focusFirst: boolean, instant: boolean) => {
    if (phaseRef.current !== 'sealed') return
    const next: PackPhase = instant ? 'open' : 'opening'
    phaseRef.current = next
    focusOnOpen.current = focusFirst
    setPhase(next)
  }, [])

  const replayPack = useCallback(() => {
    phaseRef.current = 'sealed'
    focusOnOpen.current = false
    focusPackAgain.current = true
    setPhase('sealed')
  }, [])

  /**
   * ALGUIEN LLEGÓ TABULANDO.
   *
   * `onFocusCapture` en la fila: el foco entra en una carta que está a opacidad
   * 0 y hay que enseñarla YA. Se abre en modo instantáneo —sin animación— porque
   * el foco ya está viajando a su destino y esconderlo detrás de un segundo de
   * coreografía es exactamente el fallo que la animación pretendía evitar.
   * No se toca el foco: ya está donde el usuario lo mandó.
   */
  const onRowFocus = useCallback(() => {
    openPack(false, true)
  }, [openPack])

  /**
   * RESPALDO POR VIEWPORT — y por qué `IntersectionObserver` y NO ScrollTrigger.
   *
   * Esto NO es coreografía scroll-linked: no hay ningún valor que interpolar
   * contra el progreso. Es un temporizador con una condición de visibilidad
   * ("lleva dos segundos en pantalla y nadie lo ha tocado"). Un ScrollTrigger
   * además se mediría durante el preloader y quedaría obsoleto — está
   * documentado en `App.tsx`.
   *
   * El temporizador se ARMA al entrar y se CANCELA al salir: quien pasa de largo
   * a toda velocidad no deja un sobre abriéndose solo tres capítulos más abajo.
   * `docVisible` está en las dependencias para que el efecto se rearme y limpie
   * el timer si la pestaña se va a segundo plano a mitad de cuenta.
   */
  useEffect(() => {
    if (reduced || phase !== 'sealed' || !docVisible) return
    const stage = stageRef.current
    if (stage === null) return

    let timer: number | undefined
    const clear = () => {
      if (timer === undefined) return
      window.clearTimeout(timer)
      timer = undefined
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (timer !== undefined) continue
            timer = window.setTimeout(() => {
              timer = undefined
              // `false`: apertura NO pedida por nadie. Mover el foco acá sería
              // arrancárselo al usuario en mitad de un scroll.
              openPack(false, false)
            }, AUTO_OPEN_MS)
          } else {
            clear()
          }
        }
      },
      { threshold: 0.5 },
    )
    io.observe(stage)

    return () => {
      io.disconnect()
      clear()
    }
  }, [reduced, phase, docVisible, openPack])

  /**
   * LA APERTURA.
   *
   * `useLayoutEffect` y no `useEffect`, y es la diferencia entre que se vea bien
   * o que parpadee: al pasar a `opening` React ya ha escrito `opacity: 1` en los
   * `<li>`. Un `useEffect` correría DESPUÉS del pintado, así que se vería un
   * frame con las cuatro cartas puestas justo antes de que GSAP las mande al
   * punto de partida. `useLayoutEffect` corre entre la mutación del DOM y el
   * pintado: el navegador nunca llega a dibujar ese frame.
   *
   * ⚠ SE ANIMAN LOS `<li>`, NO LOS `<button>`. El bucle por frame REESCRIBE
   * `style.transform` del botón sesenta veces por segundo; si GSAP escribiera
   * ahí, cada tween moriría en el siguiente frame. El `<li>` no lo toca nadie
   * más, así que la salida en arco y la inclinación 3D conviven sin pelearse:
   * son dos transforms anidados, que es justo lo que hace que la carta parezca
   * volar Y girar a la vez.
   *
   * Sólo `transform` y `opacity`. Nada que dispare layout.
   */
  useLayoutEffect(() => {
    if (phase !== 'opening') return

    const pack = packRef.current
    const flash = flashRef.current
    const burst = burstRef.current
    const cards = wraps.current.filter((el): el is HTMLLIElement => el !== null)

    // Si falta cualquier pieza, la sección NO se queda a medias: se abre seca.
    // Un roster invisible por un ref nulo es un fallo mucho peor que perderse
    // una animación.
    if (pack === null || flash === null || burst === null || cards.length === 0) {
      phaseRef.current = 'open'
      setPhase('open')
      return
    }

    const sparks = burst.querySelectorAll<HTMLSpanElement>('[data-burst]')
    const mid = (cards.length - 1) / 2

    const tl = gsap.timeline({
      onComplete: () => {
        phaseRef.current = 'open'
        setPhase('open')
      },
    })

    tl
      // 1. Se comprime antes de reventar. El anticipo es lo que hace que el
      //    reventón se sienta, en vez de simplemente ocurrir.
      .to(pack, { scale: 0.94, duration: 0.12, ease: 'power2.in' })
      .to(pack, { scale: 1.06, duration: 0.1, ease: 'power2.out' })
      .to(flash, { opacity: 1, duration: 0.09, ease: 'none' }, '<')
      // 2. El sobre se aparta hacia arriba girando y se va.
      .to(
        pack,
        { yPercent: -128, rotate: -9, scale: 1.14, opacity: 0, duration: 0.5, ease: 'power3.in' },
        '>-0.02',
      )
      .to(flash, { opacity: 0, duration: 0.45, ease: 'power2.out' }, '<')
      // 3. Chispas. Radiales desde el centro, con un desfase mínimo para que no
      //    salgan las doce clavadas en el mismo frame.
      .fromTo(
        sparks,
        { x: 0, y: 0, scale: 0.5, opacity: 1 },
        {
          x: (i: number) => BURST[i].x * BURST_RADIUS,
          y: (i: number) => BURST[i].y * BURST_RADIUS,
          scale: 0.2,
          opacity: 0,
          duration: 0.7,
          stagger: 0.012,
          ease: 'power2.out',
        },
        '<',
      )
      // 4. Las cartas salen ESCALONADAS. El `xPercent` y el `rotate` iniciales
      //    se reparten desde el centro de la fila: las de los extremos arrancan
      //    más abiertas y más giradas, y al converger describen un arco. Con un
      //    desplazamiento igual para las cuatro sería un simple deslizamiento.
      //    `back.out` para el rebote de aterrizaje.
      .fromTo(
        cards,
        {
          opacity: 0,
          yPercent: 34,
          scale: 0.82,
          xPercent: (i: number) => (i - mid) * 16,
          rotate: (i: number) => (i - mid) * 7,
        },
        {
          opacity: 1,
          yPercent: 0,
          scale: 1,
          xPercent: 0,
          rotate: 0,
          duration: 0.78,
          stagger: 0.09,
          ease: 'back.out(1.4)',
          // Se limpia el transform para NO dejar una matriz inline pegada en el
          // `<li>`: si se repite la animación, GSAP tiene que partir de cero.
          clearProps: 'transform',
        },
        '-=0.36',
      )

    return () => {
      tl.kill()
    }
  }, [phase])

  /** Al abrirse a petición del usuario, el foco entra en la primera carta. */
  useEffect(() => {
    if (phase !== 'open' || !focusOnOpen.current) return
    focusOnOpen.current = false
    // `preventScroll` por lo mismo que en `closeCard`: el scroll automático del
    // foco movería el documento por debajo de Lenis, que no se entera.
    nodes.current[0]?.root.focus({ preventScroll: true })
  }, [phase])

  /** Tras "abrir otra vez", el foco viaja al sobre recién montado. */
  useEffect(() => {
    if (phase !== 'sealed' || !focusPackAgain.current) return
    focusPackAgain.current = false
    packRef.current?.focus({ preventScroll: true })
  }, [phase])

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

  /** Guarda el `<li>` que GSAP anima en la apertura. */
  const bindWrap = useCallback(
    (i: number) => (el: HTMLLIElement | null) => {
      wraps.current[i] = el
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
      {/*
        ESCENARIO. Envuelve la fila para que el sobre pueda ir ENCIMA en
        `absolute` sin sacar a las cartas del flujo: la fila conserva su altura
        con el sobre puesto, así que al abrirse no hay ni un pixel de salto de
        layout. Es también el elemento que observa el `IntersectionObserver`.
      */}
      <div ref={stageRef} className="relative">
        <ul
          ref={rowRef}
          aria-label={UI.groupLabel}
          onFocusCapture={onRowFocus}
          /* `pointer-events-none` con el sobre puesto: las cartas están a
             opacidad 0 y no se puede poder pulsar lo que no se ve. NO afecta al
             teclado —el foco pasa igual—, que es justo lo que se quiere. */
          className={`flex list-none snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-5 py-8 md:gap-6 md:px-10 lg:justify-center ${
            phase === 'sealed' ? 'pointer-events-none' : ''
          }`}
        >
          {ITEMS.map((artist, i) => {
            const accent = ACCENT[artist.accent]
            const art = ART[i]
            return (
              <li
                key={artist.id}
                ref={bindWrap(i)}
                className="shrink-0 snap-center"
                /* Valor SIEMPRE explícito (0 o 1), nunca `undefined`: React sólo
                   reescribe lo que cambia, y así el estado visual de la carta no
                   depende de en qué orden acabaron GSAP y el render. */
                style={{ opacity: phase === 'sealed' ? 0 : 1 }}
              >
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
                /* `isolate` NO es cosmético: es LA optimización de esta sección.
           Sin él, `mix-blend-mode` mezcla contra TODO lo que hay detrás —y
           detrás hay un canvas WebGL repintándose 60 veces por segundo—, así
           que el compositor no puede cachear nada y rehace la mezcla de cada
           lámina en cada frame. Con cuatro cartas son ocho láminas mezclándose
           contra la escena viva: eso es el tirón.
           `isolation: isolate` encierra la mezcla dentro de la carta, que es
           además lo que el diseño quería (dodge sobre el negro de la carta, no
           sobre las partículas). Cada carta pasa a ser una capa autónoma que el
           navegador compone una vez y reutiliza. */
        className="group gpu isolate relative block aspect-[5/7] max-h-[54svh] w-[68vw] max-w-[16rem] overflow-hidden text-left outline-offset-4 sm:w-[14rem] lg:w-[13rem] xl:w-[16rem]"
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
                <Artwork art={art} holoOpacity={HOLO_BASE} photo={photoFor(artist)} />

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

                {/* TIPO DE ACTO — la "rareza" del cromo, arriba a la derecha.
                    Y es un dato REAL, no un adorno: Rock & Bikes es una banda de
                    seis personas y presentarla como DJ sería incorrecto.
                    `aria-hidden` porque el `aria-label` del botón ya nombra la
                    carta; el dato se anuncia entero en el detalle, donde hay
                    sitio para decirlo sin atropellar el nombre. */}
                <span
                  aria-hidden="true"
                  className="type-label absolute right-4 top-4 px-2 py-1"
                  style={{ border: `1px solid ${alpha(accent, 55)}`, color: accent }}
                >
                  {UI.kinds[artist.kind]}
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

        {/* EL SOBRE, por encima de la fila. Desaparece del DOM al terminar la
            apertura: un sobre invisible con `pointer-events-none` seguiría
            siendo un `<button>` en el orden de tabulación, y tabular hacia un
            control que ya no existe visualmente es un callejón sin salida. */}
        {phase !== 'open' && (
          <Pack
            packRef={packRef}
            flashRef={flashRef}
            burstRef={burstRef}
            onOpen={() => openPack(true, false)}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 md:px-10">
        {/* La pista de uso habla de inclinar y pulsar cartas: con el sobre
            puesto todavía no hay ninguna carta a la que aplicarla. */}
        {phase !== 'sealed' && (
          <p className="type-label" style={{ color: alpha(INK, 26) }}>
            {UI.hint}
          </p>
        )}

        {/* REPETIR. Discreto y sin `reduced`: ahí no hay animación que repetir.
            `min-h-11` = 44px de área táctil, el mínimo que se respeta en todo
            el proyecto. */}
        {!reduced && phase === 'open' && (
          <button
            type="button"
            onClick={replayPack}
            data-cursor="hover"
            className="type-label inline-flex min-h-11 items-center px-4 transition-colors duration-300"
            style={{ border: `1px solid ${alpha(INK, 16)}`, color: alpha(INK, 50) }}
          >
            {UI.pack.replay}
          </button>
        )}
      </div>

      {openIndex >= 0 && (
        <ArtistDialog artist={ITEMS[openIndex]} index={openIndex} onClose={closeCard} />
      )}
    </ChapterSection>
  )
}
