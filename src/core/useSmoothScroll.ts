/**
 * Driver de scroll: Lenis manda, GSAP obedece, R3F lee.
 *
 * Un solo rAF para todo. GSAP.ticker conduce a Lenis y Lenis notifica a
 * ScrollTrigger. Si dejás que cada librería corra su propio loop terminás con
 * el DOM y la escena 3D desfasados un frame, y ese medio frame se VE.
 */

import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { commitScroll } from './scrollStore'
import { prefersReducedMotion } from './quality'

gsap.registerPlugin(ScrollTrigger)

export function useSmoothScroll() {
  useEffect(() => {
    const reduced = prefersReducedMotion()

    const lenis = new Lenis({
      // 0.9, no 1.15. Una rampa larga suena "cinematográfica" sobre el papel,
      // pero en la mano se siente como que la página no te responde: movés la
      // rueda y no pasa nada durante medio segundo. El peso tiene que estar en
      // la inercia, no en la latencia.
      duration: reduced ? 0 : 0.9,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Por encima de 1: la rueda avanza algo más que el gesto físico. En una
      // landing de 14 capítulos y ~25 viewports de alto, un multiplicador por
      // debajo de 1 obliga a rodar el dedo eternamente.
      wheelMultiplier: 1.15,
      touchMultiplier: 1.8,
      smoothWheel: !reduced,
    })

    lenis.on('scroll', ({ scroll, limit, velocity }: { scroll: number; limit: number; velocity: number }) => {
      commitScroll(limit > 0 ? scroll / limit : 0, velocity)
      ScrollTrigger.update()
    })

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    ScrollTrigger.refresh()

    return () => {
      gsap.ticker.remove(raf)
      lenis.destroy()
      ScrollTrigger.getAll().forEach((t) => t.kill())
    }
  }, [])
}
