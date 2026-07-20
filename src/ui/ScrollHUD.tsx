import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { ChapterId } from '@/core/chapters'
import { CHAPTERS } from '@/core/chapters'
import { scroll, subscribeChapter } from '@/core/scrollStore'
import { CHAPTER_LABELS } from './uiCopy'

/**
 * HUD DE SCROLL.
 *
 * Dos frecuencias distintas, dos mecanismos distintos:
 *
 * - El NOMBRE del capítulo cambia 13 veces en toda la landing → `subscribeChapter`
 *   y estado de React. Perfecto.
 * - El PORCENTAJE cambia en cada frame → escritura directa de `textContent`, y
 *   sólo cuando el entero cambia de verdad. Meter esto en un `useState` sería un
 *   re-render por frame de todo el árbol: exactamente lo que prohíbe el contrato.
 *
 * El loop cuelga del `gsap.ticker` (el reloj maestro del sitio) en vez de tener
 * un rAF propio, y no escribe nada con la pestaña de fondo.
 *
 * Es chrome decorativo: va `aria-hidden`. El progreso real de un documento lo da
 * el propio documento, y las 14 secciones son navegables sin esto.
 */

const TOTAL = CHAPTERS.length

/**
 * Cuantización de la barra: 1/2000 del ancho.
 *
 * La barra se escribía en CADA frame, cambiara o no. Con la página quieta eso
 * son 60 escrituras por segundo de un `transform` idéntico. Pero cuantizar por
 * el entero del porcentaje (como hace el número) daría saltos de 20px en un
 * monitor ancho: la barra dejaría de ser continua. 2000 pasos es sub-píxel en
 * cualquier pantalla y elimina el 100% de las escrituras redundantes.
 */
const BAR_STEP = 1 / 2000

export function ScrollHUD(): React.JSX.Element {
  const barRef = useRef<HTMLSpanElement>(null)
  const pctRef = useRef<HTMLSpanElement>(null)
  const [chapter, setChapter] = useState<ChapterId>('hero')

  useEffect(() => {
    return subscribeChapter((s) => setChapter(s.chapter))
  }, [])

  useEffect(() => {
    const bar = barRef.current
    const pct = pctRef.current
    if (!bar || !pct) return

    let lastPct = -1
    let lastBar = -1

    const tick = () => {
      if (document.hidden) return

      // Lectura directa del objeto mutable: sin estado intermedio.
      const p = scroll.progress

      if (Math.abs(p - lastBar) >= BAR_STEP) {
        lastBar = p
        bar.style.transform = `scaleX(${p})`
      }

      const n = Math.round(p * 100)
      if (n !== lastPct) {
        lastPct = n
        pct.textContent = n.toString().padStart(3, '0')
      }
    }

    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
    }
  }, [])

  const index = CHAPTERS.findIndex((c) => c.id === chapter) + 1

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] select-none"
    >
      {/* Barra de 1px: la única pieza de cromo que atraviesa toda la pantalla. */}
      <span className="relative block h-px w-full overflow-hidden bg-bone/15">
        <span
          ref={barRef}
          className="absolute inset-0 block origin-left bg-[var(--world-accent)]"
          style={{ transform: 'scaleX(0)', willChange: 'transform' }}
        />
      </span>

      <div className="type-label flex items-baseline justify-between px-5 py-4 text-bone/60 md:px-10">
        <span>
          <span className="text-[var(--world-accent)]">
            {index.toString().padStart(2, '0')}
          </span>
          {' / '}
          {TOTAL.toString().padStart(2, '0')}
          <span className="ml-4">{CHAPTER_LABELS[chapter]}</span>
        </span>

        <span className="tabular-nums">
          <span ref={pctRef}>000</span>
          {' %'}
        </span>
      </div>
    </div>
  )
}
