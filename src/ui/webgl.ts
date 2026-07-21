/**
 * ¿Hay WebGL en esta máquina?
 *
 * Toda la identidad visual de esta landing vive dentro de un `<canvas>`. Si el
 * contexto no se puede crear —GPU en lista negra, aceleración por hardware
 * apagada, una VM, un navegador viejo, una extensión que lo bloquea— lo que
 * queda no es "la web sin 3D": es una pantalla NEGRA con texto encima. Por eso
 * esto se pregunta ANTES de montar el Canvas, no después de que explote.
 *
 * Ojo con dos detalles que la mayoría de las implementaciones se comen:
 *
 * 1. HAY QUE SOLTAR EL CONTEXTO. Un navegador permite un número limitado de
 *    contextos WebGL vivos a la vez (~8-16 según plataforma). Un contexto de
 *    sonda que se queda colgado es uno menos para la escena de verdad, y en
 *    móvil eso se nota. `WEBGL_lose_context` lo libera en el acto.
 *
 * 2. `getContext` puede LANZAR, no sólo devolver `null`. Algunas
 *    configuraciones —y algún bloqueador de fingerprinting— tiran una
 *    excepción en vez de devolver null. Sin el try/catch, la detección de
 *    fallback es lo primero que rompe la página que venía a salvar.
 */

/** Se pregunta una sola vez: el resultado no cambia durante la sesión. */
let cached: boolean | null = null

export function hasWebGL(): boolean {
  if (cached !== null) return cached
  if (typeof document === 'undefined') return (cached = false)

  try {
    const canvas = document.createElement('canvas')
    // El orden importa: la escena pide WebGL2 primero (R3F/three hacen lo
    // mismo), así que la sonda tiene que fallar donde falla la escena real.
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')

    if (!gl) return (cached = false)

    // Devolvemos el contexto de sonda al sistema inmediatamente.
    if (gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext) {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }

    return (cached = true)
  } catch {
    return (cached = false)
  }
}
