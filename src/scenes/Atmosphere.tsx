/**
 * LA ATMÓSFERA.
 *
 * Fondo, niebla, post-processing y el apagón. Todo dirigido por
 * `blendWorld(scroll.progress)` a través de `readWorld()`, que es la misma
 * fuente que leen las partículas y la esfera: un solo color por frame para toda
 * la escena, cero desfase entre lo que emite el Núcleo y lo que lo rodea.
 *
 * El post-processing NO se monta si `getQuality().postFx` es false. Esa
 * condición se decide al arranque y no cambia nunca en caliente: el composer se
 * monta o no se monta, pero no aparece y desaparece a mitad de scroll.
 *
 * Lo que SÍ cambia en caliente es la CADENA de efectos, si el presupuesto
 * adaptativo baja de tier. Ver `PostFx`.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import type { EffectComposer as EffectComposerImpl } from 'postprocessing'
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  KernelSize,
  NoiseEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing'
import {
  Color,
  FogExp2,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
} from 'three'
import { clamp01, range } from '@/core/chapters'
import { blackoutAmount } from '@/core/palette'
import { getQuality, liveQuality, subscribeQuality } from '@/core/quality'
import { scroll } from '@/core/scrollStore'
import { overlayFragmentShader, overlayVertexShader } from '@/shaders'
import { readWorld } from './worldCache'

/* ────────────────────────────  FONDO Y NIEBLA  ─────────────────────────── */

function WorldBackdrop() {
  const scene = useThree((s) => s.scene)

  // Instanciados una vez y MUTADOS. Asignar `scene.background = new Color(...)`
  // por frame es basura para el GC y encima invalida el estado del renderer.
  const gfx = useMemo(() => ({ bg: new Color('#050505'), fog: new FogExp2('#050505', 0.035) }), [])

  useEffect(() => {
    scene.background = gfx.bg
    scene.fog = gfx.fog
    return () => {
      scene.background = null
      scene.fog = null
    }
  }, [scene, gfx])

  useFrame(() => {
    const p = scroll.progress
    const w = readWorld(p)
    const blackout = blackoutAmount(p)

    // El fondo también se apaga. Si sólo se oscureciera el contenido, el
    // "negro total" seguiría teniendo un fondo gris de escenario iluminado.
    const dim = 1 - blackout
    gfx.bg.copy(w.bg).multiplyScalar(dim)
    gfx.fog.color.copy(gfx.bg)

    // La niebla se espesa con la velocidad de scroll: sensación de aire
    // desplazándose. Es sutil a propósito; si se nota, está mal calibrada.
    gfx.fog.density = w.fog * (1 + scroll.speed * 0.35)
  })

  return null
}

/* ──────────────────────────────  EL APAGÓN  ───────────────────────────── */

function BlackoutVeil() {
  const mesh = useRef<Mesh>(null)

  const gfx = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1)
    const uniforms = {
      uAmount: { value: 0 },
      uColor: { value: new Color('#000000') },
    }
    const material = new ShaderMaterial({
      uniforms,
      vertexShader: overlayVertexShader,
      fragmentShader: overlayFragmentShader,
      transparent: true,
      blending: NormalBlending,
      depthWrite: false,
      depthTest: false,
    })
    return { geometry, material, uniforms }
  }, [])

  useEffect(() => {
    const g = gfx
    return () => {
      g.geometry.dispose()
      g.material.dispose()
    }
  }, [gfx])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    // La asimetría (caída seca, encendido perezoso) ya vive en blackoutAmount.
    // Acá no la tocamos: el apagón es un contrato de `@/core/palette`.
    const amount = blackoutAmount(scroll.progress)
    gfx.uniforms.uAmount.value = amount
    m.visible = amount > 0.002
  })

  return (
    <mesh ref={mesh} visible={false} frustumCulled={false} renderOrder={9999}>
      <primitive object={gfx.geometry} attach="geometry" />
      <primitive object={gfx.material} attach="material" />
    </mesh>
  )
}

/* ────────────────────────────  POST-PROCESSING  ───────────────────────── */

/** Reutilizable: `gl.getSize()` exige un Vector2 y no vamos a crear uno por frame. */
const glSize = new Vector2()

function PostFx() {
  const gl = useThree((s) => s.gl)
  const composer = useRef<EffectComposerImpl>(null)
  const lastPixelRatio = useRef(-1)

  /**
   * CADENA VIVA.
   *
   * Único estado de React de todo el archivo, y está permitido: cambia como
   * mucho dos veces en TODA la sesión (high → mid → low), nunca por frame.
   *
   * - `full`: bloom + aberración + tone + viñeta + grano.
   * - `mid` : fuera aberración y grano. La aberración es la cara de las tres
   *           (dos muestreos extra de textura a pantalla completa); grano y
   *           viñeta son ALU casi gratis, pero la viñeta se queda porque es la
   *           que sostiene el foco de sala del show.
   * - `lean`: sólo bloom + tone. Es lo que ya hacía el tier `low` en móvil: el
   *           bloom carga con la identidad de los tres mundos (los tres fondos
   *           son negro y se diferencian menos de un 4%), todo lo demás es
   *           acabado.
   */
  const [chain, setChain] = useState(() => liveQuality.postChain)

  useEffect(() => subscribeQuality((live) => setChain(live.postChain)), [])

  /**
   * Los efectos se instancian a mano y se enchufan con `<primitive>` en vez de
   * usar los wrappers `<Bloom>` / `<Vignette>` de @react-three/postprocessing.
   *
   * Motivo: esos wrappers memorizan los argumentos del constructor con
   * `JSON.stringify(props)`. Pasarles un ref para poder mutarlos por frame
   * mete el propio ref en ese stringify. Instanciándolos acá tenemos la
   * referencia directa, tipada, y mutamos uniforms sin re-renderizar nunca.
   */
  const fx = useMemo(() => {
    const bloom = new BloomEffect({
      intensity: 0.35,
      // Umbral bajo: en Mood Agency queremos que florezca casi todo. Los
      // neones de un club no tienen "highlights", son highlight de punta a
      // punta.
      luminanceThreshold: 0.2,
      luminanceSmoothing: 0.45,
      mipmapBlur: true,
      radius: 0.72,
      // MEDIUM, no LARGE. Con `mipmapBlur` el desenfoque ancho ya sale de la
      // cadena de mipmaps (barata); el kernel grande sólo agrega muestras a
      // resolución completa, que es justo lo caro. La diferencia visual es
      // mínima, la de rendimiento no.
      kernelSize: KernelSize.MEDIUM,
      // El bloom se calcula a media resolución y se reescala. Es desenfoque:
      // nadie percibe el detalle que no calculamos, y son 4x menos fragmentos.
      resolutionScale: 0.5,
    })

    const chroma = new ChromaticAberrationEffect({
      offset: new Vector2(0.0006, 0.0006),
      // Modulación radial: la aberración crece hacia los bordes, como en una
      // lente real. Uniforme en toda la pantalla se ve a videojuego de 2013.
      radialModulation: true,
      modulationOffset: 0.35,
    })

    // El EffectComposer pone `gl.toneMapping = NoToneMapping` mientras está
    // montado. Sin este efecto, los neones de Mood Agency saldrían recortados
    // a blanco puro en cuanto pasen de 1.0.
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })

    const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.5 })

    const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.OVERLAY })
    noise.blendMode.opacity.value = 0.028

    return { bloom, chroma, tone, vignette, noise }
  }, [])

  useEffect(() => {
    const e = fx
    return () => {
      e.bloom.dispose()
      e.chroma.dispose()
      e.tone.dispose()
      e.vignette.dispose()
      e.noise.dispose()
    }
  }, [fx])

  /**
   * La lista de hijos va MEMORIZADA, y no es una micro-optimización: el
   * `EffectComposer` de @react-three/postprocessing reconstruye su `EffectPass`
   * cada vez que cambia la identidad del array de hijos, y reconstruirlo
   * significa RECOMPILAR el shader fusionado de toda la cadena. Con el array
   * creado en línea, cualquier re-render del árbol —abrir un modal, volver de
   * otra pestaña— pagaría esa compilación. Sólo se reconstruye cuando cambia la
   * cadena de verdad, que es como mucho dos veces por sesión.
   *
   * Lista, no condicionales sueltos: `EffectComposer` tipa sus hijos como
   * `Element` estricto y un `false` de un `&&` no le vale. El ORDEN es el de la
   * cadena de render, así que el tone mapping va siempre al final del tramo que
   * exista.
   *
   * La `key` sale del nombre del efecto y no del índice: al cambiar de cadena
   * la lista cambia de LARGO, y con índices React emparejaría el `chroma` de la
   * cadena vieja con el `tone` de la nueva.
   */
  const chainNodes = useMemo(() => {
    const effects =
      chain === 'lean'
        ? [fx.bloom, fx.tone]
        : chain === 'mid'
          ? [fx.bloom, fx.tone, fx.vignette]
          : [fx.bloom, fx.chroma, fx.tone, fx.vignette, fx.noise]

    return effects.map((effect) => <primitive key={effect.name} object={effect} />)
  }, [chain, fx])

  useFrame(() => {
    const p = scroll.progress
    const w = readWorld(p)
    const blackout = blackoutAmount(p)
    const lit = 1 - blackout

    /* Bloom. El pico del capítulo `division` (la fractura) se suma aparte: es
       el único momento del VOID que merece quemar como si fuera Control. */
    const flash = range(p, 0.166, 0.196) * (1 - range(p, 0.2, 0.235))
    fx.bloom.intensity = (w.bloom + flash * 0.9) * lit

    /* Aberración cromática atada a la velocidad de scroll: cuanto más rápido
       baja el usuario, más se descompone la imagen. Es feedback físico, no
       decoración — la página responde a cómo la manejás.

       Factor 3 → 1.2, y la base a la mitad. Con el valor anterior cada
       partícula blanca se descomponía en un punto rojo y otro verde: en vez de
       una constelación se veía una pantalla sucia. La aberración tiene que
       sentirse, no verse. */
    const chromaAmount = w.chroma * 0.5 * (1 + scroll.speed * 1.2) * lit
    fx.chroma.offset.set(chromaAmount, chromaAmount * 0.6)

    /* Viñeta: se cierra en el show (foco de sala) y en el colapso final
       (túnel), y se abre en Mood Creative, donde queremos luz plana y honesta. */
    const show = range(p, 0.235, 0.28) * (1 - range(p, 0.5, 0.55))
    const collapse = range(p, 0.92, 0.99)
    fx.vignette.darkness = 0.45 + show * 0.35 + collapse * 0.4

    /* Grano: mucho en Control (fotografía de concierto empujada en ISO),
       casi nada en Net (render limpio). */
    fx.noise.blendMode.opacity.value = clamp01(0.02 + show * 0.05) * lit

    /* REDIMENSIONADO TRAS UN CAMBIO DE DPR.
     *
     * Cuando el presupuesto adaptativo baja el dpr, R3F llama a
     * `gl.setPixelRatio` + `gl.setSize`, pero el composer sólo se redimensiona
     * cuando cambia el tamaño CSS del canvas —y ese no cambió—. Sin esto, sus
     * render targets se quedan a la resolución vieja: el escalón de dpr no
     * ahorra un solo fragmento y encima la imagen sale reescalada.
     *
     * Una comparación de floats por frame, y se autocorrige venga el cambio de
     * donde venga (también al arrastrar la ventana a un monitor con otro dpr). */
    const ratio = gl.getPixelRatio()
    if (ratio !== lastPixelRatio.current) {
      lastPixelRatio.current = ratio
      gl.getSize(glSize)
      composer.current?.setSize(glSize.x, glSize.y)
    }
  })

  return (
    <EffectComposer
      ref={composer}
      // multisampling 0 SIEMPRE. El comentario original ya decía que con bloom
      // el MSAA es dinero tirado... y acto seguido lo activaba en tier high.
      // Un buffer multimuestreado a pantalla completa hay que resolverlo cada
      // frame, y ese resolve es de las cosas más caras del pipeline.
      multisampling={0}
      enableNormalPass={false}
    >
      {chainNodes}
    </EffectComposer>
  )
}

/* ────────────────────────────────  EL TODO  ───────────────────────────── */

export function Atmosphere() {
  const q = useMemo(() => getQuality(), [])

  return (
    <>
      <WorldBackdrop />
      <BlackoutVeil />
      {q.postFx && <PostFx />}
    </>
  )
}
