/**
 * FONDO DE RESPALDO — lo que se ve cuando no hay Núcleo.
 *
 * Sin WebGL, esta landing era un rectángulo NEGRO con tipografía encima. No
 * "más sobria": rota. Toda la identidad —los tres mundos, el color, la
 * temperatura— vivía dentro del canvas, y al quitarlo no quedaba nada.
 *
 * Esto la devuelve. Dos ideas lo sostienen:
 *
 * 1. SIGUE LA NARRATIVA SOLO. No pinta un degradado fijo: lee `--world-bg`,
 *    `--world-accent` y `--world-accent-2`, que `useWorldSync` ya reescribe
 *    con el scroll. Así el fondo viaja de VOID a Mood Agency y a Mood Creative
 *    exactamente igual que lo haría la escena, sin una línea de JS por frame
 *    ni una suscripción más. El CSS ya estaba haciendo ese trabajo.
 *
 * 2. ES BARATO A PROPÓSITO. Esto se pinta justamente en las máquinas que NO
 *    pudieron con WebGL: integradas viejas, aceleración apagada, máquinas
 *    virtuales. Por eso son degradados radiales y `transform` —lo que el
 *    compositor resuelve sin tocar la CPU— y NO `filter: blur()`, que a
 *    pantalla completa es de lo más caro que se le puede pedir a una GPU
 *    modesta. Habría sido irónico fundir el dispositivo con el plan B.
 *
 * Sin texto y `aria-hidden`: es un fondo. Anunciar "no se pudo cargar el 3D"
 * sería contarle al usuario un problema nuestro que él no tiene —la página se
 * lee entera igual— y convertir una degradación elegante en un mensaje de error.
 */

/**
 * Deriva lentísima, en `transform` puro. No hay una escena que mirar, así que
 * el fondo tiene que estar VIVO o se lee como una imagen estática pegada
 * detrás del texto. Los dos ciclos son primos entre sí (23 y 31 segundos) para
 * que la combinación no repita un patrón reconocible.
 *
 * Con `prefers-reduced-motion` se detiene: la regla global de `index.css` deja
 * las animaciones en 0.01ms y los halos se quedan en su primer fotograma, que
 * ya es una composición cerrada.
 */
const DRIFT_CSS = `
@keyframes mood-drift-a {
  0%, 100% { transform: translate3d(-4%, -3%, 0) scale(1); }
  50%      { transform: translate3d(4%, 3%, 0) scale(1.12); }
}
@keyframes mood-drift-b {
  0%, 100% { transform: translate3d(5%, 4%, 0) scale(1.08); }
  50%      { transform: translate3d(-5%, -2%, 0) scale(0.96); }
}
`

/** Un halo. `closest-side` mantiene el círculo redondo sea cual sea el viewport. */
function glow(color: string, x: string, y: string, size: string, opacity: number, anim: string) {
  return {
    position: 'absolute' as const,
    left: x,
    top: y,
    width: size,
    height: size,
    marginLeft: `calc(${size} / -2)`,
    marginTop: `calc(${size} / -2)`,
    background: `radial-gradient(closest-side, ${color}, transparent)`,
    opacity,
    animation: anim,
    willChange: 'transform',
  }
}

export function SceneFallback(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      /* z-0, el mismo plano que ocupaba el Canvas: así el scrim de legibilidad
         de `App` (z-5) sigue haciendo su trabajo sobre esto igual que hacía
         sobre la escena, y el texto se lee con el mismo contraste. */
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ backgroundColor: 'var(--world-bg)' }}
    >
      {/* React 19 iza este bloque al <head> y lo deduplica por `href`. */}
      <style href="mood-scene-fallback" precedence="default">
        {DRIFT_CSS}
      </style>

      {/* El acento del mundo activo, en el centro: es donde vivía el Núcleo.
          Las opacidades parecen altas leídas sueltas y NO lo son: encima de
          esto va el scrim de legibilidad de `App`, que se come un 18% en el
          centro y un 62% arriba y abajo. Están calibradas contra el resultado
          final, no contra el degradado aislado — que es exactamente el error
          que deja estos fondos en un negro apenas sucio. */}
      <span
        style={glow('var(--world-accent)', '50%', '42%', '92vmax', 0.28, 'mood-drift-a 23s ease-in-out infinite')}
      />
      {/* El secundario abre la diagonal y evita que el centro sea una mancha
          simétrica, que es lo que delata a un degradado de plantilla. */}
      <span
        style={glow('var(--world-accent-2)', '78%', '72%', '70vmax', 0.32, 'mood-drift-b 31s ease-in-out infinite')}
      />
      <span
        style={glow('var(--world-accent-2)', '14%', '18%', '58vmax', 0.2, 'mood-drift-b 31s ease-in-out infinite reverse')}
      />
    </div>
  )
}
