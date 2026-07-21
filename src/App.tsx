import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { isOverlayOpen, subscribeOverlay } from '@/core/overlayStore'
import {
  getQuality,
  liveQuality,
  resetQualitySampler,
  sampleFrame,
  subscribeQuality,
} from '@/core/quality'
import { useSmoothScroll } from '@/core/useSmoothScroll'
import { useWorldSync } from '@/core/useWorldSync'
import {
  Cursor,
  Preloader,
  SceneBoundary,
  SceneFallback,
  SkipLink,
  hasWebGL,
} from '@/ui'
import {
  Hero,
  Manifesto,
  Division,
  ControlIntro,
  ControlServices,
  Roster,
  Blackout,
  NetIntro,
  NetServices,
  Plans,
  Stack,
  Clients,
  Converge,
  Footer,
} from '@/sections'

/**
 * La escena pesa ~700kb entre three, drei y postprocessing. Va lazy para que el
 * primer paint del DOM no la espere: se ve tipografía en menos de 1s y el
 * Núcleo entra cuando está listo, detrás del preloader.
 */
const Scene = lazy(() => import('@/scenes/Scene'))

/**
 * ESTADO DE LA ESCENA.
 *
 * - `live`  — el Núcleo está en pantalla. El caso de siempre.
 * - `lost`  — el navegador nos quitó el contexto WebGL. El Canvas sigue MONTADO
 *             a propósito (ver más abajo) y encima se pinta el fondo de respaldo.
 * - `down`  — no hay 3D y no lo va a haber: sin soporte, la escena reventó, o
 *             el contexto no volvió. Estado terminal, el Canvas se desmonta.
 */
type SceneState = 'live' | 'lost' | 'down'

/**
 * Cuánto esperamos a que vuelva un contexto perdido antes de rendirnos.
 *
 * Perder el contexto casi nunca es culpa de la página: el sistema recupera el
 * driver, el portátil cambia de GPU, el móvil sale de suspensión. En esos casos
 * el navegador devuelve el contexto en menos de un segundo y la escena se
 * reconstruye sola. Pasados seis, no vuelve.
 */
const RESTORE_GRACE_MS = 6000

/**
 * GOBERNADOR DEL LOOP DE RENDER.
 *
 * Vive DENTRO del Canvas porque necesita el store de R3F. No pinta nada: mide
 * y despierta.
 *
 * - Mide un frame por frame y se lo pasa al presupuesto adaptativo. Si la
 *   máquina no da el cuero, `quality.ts` baja de escalón sola.
 * - Al reanudar tras una pausa hay que DESPERTAR el bucle a mano. R3F para su
 *   rAF global cuando ningún root pide frames; devolver `frameloop` a 'always'
 *   cambia el estado pero no relanza el bucle. Sin este `invalidate()` la
 *   pantalla se queda congelada con el último frame de hace diez minutos.
 */
function RenderGovernor({ paused }: { paused: boolean }): null {
  const invalidate = useThree((s) => s.invalidate)
  const setFrameloop = useThree((s) => s.setFrameloop)

  useEffect(() => {
    if (paused) {
      setFrameloop('never')
      return
    }

    // El orden IMPORTA: `invalidate()` se sale sin hacer nada si el frameloop
    // todavía está en 'never'.
    setFrameloop('always')
    invalidate()
    // La medida está sucia después de una pausa (el primer delta tras reanudar
    // no dice nada del rendimiento real): se descarta la ventana entera.
    resetQualitySampler()

    // Cinturón y tirantes: si algo re-configuró el frameloop entre medias,
    // el frame siguiente vuelve a insistir. Un `invalidate()` de más no cuesta
    // nada; uno de menos deja la escena muerta.
    const raf = requestAnimationFrame(() => invalidate())
    return () => cancelAnimationFrame(raf)
  }, [paused, invalidate, setFrameloop])

  useFrame((_, delta) => {
    sampleFrame(delta)
  })

  return null
}

export default function App() {
  const [ready, setReady] = useState(false)
  const q = getQuality()

  /**
   * ¿Hay 3D? Se pregunta ANTES del primer render, no después de que el Canvas
   * explote. Sin esta comprobación, un dispositivo sin WebGL montaba el Canvas,
   * three lanzaba al crear el contexto y se caía el árbol entero de React: la
   * landing no perdía el fondo, perdía los catorce capítulos.
   */
  const [sceneState, setSceneState] = useState<SceneState>(() => (hasWebGL() ? 'live' : 'down'))
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /**
   * Pausa del render. Dos motivos, un solo interruptor:
   * - `document.hidden`: la pestaña está en segundo plano.
   * - una capa opaca a pantalla completa (ver `@/core/overlayStore`).
   *
   * `setPaused` con el mismo valor no re-renderiza (React corta antes), así
   * que esto se puede llamar tantas veces como haga falta.
   */
  const [paused, setPaused] = useState(false)

  /**
   * DPR VIVO. Va por estado —y no leyendo `liveQuality` en el render— porque
   * el Canvas re-aplica su prop `dpr` en cada reconfiguración: si el prop se
   * quedara con el valor de arranque, cualquier re-render de App desharía el
   * degradado. Cambia como mucho dos veces en toda la sesión.
   */
  const [dpr, setDpr] = useState(() => liveQuality.dpr)

  useSmoothScroll()
  useWorldSync()

  useEffect(() => {
    const sync = () => setPaused(document.hidden || isOverlayOpen())
    document.addEventListener('visibilitychange', sync)
    const unsubscribe = subscribeOverlay(sync)
    sync()
    return () => {
      document.removeEventListener('visibilitychange', sync)
      unsubscribe()
    }
  }, [])

  useEffect(() => subscribeQuality((live) => setDpr(live.dpr)), [])

  const hasCanvas = sceneState !== 'down'
  // Con el contexto perdido no se puede pedir un frame: three lanzaría contra
  // un contexto muerto en cada llamada de dibujo. Se congela igual que con la
  // pestaña de fondo.
  const frozen = paused || sceneState === 'lost'

  /**
   * PÉRDIDA Y RECUPERACIÓN DEL CONTEXTO WEBGL.
   *
   * Pasa de verdad y más a menudo de lo que parece: el sistema reinicia el
   * driver, un portátil híbrido cambia de GPU, el móvil vuelve de suspensión,
   * o el navegador nos quita el contexto porque otra pestaña pidió uno y ya no
   * quedan. El evento NO lanza ninguna excepción, así que ningún ErrorBoundary
   * se entera: el canvas simplemente se queda en negro para siempre.
   *
   * Dos detalles que deciden si esto funciona o es decorativo:
   *
   * 1. `preventDefault()` en `webglcontextlost` es OBLIGATORIO. Sin él el
   *    navegador NUNCA emite `webglcontextrestored` y la pérdida pasa de
   *    temporal a definitiva. Es una línea y es toda la diferencia.
   *
   * 2. El Canvas NO se desmonta mientras esperamos. El evento de recuperación
   *    lo emite ESE elemento `<canvas>`: si lo quitamos del árbol nos quedamos
   *    sin nadie a quien escuchar, y una pérdida perfectamente recuperable se
   *    vuelve permanente. Se tapa con el fondo de respaldo y se espera.
   */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let graceTimer = 0

    const onLost = (event: Event) => {
      event.preventDefault()
      console.warn('[mood] Contexto WebGL perdido. Esperando a que vuelva.')
      setSceneState('lost')
      graceTimer = window.setTimeout(() => setSceneState('down'), RESTORE_GRACE_MS)
    }

    const onRestored = () => {
      window.clearTimeout(graceTimer)
      setSceneState('live')
    }

    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)

    return () => {
      window.clearTimeout(graceTimer)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [hasCanvas])

  /** La escena reventó (chunk que no llega, shader que no compila). Terminal. */
  const onSceneError = useCallback(() => setSceneState('down'), [])

  /**
   * SUBÁRBOLES CONGELADOS.
   *
   * Ni la escena ni los catorce capítulos dependen del estado de App. Pero App
   * ahora SÍ re-renderiza —al pausar, al reanudar, al bajar de tier— y sin esto
   * cada uno de esos cambios reconciliaría el árbol entero: los 14 capítulos de
   * DOM y toda la escena 3D. Con el elemento memorizado, React ve la MISMA
   * referencia y se salta el subárbol completo.
   *
   * En la escena eso es especialmente caro: `EffectComposer` reconstruye su
   * pasada —y recompila el shader de la cadena— en cuanto cambia la identidad
   * de sus hijos. Sin este `useMemo`, abrir y cerrar un modal recompilaría el
   * post-proceso cada vez.
   */
  const scene = useMemo(
    () => (
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    ),
    [],
  )

  const chapters = useMemo(
    () => (
      /* Los 14 capítulos, encima del Canvas.
         `tabIndex={-1}` no mete a `<main>` en el orden de tabulación: lo hace
         ENFOCABLE, que es otra cosa. Sin esto el "saltar al contenido" mueve el
         scroll pero no el foco, y el siguiente Tab devuelve al usuario al
         principio: un atajo que no ahorra nada. */
      <main id="contenido" tabIndex={-1} className="relative z-10">
        <Hero />
        <Manifesto />
        <Division />
        <ControlIntro />
        <ControlServices />
        <Roster />
        <Blackout />
        <NetIntro />
        <NetServices />
        <Plans />
        <Stack />
        <Clients />
        <Converge />
        <Footer />
      </main>
    ),
    [],
  )

  /**
   * REMEDICIÓN DE SCROLLTRIGGER. Sin esto, medio DOM no se revela nunca.
   *
   * Las secciones montan —y crean sus ScrollTrigger— mientras el Preloader
   * está encima con el scroll bloqueado y con la tipografía todavía sin
   * cargar. Cada trigger anota en ese instante a qué altura del documento
   * vive su elemento.
   *
   * Después el Preloader se va y entra `Archivo`, que cambia las métricas de
   * TODOS los titulares gigantes. El documento se recoloca varios viewports…
   * y los triggers siguen apuntando a coordenadas que ya no existen. El texto
   * se queda escondido en `yPercent: 115` esperando un cruce que nunca llega.
   *
   * El código de las animaciones estaba bien: lo que estaba mal era CUÁNDO se
   * midió. Por eso remedimos al terminar el preloader y otra vez cuando las
   * fuentes están listas.
   */
  useEffect(() => {
    if (!ready) return

    const refresh = () => ScrollTrigger.refresh()
    // Un frame de margen: dejamos que el navegador aplique el layout posterior
    // al desmontaje del Preloader antes de volver a medir.
    const raf = requestAnimationFrame(refresh)
    document.fonts?.ready.then(refresh).catch(() => {})

    window.addEventListener('resize', refresh)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', refresh)
    }
  }, [ready])

  return (
    <>
      {/* Primer punto de tabulación del documento. Va antes que nada. */}
      {ready && <SkipLink />}

      {!ready && <Preloader onComplete={() => setReady(true)} />}

      <Cursor />

      {/* EL NÚCLEO. Un solo Canvas, fijo, para toda la landing.
          `pointer-events-none` para que el scroll y los clicks pasen al DOM. */}
      {hasCanvas && (
        <SceneBoundary onError={onSceneError}>
          <div className="pointer-events-none fixed inset-0 z-0">
            <Canvas
              ref={canvasRef}
              dpr={dpr}
              gl={{
                antialias: q.tier === 'high',
                powerPreference: 'high-performance',
                // El post-processing hace su propio tone mapping; aplicarlo dos
                // veces lava los neones de Mood Agency.
                alpha: false,
              }}
              camera={{ fov: 45, position: [0, 0, 6], near: 0.1, far: 100 }}
              /* 'always' mientras se vea: el Núcleo respira aunque nadie scrollee.
                 'never' cuando no se ve: pintar detrás de un modal opaco, con la
                 pestaña en segundo plano o contra un contexto perdido es quemar
                 batería para nadie. */
              frameloop={frozen ? 'never' : 'always'}
            >
              <RenderGovernor paused={frozen} />
              {scene}
            </Canvas>
          </div>
        </SceneBoundary>
      )}

      {/* DEGRADACIÓN CON DIGNIDAD.
          Va DESPUÉS del Canvas en el DOM a propósito: ambos son `fixed z-0`, y
          entre hermanos con el mismo z-index gana el último. Así, mientras
          esperamos a que vuelva un contexto perdido, esto tapa el canvas muerto
          sin necesidad de desmontarlo (y de perder el evento de recuperación). */}
      {sceneState !== 'live' && <SceneFallback />}

      {/* SCRIM DE LEGIBILIDAD.
          Va ENTRE el canvas (z-0) y el texto (z-10). El Núcleo ocupa toda la
          pantalla, y tipografía blanca sobre partículas brillantes en
          movimiento no se lee: el ojo no puede separar figura de fondo.
          Bandas oscuras arriba y abajo (donde viven cabeceras y titulares) y
          centro más limpio, que es donde queremos ver el Núcleo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[5]"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.18) 26%, rgba(0,0,0,0.18) 74%, rgba(0,0,0,0.62) 100%)',
        }}
      />

      {chapters}

      {/* El HUD de scroll (capítulo, % y barra de progreso) se retiró a petición
          del cliente. El componente sigue en `@/ui/ScrollHUD` por si vuelve:
          basta con montarlo otra vez acá. */}
    </>
  )
}
