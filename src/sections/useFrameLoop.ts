import { useEffect, useRef } from 'react'
import { gsap } from './_gsap'

/**
 * Callback por frame, en el ticker de GSAP.
 *
 * NO abre un `requestAnimationFrame` propio a propósito: el ticker de GSAP es el
 * mismo loop que conduce a Lenis y que actualiza ScrollTrigger. Un rAF paralelo
 * lee `scroll.progress` medio frame tarde y ese medio frame se VE como un
 * desfase entre el DOM y el Núcleo.
 *
 * Es la única vía permitida para animaciones que leen `scroll` directamente:
 * meter el progreso en `useState` sería un re-render por frame.
 */
export function useFrameLoop(
  cb: (time: number, deltaMs: number) => void,
  enabled = true,
): void {
  const cbRef = useRef(cb)

  // Se sincroniza tras el render: así el ticker siempre ve el último closure
  // sin necesidad de resuscribirse (y sin mutar una ref durante el render).
  useEffect(() => {
    cbRef.current = cb
  })

  useEffect(() => {
    if (!enabled) return
    const tick = (time: number, deltaMs: number) => cbRef.current(time, deltaMs)
    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
    }
  }, [enabled])
}
