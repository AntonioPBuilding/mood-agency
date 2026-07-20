import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
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
import { Cursor, Preloader, ScrollHUD } from '@/ui'
import {
  Hero,
  Manifesto,
  Division,
  ControlIntro,
  ControlServices,
  Gallery,
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
      // Los 14 capítulos, encima del Canvas.
      <main className="relative z-10">
        <Hero />
        <Manifesto />
        <Division />
        <ControlIntro />
        <ControlServices />
        <Gallery />
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
      {!ready && <Preloader onComplete={() => setReady(true)} />}

      <Cursor />

      {/* EL NÚCLEO. Un solo Canvas, fijo, para toda la landing.
          `pointer-events-none` para que el scroll y los clicks pasen al DOM. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <Canvas
          dpr={dpr}
          gl={{
            antialias: q.tier === 'high',
            powerPreference: 'high-performance',
            // El post-processing hace su propio tone mapping; aplicarlo dos
            // veces lava los neones de Mood Control.
            alpha: false,
          }}
          camera={{ fov: 45, position: [0, 0, 6], near: 0.1, far: 100 }}
          /* 'always' mientras se vea: el Núcleo respira aunque nadie scrollee.
             'never' cuando no se ve: pintar detrás de un modal opaco o con la
             pestaña en segundo plano es quemar batería para nadie. */
          frameloop={paused ? 'never' : 'always'}
        >
          <RenderGovernor paused={paused} />
          {scene}
        </Canvas>
      </div>

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

      <ScrollHUD />
    </>
  )
}
