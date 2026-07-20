import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { getQuality } from '@/core/quality'
import { PRELOADER_COPY } from './uiCopy'

/**
 * PRELOADER.
 *
 * No es una barra de progreso: es el primer acto de la narrativa. El usuario
 * tiene que salir de acá con la sensación de que va a entrar en algo.
 *
 * El contador NO sube lineal. Una carga que sube a velocidad constante se lee
 * como falsa; una que duda y se atasca se lee como real. Los tramos y las
 * pausas están puestos a mano por eso.
 *
 * Ningún estado de React: el contador se escribe con `textContent` desde el
 * onUpdate de GSAP. Cien re-renders para pintar tres dígitos no tienen sentido.
 */

interface PreloaderProps {
  onComplete: () => void
}

/** Alturas de las líneas que barren la pantalla, en % del viewport. */
const SWEEPS = [16, 37, 63, 84] as const

export function Preloader({ onComplete }: PreloaderProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const enterRef = useRef<HTMLDivElement>(null)

  // El callback puede cambiar de identidad en cada render de App; el timeline
  // se construye una sola vez y lee siempre la versión actual.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  })

  // Mientras el preloader esté montado el documento no se mueve. Se restaura al
  // desmontar, incluso si el timeline se interrumpe a mitad.
  useEffect(() => {
    const html = document.documentElement
    const prevHtml = html.style.overflow
    const prevBody = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    // Recarga a media página: la narrativa arranca en el capítulo 1 o no arranca.
    window.scrollTo(0, 0)

    return () => {
      html.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    const counter = counterRef.current
    const enter = enterRef.current
    if (!root || !counter || !enter) return

    const reduced = getQuality().reduced
    // Reduced motion no salta el preloader: lo cuenta más rápido. La historia
    // es la misma, el viaje es más corto.
    const s = reduced ? 0.35 : 1

    const ctx = gsap.context(() => {
      const letters = root.querySelectorAll<HTMLElement>('[data-letter]')
      const lines = root.querySelectorAll<HTMLElement>('[data-sweep]')

      const proxy = { v: 0 }
      const write = () => {
        counter.textContent = Math.round(proxy.v).toString().padStart(3, '0')
      }

      gsap.set(root, { clipPath: 'inset(0% 0% 0% 0%)' })
      gsap.set(letters, { yPercent: 110, opacity: 0 })
      gsap.set(lines, { scaleX: 0, transformOrigin: 'left center' })
      gsap.set(enter, { opacity: 0, y: 14 })
      write()

      // Barrido continuo, independiente del contador: da la sensación de que
      // hay una máquina trabajando detrás.
      if (!reduced) {
        gsap
          .timeline({ repeat: -1 })
          .to(lines, { scaleX: 1, duration: 0.65, stagger: 0.09, ease: 'power3.inOut' })
          .set(lines, { transformOrigin: 'right center' })
          .to(lines, { scaleX: 0, duration: 0.65, stagger: 0.09, ease: 'power3.inOut' })
          .set(lines, { transformOrigin: 'left center' })
      }

      const letterIn = { yPercent: 0, opacity: 1, duration: 0.75 * s, ease: 'expo.out' }

      const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } })

      tl.to(proxy, { v: 34, duration: 0.9 * s, onUpdate: write })
        .to(letters[0], letterIn, '<0.05')
        // El atasco: 0.3s sin avanzar. Es lo que hace creíble al resto.
        .to(proxy, { v: 41, duration: 0.5 * s, onUpdate: write })
        .to(proxy, { v: 68, duration: 0.7 * s, onUpdate: write })
        .to(letters[1], letterIn, '<0.05')
        .to(proxy, { v: 74, duration: 0.45 * s, onUpdate: write })
        .to(letters[2], letterIn, '<0.05')
        .to(proxy, { v: 93, duration: 0.6 * s, onUpdate: write })
        .to(letters[3], letterIn, '<0.05')
        .to(proxy, { v: 100, duration: 0.55 * s, onUpdate: write, ease: 'power3.out' })
        .to(enter, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' })
        .to(counter, { opacity: 0.25, duration: 0.5 }, '<')
        // El beat. Sin esta pausa el "ENTER THE MOOD" no se llega a leer.
        .to({}, { duration: reduced ? 0.25 : 0.8 })
        // La cortina: la pantalla se recoge hacia arriba y deja ver el Núcleo.
        .to(root, {
          clipPath: 'inset(0% 0% 100% 0%)',
          duration: reduced ? 0.4 : 1,
          ease: 'expo.inOut',
          onComplete: () => onCompleteRef.current(),
        })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      aria-label={PRELOADER_COPY.loading}
      className="fixed inset-0 z-[200] overflow-hidden bg-void"
    >
      <div className="absolute inset-0" aria-hidden="true">
        {SWEEPS.map((top) => (
          <span
            key={top}
            data-sweep
            className="absolute left-0 block w-full bg-bone"
            style={{ top: `${top}%`, height: 1, opacity: 0.16 }}
          />
        ))}
      </div>

      {/* El wordmark se ensambla letra a letra al ritmo del contador. */}
      <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
        <div className="type-giga flex text-bone">
          {Array.from(PRELOADER_COPY.wordmark).map((ch, i) => (
            <span
              key={i}
              className="mask-line"
              style={{ paddingBottom: '0.1em', marginBottom: '-0.1em' }}
            >
              <span data-letter className="inline-block">
                {ch}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="absolute right-0 bottom-0 p-5 md:p-10" aria-hidden="true">
        <span ref={counterRef} className="type-mega block text-bone tabular-nums">
          000
        </span>
      </div>

      <div
        ref={enterRef}
        aria-hidden="true"
        className="type-label absolute bottom-0 left-0 p-5 text-bone md:p-10"
      >
        {PRELOADER_COPY.enter}
      </div>
    </div>
  )
}
