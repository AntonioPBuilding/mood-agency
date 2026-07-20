/**
 * Puente entre el mundo 3D y el DOM.
 *
 * Escribe las variables CSS `--world-*` para que la tipografía, los bordes y el
 * cursor cambien de mundo EXACTAMENTE al mismo tiempo que la escena. Si el DOM
 * y el Canvas transicionan por separado, se ve el desfase.
 *
 * Escribe sólo cuando el color realmente cambió: tocar el CSSOM en cada frame
 * dispara recalculado de estilo en toda la página.
 *
 * VA COLGADO DEL `gsap.ticker`, no de un rAF propio. El ticker de GSAP ya es el
 * reloj maestro del sitio (conduce a Lenis, ver `useSmoothScroll`), y cada rAF
 * independiente que se le suma es otra oportunidad de leer el scroll medio
 * frame más tarde que la escena. Un solo reloj, un solo orden.
 */

import { useEffect } from 'react'
import gsap from 'gsap'
import { blendWorld } from './palette'
import { scroll } from './scrollStore'

export function useWorldSync() {
  useEffect(() => {
    const root = document.documentElement
    let lastBg = ''
    let lastAccent = ''
    let lastWorld = ''

    const tick = () => {
      // Con la pestaña de fondo no hay nada que sincronizar: al volver, el
      // primer tick escribe el estado correcto igual (los `last*` no mienten).
      if (document.hidden) return

      const w = blendWorld(scroll.progress)

      if (w.bg !== lastBg) {
        lastBg = w.bg
        root.style.setProperty('--world-bg', w.bg)
        root.style.setProperty('--world-ink', w.ink)
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute('content', w.bg)
      }

      if (w.accent !== lastAccent) {
        lastAccent = w.accent
        root.style.setProperty('--world-accent', w.accent)
        root.style.setProperty('--world-accent-2', w.accent2)
      }

      // Expuesto para CSS: permite reaccionar al mundo activo sin JS extra.
      // Escribir el MISMO valor en un dataset sigue siendo una mutación de
      // atributo, y una mutación de atributo en <html> invalida los selectores
      // de todo el documento. Se escribe sólo cuando cambia de verdad.
      const world = w.t > 0.5 ? w.to : w.from
      if (world !== lastWorld) {
        lastWorld = world
        root.dataset.world = world
      }
    }

    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
    }
  }, [])
}
