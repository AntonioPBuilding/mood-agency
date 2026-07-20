import { useRef } from 'react'
import { BLACKOUT } from '@/content'
import { bump } from '@/core/chapters'
import { blackoutAmount } from '@/core/palette'
import { getQuality } from '@/core/quality'
import { scroll } from '@/core/scrollStore'
import { ChapterSection } from './ChapterSection'
import { useFrameLoop } from './useFrameLoop'

/**
 * EL APAGÓN.
 *
 * Casi no hay DOM y es intencional: acá manda el 3D. Dos líneas que aparecen en
 * el negro y se van, encadenadas con la curva de `blackoutAmount` — que se apaga
 * seco y se enciende lento. Esa asimetría es TODO el efecto.
 *
 * Se lee `scroll.progress` dentro del ticker y se escribe `opacity` directo en
 * el nodo. Nada de estado de React: esto se actualiza 60 veces por segundo.
 * `bump()` existe justo para esto: elementos efímeros que nacen y mueren dentro
 * de un tramo del timeline.
 */

const RANGES: ReadonlyArray<readonly [number, number]> = [
  [0.492, 0.53],
  [0.526, 0.566],
]

export function Blackout(): React.JSX.Element {
  const linesRef = useRef<HTMLParagraphElement[]>([])
  const veilRef = useRef<HTMLDivElement>(null)
  // Sin movimiento: las dos líneas se quedan escritas. El apagón sigue estando
  // (lo pinta el 3D), pero el texto no depende de acertar un tramo de scroll.
  const reduced = getQuality().reduced

  const setLine = (i: number) => (node: HTMLParagraphElement | null) => {
    if (node) linesRef.current[i] = node
  }

  useFrameLoop(() => {
    const p = scroll.progress

    for (let i = 0; i < RANGES.length; i++) {
      const node = linesRef.current[i]
      if (!node) continue
      const [from, to] = RANGES[i]
      node.style.opacity = bump(p, from, to).toFixed(3)
    }

    // El Núcleo apaga la escena; este velo apaga el DOM. Sin él, el fondo de
    // página sigue siendo el granate de Control y el negro no es absoluto.
    if (veilRef.current) {
      veilRef.current.style.opacity = blackoutAmount(p).toFixed(3)
    }
  }, !reduced)

  return (
    <ChapterSection id="blackout" innerClassName="justify-center px-5 md:px-10">
      <div
        ref={veilRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-black"
        style={{ opacity: 0 }}
      />

      <div className="relative flex flex-col items-center gap-[6vh] text-center">
        {BLACKOUT.lines.map((line, i) => (
          <p
            key={line}
            ref={setLine(i)}
            className="type-giga gpu uppercase"
            style={{ opacity: reduced ? 1 : 0 }}
          >
            {line}
          </p>
        ))}
      </div>
    </ChapterSection>
  )
}
