import type { MouseEvent } from 'react'
import { A11Y_COPY } from './uiCopy'

/**
 * ATAJOS DE TECLADO.
 *
 * Dos enlaces, invisibles hasta que reciben el foco, y son el PRIMER punto de
 * tabulación del documento.
 *
 * El segundo —"ir al formulario"— no es relleno de checklist. Esta landing mide
 * veinticinco viewports y es un solo `<main>` sin navegación: sin este atajo,
 * llegar al formulario con el teclado es tabular a ciegas por catorce capítulos
 * de servicios, un carrusel y tres planes. Con él, es una tecla. Ahí está la
 * diferencia entre accesible de verdad y accesible en el informe.
 *
 * ── Por qué hay un `onClick` y no basta el `href` ────────────────────────────
 * Un salto de ancla nativo mueve el foco al destino sólo si el destino es
 * enfocable, y el scroll de este sitio lo conduce Lenis, no el navegador. Con
 * el salto nativo a secas el usuario de teclado a veces terminaba VIENDO el
 * formulario pero con el foco todavía arriba del todo: el siguiente Tab lo
 * devolvía al Hero. Movemos el foco a mano y dejamos el `href` como plan B por
 * si el destino no existiera.
 */

interface Shortcut {
  /** `id` del destino en el documento. */
  target: string
  label: string
}

const SHORTCUTS: readonly Shortcut[] = [
  { target: 'contenido', label: A11Y_COPY.skipToContent },
  { target: 'chapter-converge', label: A11Y_COPY.skipToContact },
]

function jumpTo(event: MouseEvent<HTMLAnchorElement>, id: string): void {
  const el = document.getElementById(id)
  if (!el) return // Sin destino: que el navegador haga lo que pueda con el href.

  event.preventDefault()

  // `tabindex="-1"` hace enfocable un elemento SIN meterlo en el orden de
  // tabulación. Es la técnica canónica para destinos de skip link: sin esto,
  // `focus()` sobre un `<section>` no hace absolutamente nada.
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')

  // Foco primero y sin scroll, scroll después: al revés el navegador hace dos
  // desplazamientos y se ve el rebote.
  el.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'start' })
}

export function SkipLink(): React.JSX.Element {
  return (
    <nav aria-label={A11Y_COPY.navLabel} className="pointer-events-none fixed top-0 left-0 z-[300]">
      <ul className="flex list-none gap-2 p-0">
        {SHORTCUTS.map(({ target, label }) => (
          <li key={target}>
            <a
              href={`#${target}`}
              onClick={(e) => jumpTo(e, target)}
              data-cursor="hover"
              /* Fuera de pantalla, NO `display:none`: lo que no se pinta no se
                 puede enfocar, y entonces el atajo no existe. Vuelve con el
                 foco. */
              className="type-label pointer-events-auto m-3 inline-block -translate-y-[300%] px-5 py-3 whitespace-nowrap opacity-0 transition-[transform,opacity] duration-300 focus:translate-y-0 focus:opacity-100"
              style={{
                backgroundColor: 'var(--world-accent)',
                color: 'var(--world-bg)',
                transitionTimingFunction: 'var(--ease-out-expo)',
              }}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
