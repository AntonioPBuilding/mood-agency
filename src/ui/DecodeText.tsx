import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getQuality } from '@/core/quality'
import { DECODE_GLYPHS } from './uiCopy'

/**
 * TEXTO QUE SE DESCIFRA — la voz tipográfica de Mood Creative.
 *
 * Cada carácter cicla por glifos aleatorios y se fija de izquierda a derecha,
 * como un terminal resolviendo una clave. Dos decisiones que sostienen el
 * efecto:
 *
 * - Los espacios NUNCA se cifran. Si se cifran, la silueta de las palabras
 *   desaparece y el bloque parece ruido, no un texto resolviéndose.
 * - Los glifos se renuevan a ~20Hz, no a 60. A 60 el ojo sólo ve gris vibrando;
 *   a 20 distingue caracteres y entiende que ALGO se está descifrando.
 *
 * El texto se escribe con `textContent` sobre nodos ya creados: cero re-renders
 * de React durante la animación.
 */

interface DecodeTextProps {
  children: string
  className?: string
  duration?: number
}

gsap.registerPlugin(ScrollTrigger)

const GLYPH_HZ = 20

/**
 * Ancho mínimo por celda: aunque el glifo aleatorio sea más ancho o la celda
 * esté momentáneamente vacía, el texto no salta ni provoca reflow.
 */
const CELL: React.CSSProperties = {
  display: 'inline-block',
  minWidth: '0.6em',
  whiteSpace: 'pre',
}

const SPACE_CELL: React.CSSProperties = {
  display: 'inline-block',
  minWidth: '0.32em',
  whiteSpace: 'pre',
}

interface Group {
  /** false = un espacio suelto, que es la única oportunidad de salto de línea. */
  word: boolean
  /** Índice global del primer carácter: mantiene alineadas celdas y texto real. */
  start: number
  value: string
}

/**
 * Agrupa en palabras conservando UNA celda por carácter. Sin esto, cada letra
 * es un inline-block independiente y el texto puede partirse por la mitad de
 * una palabra al hacer wrap.
 */
function groupChars(text: string): Group[] {
  const chars = Array.from(text)
  const out: Group[] = []
  let i = 0
  while (i < chars.length) {
    if (chars[i] === ' ') {
      out.push({ word: false, start: i, value: ' ' })
      i++
      continue
    }
    const start = i
    let value = ''
    while (i < chars.length && chars[i] !== ' ') {
      value += chars[i]
      i++
    }
    out.push({ word: true, start, value })
  }
  return out
}

export function DecodeText({
  children,
  className = '',
  duration = 1.2,
}: DecodeTextProps): React.JSX.Element {
  const rootRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const cells = Array.from(root.querySelectorAll<HTMLElement>('[data-cell]'))
    if (cells.length === 0) return

    const chars = Array.from(children)
    const reduced = getQuality().reduced

    // Reduced motion: el texto está, sólo que sin descifrado.
    if (reduced) {
      for (let i = 0; i < cells.length; i++) cells[i].textContent = chars[i]
      return
    }

    let raf = 0
    let start = 0
    let lastGlyphAt = 0

    const tick = (now: number) => {
      if (start === 0) start = now
      const t = (now - start) / (duration * 1000)
      const churn = now - lastGlyphAt > 1000 / GLYPH_HZ
      if (churn) lastGlyphAt = now

      let pending = false

      for (let i = 0; i < cells.length; i++) {
        const ch = chars[i]
        if (ch === ' ') continue

        // Cada carácter se fija más tarde cuanto más a la derecha está, pero
        // el último se fija en 0.85 y no en 1: el remate seco se lee mejor
        // que un goteo que se apaga.
        const lockAt = 0.1 + (i / cells.length) * 0.75

        if (t >= lockAt) {
          if (cells[i].textContent !== ch) cells[i].textContent = ch
          continue
        }

        pending = true
        if (churn) {
          cells[i].textContent = DECODE_GLYPHS.charAt(
            (Math.random() * DECODE_GLYPHS.length) | 0,
          )
        }
      }

      if (pending) {
        raf = requestAnimationFrame(tick)
      } else {
        for (let i = 0; i < cells.length; i++) cells[i].textContent = chars[i]
        raf = 0
      }
    }

    // Estado inicial: nada visible hasta que el bloque entra en pantalla.
    for (let i = 0; i < cells.length; i++) {
      cells[i].textContent = chars[i] === ' ' ? ' ' : ''
    }

    const st = ScrollTrigger.create({
      trigger: root,
      start: 'top 90%',
      once: true,
      onEnter: () => {
        start = 0
        raf = requestAnimationFrame(tick)
      },
    })

    return () => {
      if (raf) cancelAnimationFrame(raf)
      st.kill()
    }
  }, [children, duration])

  return (
    <span ref={rootRef} className={`font-mono ${className}`}>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {groupChars(children).map((group) =>
          group.word ? (
            <span key={group.start} className="inline-block whitespace-nowrap">
              {Array.from(group.value).map((ch, j) => (
                <span key={group.start + j} data-cell style={CELL}>
                  {ch}
                </span>
              ))}
            </span>
          ) : (
            <span key={group.start} data-cell style={SPACE_CELL}>
              {' '}
            </span>
          ),
        )}
      </span>
    </span>
  )
}
