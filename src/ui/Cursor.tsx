import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { WorldId } from '@/core/chapters'
import { subscribeChapter } from '@/core/scrollStore'
import { getQuality } from '@/core/quality'
import { CURSOR_COPY } from './uiCopy'

/**
 * CURSOR GLOBAL.
 *
 * El CSS pone `cursor: none` en todo el documento: si este componente falla, el
 * usuario se queda sin puntero. Por eso todo acá es defensivo y el estado de
 * React sólo cambia en eventos DISCRETOS (entrar en un elemento, cambiar de
 * mundo). La posición, la deformación y las coordenadas se escriben a mano
 * sobre el DOM dentro del ticker: un re-render por frame es exactamente lo que
 * el contrato prohíbe.
 *
 * ── POR QUÉ EL BLOB ES UN <svg> Y NO UN <div> ────────────────────────────────
 *
 * Antes el blob cambiaba de tamaño animando `width` y `height` con una
 * transición de 500ms. Eso es LAYOUT + PAINT durante medio segundo en CADA
 * hover de la página: el navegador recalcula geometría 30 veces por cada vez
 * que el puntero roza un enlace. En una landing que es toda enlaces, se nota.
 *
 * La alternativa obvia —tamaño fijo y `transform: scale()`— tiene un problema:
 * escalar un `border: 1.5px` de un círculo de 112px hasta el tamaño por defecto
 * (16px) deja un contorno de 0,21px. El cursor por defecto DESAPARECE.
 *
 * Por eso es un SVG con `vector-effect="non-scaling-stroke"`: el trazo se
 * rasteriza DESPUÉS de la matriz de transformación, así que mide 1,5px reales
 * a cualquier escala. Mismo dibujo que antes, cero layout, y todo el
 * movimiento en la capa de composición.
 *
 * El `rect` con `rx`/`ry` cubre las dos formas que necesitamos: círculo (rx =
 * ry = mitad del lado) y barra de texto (rx/ry chicos, compensando la escala
 * no uniforme). No hace falta morfear un path.
 */

type CursorMode = 'default' | 'hover' | 'drag' | 'text' | 'cta'

const MODES: ReadonlySet<string> = new Set<string>(['hover', 'drag', 'text', 'cta'])

function isMode(v: string | undefined): v is CursorMode {
  return v !== undefined && MODES.has(v)
}

/** Ancho/alto del blob por modo. `text` es una barra, no un círculo. */
const DIMS: Record<CursorMode, readonly [number, number]> = {
  default: [16, 16],
  hover: [56, 56],
  drag: [78, 78],
  text: [3, 30],
  cta: [112, 112],
}

/** Radio del contorno, en píxeles de PANTALLA (no del sistema local del SVG). */
function radiusOf(mode: CursorMode): number {
  const [w, h] = DIMS[mode]
  return mode === 'text' ? 1 : Math.min(w, h) / 2
}

/**
 * Lado del SVG sin escalar. Es el modo más grande (`cta`), así que ninguna
 * escala pasa de 1 y el trazo nunca se rasteriza por debajo de su nitidez.
 */
const BASE = 112

/** Cuánto se estira el blob a máxima velocidad. Más de esto parece un error. */
const SQUASH = 0.55
const STRETCH_SPEED = 55

/**
 * Constantes de suavizado, en unidades por SEGUNDO.
 *
 * Antes eran factores por FRAME (`x += (t - x) * 0.19`). Un lerp por frame
 * miente en cuanto el frame rate se mueve: el mismo 0.19 es una persecución
 * suave a 60fps, un latigazo a 144 y un arrastre pastoso a 30. Y ahora el frame
 * rate SE MUEVE —el presupuesto adaptativo puede bajar la calidad, el usuario
 * puede tener un monitor de 120Hz—, así que el suavizado se integra con el
 * delta real: `1 - e^(-k·dt)`.
 *
 * Los valores están calibrados para dar EXACTAMENTE los factores viejos a
 * 60fps: 1 - e^(-12.65/60) = 0.19. A cualquier otro frame rate, la misma
 * sensación en vez del mismo número.
 */
const FOLLOW_K = 12.65
const TRAIL_K = 5.66
const FADE_K = 13.4
/** Cambio de tamaño al entrar/salir de un interactivo. ≈ 500ms de recorrido. */
const SHAPE_K = 9
/** Reduced motion: seguimiento casi directo, sin vida propia. */
const REDUCED_K = 138

export function Cursor(): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const blobRef = useRef<SVGSVGElement>(null)
  const shapeRef = useRef<SVGRectElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const trailRef = useRef<HTMLDivElement>(null)
  const coordsRef = useRef<HTMLSpanElement>(null)

  const [mode, setMode] = useState<CursorMode>('default')
  const [world, setWorld] = useState<WorldId>('void')
  const [label, setLabel] = useState<string>(CURSOR_COPY.ctaLabel)
  // Un dispositivo táctil no tiene puntero que seguir: no montamos nada.
  const [coarse, setCoarse] = useState(true)

  // El loop necesita el modo, pero no puede depender de él: recrearlo en cada
  // hover perdería la posición y el estado de la animación. Va por ref.
  const modeRef = useRef<CursorMode>('default')

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const sync = () => setCoarse(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // El mundo cambia de capítulo en capítulo, no de frame en frame: esto es
  // exactamente el caso de uso de subscribeChapter.
  useEffect(() => {
    return subscribeChapter((s) => setWorld(s.world))
  }, [])

  // Modo del cursor: delegación en document, no un listener por elemento.
  useEffect(() => {
    if (coarse) return

    const onOver = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null
      const holder = target?.closest<HTMLElement>('[data-cursor]')
      const next = holder?.dataset.cursor

      if (isMode(next)) {
        setMode(next)
        if (next === 'cta') setLabel(holder?.dataset.cursorLabel || CURSOR_COPY.ctaLabel)
      } else {
        setMode('default')
      }
    }

    document.addEventListener('pointerover', onOver, { passive: true })
    return () => document.removeEventListener('pointerover', onOver)
  }, [coarse])

  // Loop de seguimiento. Un solo callback del ticker maestro para posición,
  // forma, trail, squash y coordenadas.
  useEffect(() => {
    if (coarse) return

    const root = rootRef.current
    const blob = blobRef.current
    const shape = shapeRef.current
    if (!root || !blob || !shape) return

    const reduced = getQuality().reduced

    // Todo el estado del loop en primitivas: cero objetos creados por frame.
    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight / 2
    let x = targetX
    let y = targetY
    let trailX = targetX
    let trailY = targetY
    let angle = 0
    let press = 1
    let opacity = 0
    let awake = false
    let lastCoordX = -1
    let lastCoordY = -1
    let lastTrail: HTMLDivElement | null = null

    // Forma actual, en píxeles de pantalla. Se persigue a la del modo activo.
    let curW = DIMS.default[0]
    let curH = DIMS.default[1]
    let curR = radiusOf('default')
    let lastRx = -1
    let lastRy = -1

    const followK = reduced ? REDUCED_K : FOLLOW_K
    const trailK = reduced ? REDUCED_K : TRAIL_K

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX
      targetY = e.clientY
      if (!awake) {
        // Primer movimiento: aparecemos donde está el puntero, sin viajar
        // desde el centro de la pantalla.
        awake = true
        x = targetX
        y = targetY
        trailX = targetX
        trailY = targetY
      }
    }

    const onEnter = () => {
      awake = true
    }
    const onLeave = () => {
      awake = false
    }
    const onDown = () => {
      // Con reduced motion el cursor no se deforma ni al pulsar.
      press = reduced ? 1 : 0.82
    }
    const onUp = () => {
      press = 1
    }

    const tick = (_time: number, deltaMs: number) => {
      // Sin pestaña visible no hay puntero que seguir. Al volver, el primer
      // tick recoloca todo: el estado vive en las variables, no en el DOM.
      if (document.hidden) return

      // Techo al delta: si el navegador estuvo parado 2 segundos, no queremos
      // un salto de 2 segundos de interpolación en un solo frame.
      const dt = Math.min(deltaMs, 100) / 1000

      // El trail se monta y desmonta al cambiar de mundo: hay que releer el
      // nodo cada frame, no capturarlo una vez fuera del loop.
      const trail = trailRef.current

      const follow = 1 - Math.exp(-followK * dt)
      x += (targetX - x) * follow
      y += (targetY - y) * follow

      const dx = targetX - x
      const dy = targetY - y

      root.style.transform = `translate3d(${x}px, ${y}px, 0)`

      /* ── Forma ────────────────────────────────────────────────────────────
         El tamaño se persigue en JS, no con una transición CSS. Si fuera CSS,
         cada escritura de `transform` de este mismo loop (el squash) reiniciaría
         la transición y el cursor nunca terminaría de crecer. */
      const shapeMode = modeRef.current
      const [tw, th] = DIMS[shapeMode]
      const tr = radiusOf(shapeMode)
      const grow = 1 - Math.exp(-SHAPE_K * dt)
      curW += (tw - curW) * grow
      curH += (th - curH) * grow
      curR += (tr - curR) * grow

      const sx = curW / BASE
      const sy = curH / BASE

      // Squash & stretch: se estira en la dirección del movimiento y adelgaza
      // en la perpendicular, conservando el "volumen". Es el truco de animación
      // clásico; sin él el cursor parece un div, no una masa.
      let stretchX = press
      let stretchY = press
      if (!reduced) {
        const speed = Math.hypot(dx, dy)
        const s = Math.min(speed / STRETCH_SPEED, 1)
        // Por debajo del umbral el ángulo salta con el ruido del puntero.
        if (speed > 0.6) angle = (Math.atan2(dy, dx) * 180) / Math.PI
        stretchX = (1 + s * SQUASH) * press
        stretchY = (1 - s * SQUASH * 0.7) * press
      }

      blob.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(${sx * stretchX}, ${sy * stretchY})`

      /* El radio del contorno vive en el sistema LOCAL del SVG, que la escala
         deforma. Para que en pantalla se vea el radio pedido hay que dividir
         por la escala de cada eje: así el modo `text` sale como una barra de
         esquinas de 1px y no como una lenteja. */
      const rx = Math.min(BASE / 2, (curR * BASE) / Math.max(curW, 0.001))
      const ry = Math.min(BASE / 2, (curR * BASE) / Math.max(curH, 0.001))
      // Cuantizado: mientras la forma está quieta (el 99% del tiempo) no se
      // toca ni un atributo.
      if (Math.abs(rx - lastRx) > 0.05 || Math.abs(ry - lastRy) > 0.05) {
        lastRx = rx
        lastRy = ry
        shape.setAttribute('rx', rx.toFixed(2))
        shape.setAttribute('ry', ry.toFixed(2))
      }

      // La etiqueta acompaña al giro y a la pulsación, pero NO al squash: un
      // texto estirado se lee como un error de renderizado, no como energía.
      const labelEl = labelRef.current
      if (labelEl) {
        labelEl.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(${press})`
      }

      const wanted = awake ? 1 : 0
      const fading = opacity !== wanted
      if (fading) {
        opacity += (wanted - opacity) * (1 - Math.exp(-FADE_K * dt))
        if (Math.abs(wanted - opacity) < 0.01) opacity = wanted
        root.style.opacity = `${opacity}`
      }

      if (trail) {
        const tf = 1 - Math.exp(-trailK * dt)
        trailX += (targetX - trailX) * tf
        trailY += (targetY - trailY) * tf
        trail.style.transform = `translate3d(${trailX}px, ${trailY}px, 0)`
        // Si el trail acaba de montarse arranca en opacity 0: hay que darle el
        // valor actual aunque el fade ya haya terminado.
        if (fading || trail !== lastTrail) trail.style.opacity = `${opacity}`
      }
      lastTrail = trail

      // Coordenadas de Mood Net: sólo tocamos el DOM cuando el entero cambia.
      const coords = coordsRef.current
      if (coords) {
        const cx = Math.round(targetX)
        const cy = Math.round(targetY)
        if (cx !== lastCoordX || cy !== lastCoordY) {
          lastCoordX = cx
          lastCoordY = cy
          coords.textContent = `${cx.toString().padStart(4, '0')} ${cy.toString().padStart(4, '0')}`
        }
      }
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerenter', onEnter)
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('blur', onLeave)
    gsap.ticker.add(tick)

    return () => {
      gsap.ticker.remove(tick)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerenter', onEnter)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('blur', onLeave)
    }
  }, [coarse])

  if (coarse) return <></>

  const isText = mode === 'text'
  const filled = isText || mode === 'cta'

  return (
    <>
      {/* Trail: exclusivo de Mood Control. Va detrás y llega tarde a propósito. */}
      {world === 'control' && (
        <div
          ref={trailRef}
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 z-[299]"
          style={{ opacity: 0, willChange: 'transform' }}
        >
          <div
            className="-translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 90,
              height: 90,
              /* Antes esto era un `radial-gradient` de dos paradas con
                 `filter: blur(8px)` encima. El filtro obliga al navegador a
                 rasterizar el elemento en una superficie aparte y volver a
                 desenfocarlo, y este elemento se mueve en CADA frame.
                 Las paradas intermedias reproducen la caída del desenfoque
                 gaussiano sin pagar el filtro: mismo halo, una capa menos. */
              background:
                'radial-gradient(circle, var(--world-accent) 0%, color-mix(in srgb, var(--world-accent) 55%, transparent) 32%, color-mix(in srgb, var(--world-accent) 18%, transparent) 55%, transparent 74%)',
              opacity: 0.35,
            }}
          />
        </div>
      )}

      <div
        ref={rootRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[300]"
        style={{ opacity: 0, willChange: 'transform' }}
      >
        {/* CAPA DE HALO Y MEZCLA.
            El halo va acá y no sobre el SVG porque esta capa NO se escala: un
            `drop-shadow` sobre el SVG se encogería con él y el cursor por
            defecto tendría un halo de 3px en vez de 26.
            Y el `mix-blend-mode` va en la MISMA capa que el filtro, no en el
            SVG de dentro: un filtro aísla la mezcla de sus DESCENDIENTES, así
            que con el blend un nivel más abajo la inversión sobre tipografía
            clara dejaría de funcionar en Mood Control. Juntos, funcionan los
            dos: primero se filtra el elemento, después se mezcla con el fondo. */}
        <div
          className="absolute left-0 top-0"
          style={{
            filter:
              world === 'control' ? 'drop-shadow(0 0 26px var(--world-accent))' : 'none',
            // Sobre fondos casi negros `difference` se comporta como identidad,
            // así que el estado base conserva el color del mundo Y se invierte
            // cuando pasa por encima de tipografía clara.
            mixBlendMode: mode === 'default' ? 'difference' : 'normal',
          }}
        >
          <svg
            ref={blobRef}
            width={BASE}
            height={BASE}
            viewBox={`0 0 ${BASE} ${BASE}`}
            className="absolute left-0 top-0 overflow-visible"
            style={{ willChange: 'transform' }}
          >
            {/* `rx`/`ry` los escribe el loop, no React: son parte de la
                animación de forma. Acá van sólo los valores de arranque. */}
            <rect
              ref={shapeRef}
              x={0}
              y={0}
              width={BASE}
              height={BASE}
              rx={BASE / 2}
              ry={BASE / 2}
              fill={filled ? 'var(--world-accent)' : 'transparent'}
              stroke={isText ? 'none' : 'var(--world-accent)'}
              strokeWidth={1.5}
              // La clave de todo: el trazo se mide en píxeles de PANTALLA,
              // ignorando la matriz de transformación. 1,5px a cualquier escala.
              vectorEffect="non-scaling-stroke"
              style={{
                transition:
                  'fill 500ms var(--ease-out-expo), stroke 500ms var(--ease-out-expo)',
              }}
            />
          </svg>
        </div>

        {/* Etiqueta y glifo: capa aparte, del tamaño del blob más grande, para
            que el texto NO herede la escala del círculo. Escalar tipografía
            desde 16px hasta 112px y de vuelta la deja borrosa en el camino. */}
        {(mode === 'cta' || mode === 'drag') && (
          <div
            ref={labelRef}
            className="absolute left-0 top-0 grid place-items-center"
            style={{ width: BASE, height: BASE, transform: 'translate(-50%, -50%)' }}
          >
            {mode === 'cta' ? (
              <span
                className="type-label select-none px-2 text-center leading-none"
                style={{ color: 'var(--world-bg)' }}
              >
                {label}
              </span>
            ) : (
              <span
                className="select-none text-lg leading-none"
                style={{ color: 'var(--world-accent)' }}
              >
                {CURSOR_COPY.dragGlyph}
              </span>
            )}
          </div>
        )}

        {/* Crosshair técnico de Mood Net: líneas de 1px + lectura de posición. */}
        {world === 'net' && mode !== 'text' && (
          <>
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ width: 34, height: 1, backgroundColor: 'var(--world-accent)', opacity: 0.6 }}
            />
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ width: 1, height: 34, backgroundColor: 'var(--world-accent)', opacity: 0.6 }}
            />
            <span
              ref={coordsRef}
              className="type-label absolute whitespace-nowrap"
              style={{ left: 26, top: 14, color: 'var(--world-accent)', opacity: 0.75 }}
            />
          </>
        )}
      </div>
    </>
  )
}
