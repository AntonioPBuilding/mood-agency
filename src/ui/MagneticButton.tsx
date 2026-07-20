import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { getQuality } from '@/core/quality'
import { scroll } from '@/core/scrollStore'

/**
 * BOTÓN MAGNÉTICO.
 *
 * El imán tiene que empezar a actuar ANTES de que el puntero esté encima; si
 * no, no es un imán, es un `:hover`. Eso obliga a escuchar el puntero en toda
 * la ventana y no en el propio elemento.
 *
 * El label se desplaza más que la caja: ese desfase es lo que da sensación de
 * profundidad (parallax de dos capas). Es el detalle que separa un botón
 * magnético bueno de uno que sólo se mueve.
 *
 * ── POR QUÉ HAY UN REGISTRO DE MÓDULO Y NO UN LISTENER POR BOTÓN ─────────────
 *
 * La versión anterior registraba un `pointermove` en `window` POR INSTANCIA y
 * llamaba a `getBoundingClientRect()` dentro del handler. Con cuatro botones
 * montados a la vez eso son cuatro layouts forzados por cada evento de puntero
 * —y un ratón de 1000Hz dispara muchos más eventos que frames— aunque los
 * botones estén a diez viewports de distancia y el usuario no vaya a verlos
 * nunca. Es el patrón que convierte una landing en un tostador.
 *
 * Ahora:
 *
 * 1. UN listener compartido para todas las instancias. Sólo anota coordenadas.
 * 2. El trabajo se hace en el `gsap.ticker`: como mucho una vez por frame, no
 *    una vez por evento.
 * 3. El rect se mide UNA vez y se cachea en coordenadas de DOCUMENTO. Sigue al
 *    scroll restando `scrollY`, sin volver a medir. Se re-mide sólo en resize.
 * 4. Un `IntersectionObserver` apaga por completo los botones fuera de
 *    pantalla: ni se miden, ni se calculan, ni existen.
 */

interface MagneticButtonProps {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  /** Fuerza del imán en px. Default 24. */
  strength?: number
  variant?: 'solid' | 'ghost' | 'neon'
  className?: string
}

/**
 * Clases COMPLETAS por variante, nunca construidas por interpolación: el
 * escáner de Tailwind lee el fuente como texto plano y una clase compuesta en
 * runtime no se genera nunca (y el botón sale invisible en producción).
 */
const VARIANTS: Record<'solid' | 'ghost' | 'neon', string> = {
  solid: 'bg-[var(--world-accent)] text-[var(--world-bg)] border border-transparent',
  // El borde usa el token `bone` y no `--world-ink` porque la tinta de los tres
  // mundos es prácticamente el mismo blanco: el modificador de opacidad sobre un
  // token del tema es determinista, sobre un `var()` arbitrario no siempre.
  ghost: 'bg-transparent text-[var(--world-ink)] border border-bone/30 hover:border-bone/70',
  neon: 'bg-transparent text-control-violet border border-control-violet shadow-[0_0_28px_-6px_var(--color-control-violet)] hover:shadow-[0_0_46px_-4px_var(--color-control-violet)]',
}

/* ══════════════════════════  EL CAMPO MAGNÉTICO  ═══════════════════════════
 *
 * Registro único de módulo. Existe mientras haya al menos un botón montado.
 */

interface Magnet {
  el: HTMLElement
  label: HTMLElement
  strength: number
  xTo: gsap.QuickToFunc
  yTo: gsap.QuickToFunc
  lxTo: gsap.QuickToFunc
  lyTo: gsap.QuickToFunc
  /** Centro en coordenadas de DOCUMENTO (inmune al scroll). */
  cx: number
  cy: number
  radius: number
  /** ¿Hay que volver a medir? (arranque, resize, reaparición) */
  stale: boolean
  /** ¿Está en pantalla? Si no, no se calcula nada. */
  visible: boolean
  inside: boolean
}

const magnets = new Set<Magnet>()

let pointerX = 0
let pointerY = 0
let pointerSeen = false
let observer: IntersectionObserver | null = null
const byElement = new WeakMap<Element, Magnet>()

function onPointerMove(e: PointerEvent) {
  pointerX = e.clientX
  pointerY = e.clientY
  pointerSeen = true
}

function onResize() {
  // El layout cambió: todos los centros cacheados son mentira.
  for (const m of magnets) m.stale = true
}

/**
 * Mide el centro EN REPOSO, en coordenadas de documento.
 *
 * El botón puede estar desplazado por su propio tween en el momento de medir,
 * así que se le resta el desplazamiento actual. Sin esto el centro derivaría:
 * el imán tira, el centro se mueve con él, y el imán vuelve a tirar desde el
 * centro nuevo — una realimentación que arrastra el botón fuera de sitio.
 */
/** GSAP devuelve el transform como número o como `"24px"`, según la propiedad. */
function offsetOf(el: HTMLElement, axis: 'x' | 'y'): number {
  const raw = parseFloat(String(gsap.getProperty(el, axis)))
  return Number.isFinite(raw) ? raw : 0
}

function measure(m: Magnet, scrollY: number) {
  const r = m.el.getBoundingClientRect()
  const ox = offsetOf(m.el, 'x')
  const oy = offsetOf(m.el, 'y')

  m.cx = r.left + r.width / 2 - ox
  m.cy = r.top + r.height / 2 - oy + scrollY
  m.radius = Math.max(r.width, r.height) / 2 + 110
  m.stale = false
}

function release(m: Magnet) {
  m.inside = false
  // Vuelta elástica: el imán se suelta, no se apaga.
  gsap.to(m.el, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.32)' })
  gsap.to(m.label, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1, 0.28)' })
}

/**
 * Frames de quietud tras los que se dan por buenos los centros cacheados.
 *
 * Restar `scrollY` sigue al scroll perfectamente, pero NO a las animaciones de
 * ScrollTrigger: en `plans` los paneles entran con `yPercent: 14 → 0` atados al
 * scrub, así que mientras el usuario baja, el botón se mueve DENTRO del
 * documento y el centro medido queda obsoleto. En vez de medir por frame
 * (que es justo lo que veníamos a eliminar), se re-mide una sola vez cuando el
 * scroll se para, que es cuando el imán importa.
 */
const IDLE_FRAMES = 6

let lastProgress = -1
let idleFrames = 0

function tick() {
  // Detección de "scroll parado". Va antes del early return por puntero: si no,
  // un botón que entra en pantalla sin mover el ratón nunca se re-mediría.
  const p = scroll.progress
  if (p !== lastProgress) {
    lastProgress = p
    idleFrames = 0
  } else if (idleFrames <= IDLE_FRAMES) {
    idleFrames++
    if (idleFrames === IDLE_FRAMES) {
      for (const m of magnets) if (m.visible) m.stale = true
    }
  }

  if (!pointerSeen || document.hidden) return

  // Una sola lectura de scroll para TODOS los imanes, en vez de un
  // getBoundingClientRect por imán y por evento.
  let scrollY = -1

  for (const m of magnets) {
    if (!m.visible) {
      if (m.inside) release(m)
      continue
    }

    if (scrollY < 0) scrollY = window.scrollY
    if (m.stale) measure(m, scrollY)

    const dx = pointerX - m.cx
    const dy = pointerY - (m.cy - scrollY)

    if (Math.hypot(dx, dy) > m.radius) {
      if (m.inside) release(m)
      continue
    }

    m.inside = true
    // Máximo tirón a media distancia y cero justo en el centro: así se siente
    // un campo magnético y no un `translate` proporcional.
    const k = (m.strength * 2) / m.radius
    const ox = Math.max(-m.strength, Math.min(m.strength, dx * k))
    const oy = Math.max(-m.strength, Math.min(m.strength, dy * k))

    m.xTo(ox)
    m.yTo(oy)
    m.lxTo(ox * 0.55)
    m.lyTo(oy * 0.55)
  }
}

function register(m: Magnet) {
  if (magnets.size === 0) {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    gsap.ticker.add(tick)
    // `rootMargin` generoso: el imán tiene que estar medido y listo ANTES de
    // entrar en pantalla, no medirse en el frame en que aparece.
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = byElement.get(entry.target)
          if (!target) continue
          target.visible = entry.isIntersecting
          // Al reaparecer puede haber cambiado de sitio (ScrollTrigger recoloca
          // secciones enteras al recargar fuentes): se vuelve a medir.
          if (entry.isIntersecting) target.stale = true
        }
      },
      { rootMargin: '200px' },
    )
  }

  magnets.add(m)
  byElement.set(m.el, m)
  observer?.observe(m.el)
}

function unregister(m: Magnet) {
  magnets.delete(m)
  byElement.delete(m.el)
  observer?.unobserve(m.el)

  if (magnets.size === 0) {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('resize', onResize)
    gsap.ticker.remove(tick)
    observer?.disconnect()
    observer = null
    pointerSeen = false
  }
}

/* ═══════════════════════════════  COMPONENTE  ══════════════════════════════ */

export function MagneticButton({
  children,
  onClick,
  href,
  strength = 24,
  variant = 'solid',
  className = '',
}: MagneticButtonProps): React.JSX.Element {
  const rootRef = useRef<HTMLElement | null>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const rippleLayerRef = useRef<HTMLSpanElement>(null)

  // Ref por callback: el mismo ref sirve para `<a>` y para `<button>` sin
  // castear a `never`, porque los parámetros de función son contravariantes.
  const setRoot = (node: HTMLElement | null) => {
    rootRef.current = node
  }

  useEffect(() => {
    const el = rootRef.current
    const label = labelRef.current
    if (!el || !label) return
    // Sin movimiento pedido: el botón sigue siendo un botón, deja de ser un imán.
    if (getQuality().reduced) return

    const magnet: Magnet = {
      el,
      label,
      strength,
      xTo: gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' }),
      yTo: gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' }),
      lxTo: gsap.quickTo(label, 'x', { duration: 0.6, ease: 'power3.out' }),
      lyTo: gsap.quickTo(label, 'y', { duration: 0.6, ease: 'power3.out' }),
      cx: 0,
      cy: 0,
      radius: 0,
      stale: true,
      visible: false,
      inside: false,
    }

    register(magnet)

    return () => {
      unregister(magnet)
      gsap.killTweensOf([el, label])
      gsap.set([el, label], { x: 0, y: 0 })
    }
  }, [strength])

  const spawnRipple = (e: React.PointerEvent<HTMLElement>) => {
    const layer = rippleLayerRef.current
    const el = rootRef.current
    if (!layer || !el || getQuality().reduced) return

    const r = el.getBoundingClientRect()
    const size = Math.max(r.width, r.height) * 2.4

    // Nodo creado a mano dentro de una capa que React deja SIEMPRE vacía:
    // así no compite con la reconciliación por los mismos hijos.
    const ripple = document.createElement('span')
    ripple.style.cssText = `position:absolute;border-radius:9999px;background:currentColor;pointer-events:none;width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px;`
    layer.appendChild(ripple)

    gsap.fromTo(
      ripple,
      { scale: 0, opacity: 0.35 },
      {
        scale: 1,
        opacity: 0,
        duration: 0.75,
        ease: 'power2.out',
        onComplete: () => ripple.remove(),
      },
    )
  }

  const shared = {
    ref: setRoot,
    onPointerDown: spawnRipple,
    'data-cursor': variant === 'neon' ? 'cta' : 'hover',
    className: [
      'relative inline-flex items-center justify-center overflow-hidden isolate',
      'rounded-full px-8 py-4 select-none',
      'type-label transition-[border-color,box-shadow,background-color] duration-300 ease-[var(--ease-out-expo)]',
      VARIANTS[variant],
      className,
    ].join(' '),
  }

  const inner = (
    <>
      <span ref={labelRef} className="relative z-10 inline-block will-change-transform">
        {children}
      </span>
      <span
        ref={rippleLayerRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-full"
      />
    </>
  )

  // Un enlace es un enlace y un botón es un botón: nada de `div` con onClick.
  return href ? (
    <a {...shared} href={href} onClick={onClick}>
      {inner}
    </a>
  ) : (
    <button {...shared} type="button" onClick={onClick}>
      {inner}
    </button>
  )
}
