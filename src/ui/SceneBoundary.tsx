import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * CORTAFUEGOS DE LA ESCENA 3D.
 *
 * Un error dentro del Canvas —el chunk de `three` que no llega, un shader que
 * no compila en un driver concreto, una extensión de WebGL ausente— hoy tumba
 * el árbol de React ENTERO. Y como el árbol entero incluye los catorce
 * capítulos, el usuario se queda mirando un `<div id="root">` vacío: no pierde
 * el 3D, pierde la web.
 *
 * Esto acota el daño a lo que de verdad falló. La escena se apaga, el DOM
 * sigue vivo y `onError` avisa a `App` para que pinte el fondo de respaldo.
 *
 * Tiene que ser una clase: los hooks NO pueden capturar errores de render.
 * `getDerivedStateFromError` es lo único que corre en la fase de render y ve
 * la excepción; `componentDidCatch` corre después, ya en commit, y es donde se
 * puede notificar sin romper las reglas del render puro.
 *
 * ¿Por qué basta con envolver el `<Canvas>` desde el DOM, si la escena vive en
 * otro reconciliador? Porque R3F tiene su propio boundary interno que RELANZA
 * la excepción en el árbol de React DOM. El error viaja hasta acá solo.
 */

interface SceneBoundaryProps {
  children: ReactNode
  /** Se llama una vez, cuando la escena cae. `App` cambia a modo fallback. */
  onError: (error: Error) => void
}

interface SceneBoundaryState {
  failed: boolean
}

export class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false }

  static getDerivedStateFromError(): SceneBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // A la consola SIEMPRE, también en producción. Una escena que se cae en
    // silencio es una escena que nadie arregla nunca: el usuario ve el fondo
    // de respaldo, le parece intencional y el bug vive para siempre.
    console.error('[mood] La escena 3D falló, se pasa al fondo de respaldo.', error, info.componentStack)
    this.props.onError(error)
  }

  render(): ReactNode {
    // `null`, no un fallback propio: quien decide qué se ve en lugar de la
    // escena es `App`, que es quien conoce los otros motivos de degradación
    // (sin soporte, contexto perdido) y tiene que resolverlos todos igual.
    return this.state.failed ? null : this.props.children
  }
}
