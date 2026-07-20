/**
 * EL BUFFER COMPARTIDO.
 *
 * Un único sistema de partículas que sobrevive a toda la landing y adopta cinco
 * formas: fractura → wordmark → bola de energía → retícula → colapso. NUNCA se
 * desmonta y NUNCA se reasignan sus atributos: esa continuidad es el motivo por
 * el que el usuario sigue bajando.
 *
 * Toda la interpolación ocurre en la GPU (ver `@/shaders/particles`). Acá abajo
 * sólo se calculan los destinos —una vez, al montar— y se escriben ~18 floats
 * por frame.
 */

import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
} from 'three'
import { AGENCY } from '@/content'
import { clamp01, range } from '@/core/chapters'
import { blackoutAmount, WORLDS } from '@/core/palette'
import type { QualityLive } from '@/core/quality'
import { getQuality, liveQuality, subscribeQuality } from '@/core/quality'
import { scroll } from '@/core/scrollStore'
import { particlesFragmentShader, particlesVertexShader } from '@/shaders'
import { gridCell, makeGrid } from './layout'
import { readWorld } from './worldCache'

/* ───────────────────────────  MUESTREO DEL WORDMARK  ────────────────────── */

const WORD_CANVAS_W = 1024
const WORD_CANVAS_H = 256
/** Ancho del wordmark en unidades de mundo. */
const WORD_WIDTH = 7.2

interface WordSample {
  /** Píxeles con tinta, como índices lineales del canvas. */
  hits: Int32Array
}

/**
 * Renderiza el wordmark en un canvas 2D fuera de pantalla y devuelve los
 * píxeles con alfa suficiente.
 *
 * ¿Por qué un canvas y no una fuente 3D o un SVG parseado? Porque el canvas 2D
 * ya tiene un rasterizador con hinting y kerning dentro del navegador. Cargar
 * una typeface .json de three sería medio mega y un rasterizado peor.
 */
function sampleWordmark(text: string): WordSample {
  const empty: WordSample = { hits: new Int32Array(0) }
  if (typeof document === 'undefined') return empty

  const canvas = document.createElement('canvas')
  canvas.width = WORD_CANVAS_W
  canvas.height = WORD_CANVAS_H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return empty

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Pila de fuentes de sistema: una webfont podría no haber cargado todavía
  // cuando se monta la escena, y el muestreo saldría con la métrica de fallback.
  // Con esto el resultado es determinista desde el primer frame.
  ctx.font = `900 ${Math.round(WORD_CANVAS_H * 0.86)}px "Arial Black", "Helvetica Neue", Impact, sans-serif`
  ctx.fillText(text, WORD_CANVAS_W / 2, WORD_CANVAS_H / 2 + WORD_CANVAS_H * 0.03)

  const data = ctx.getImageData(0, 0, WORD_CANVAS_W, WORD_CANVAS_H).data
  const found: number[] = []
  for (let i = 3, px = 0; i < data.length; i += 4, px++) {
    if (data[i] > 130) found.push(px)
  }

  return { hits: Int32Array.from(found) }
}

/* ─────────────────────────────  LOS ATRIBUTOS  ──────────────────────────── */

interface ParticleBuffers {
  geometry: BufferGeometry
  count: number
}

/**
 * Permutación de escritura para que CUALQUIER PREFIJO del buffer sea una
 * muestra representativa del conjunto.
 *
 * Esto no es cosmética: el degradado adaptativo baja la cantidad de partículas
 * con `setDrawRange(0, n)`, que dibuja las `n` PRIMERAS del buffer. Si el orden
 * del buffer tuviera estructura, recortarlo cortaría la escena por la mitad en
 * vez de aclararla.
 *
 * Y la tiene: la retícula del estado 5 sale de `i % cols`, `⌊i/cols⌋ % rows`,
 * `⌊i/(cols·rows)⌋ % layers`. El índice ES la coordenada. Con 45.000 partículas
 * la caja es de 52×29×29, así que quedarse con las primeras 26.000 dejaría una
 * retícula de 17 capas de las 29: media red, cortada en seco por el eje Z.
 *
 * (El wordmark no sufre este problema —cada partícula elige un píxel de tinta
 * al azar, no en orden—, pero barajamos la partícula ENTERA y no sólo la
 * retícula: así el invariante vale para todo atributo presente y futuro, y las
 * correlaciones entre atributos —`aSide` sale de `aWord`— quedan intactas.)
 */
function writeOrder(count: number): Int32Array {
  const order = new Int32Array(count)
  for (let i = 0; i < count; i++) order[i] = i

  // Fisher-Yates. Barajado uniforme en O(n) y una sola pasada.
  for (let i = count - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }

  return order
}

function buildBuffers(count: number, word: string): ParticleBuffers {
  const position = new Float32Array(count * 3) // cáscara de la esfera
  const aWord = new Float32Array(count * 3)
  const aGrid = new Float32Array(count * 3)
  const aChaos = new Float32Array(count * 3)
  const aSeed = new Float32Array(count)
  const aSide = new Float32Array(count)

  const grid = makeGrid()
  const cell: [number, number, number] = [0, 0, 0]
  const sample = sampleWordmark(word)
  const hitCount = sample.hits.length
  const order = writeOrder(count)

  const wordScaleY = WORD_WIDTH * (WORD_CANVAS_H / WORD_CANVAS_W)

  for (let i = 0; i < count; i++) {
    // `i` es la partícula LÓGICA (recorre la retícula en orden, cubriéndola
    // entera); `slot` es dónde acaba dentro del buffer. Todos sus atributos
    // van al mismo slot: la partícula viaja completa.
    const slot = order[i]
    const i3 = slot * 3

    /* Esfera: distribución uniforme por el método de Marsaglia sobre la
       superficie, con un grosor mínimo. Usar (θ, φ) uniformes acumularía
       partículas en los polos y la fractura saldría torcida. */
    const u = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const r = 1.12 + Math.random() * 0.06
    position[i3] = s * Math.cos(theta) * r
    position[i3 + 1] = u * r
    position[i3 + 2] = s * Math.sin(theta) * r

    /* Caos: punto uniforme DENTRO de una bola. La raíz cúbica corrige el sesgo
       hacia el centro que da un radio uniforme. Además hace de vector de ruido
       determinista para media docena de efectos más. */
    const cu = Math.random() * 2 - 1
    const ct = Math.random() * Math.PI * 2
    const cs = Math.sqrt(1 - cu * cu)
    const cr = 2.35 * Math.cbrt(Math.random())
    aChaos[i3] = cs * Math.cos(ct) * cr
    aChaos[i3 + 1] = cu * cr
    aChaos[i3 + 2] = cs * Math.sin(ct) * cr

    /* Retícula: recorrido lineal del volumen. El módulo reparte de sobra
       aunque el conteo no cuadre exacto con cols·rows·layers. */
    const ix = i % grid.cols
    const iy = Math.floor(i / grid.cols) % grid.rows
    const iz = Math.floor(i / (grid.cols * grid.rows)) % grid.layers
    gridCell(grid, ix, iy, iz, cell)
    aGrid[i3] = cell[0]
    aGrid[i3 + 1] = cell[1]
    aGrid[i3 + 2] = cell[2]

    /* Wordmark. */
    let wx = 0
    let wy = 0
    if (hitCount > 0) {
      const px = sample.hits[(Math.random() * hitCount) | 0]
      // Jitter subpíxel: sin esto el wordmark se lee como una rejilla de píxeles
      // en cuanto la cámara se acerca.
      const cx = (px % WORD_CANVAS_W) + Math.random()
      const cy = Math.floor(px / WORD_CANVAS_W) + Math.random()
      wx = (cx / WORD_CANVAS_W - 0.5) * WORD_WIDTH
      wy = -(cy / WORD_CANVAS_H - 0.5) * wordScaleY
    } else {
      wx = (Math.random() - 0.5) * WORD_WIDTH
      wy = (Math.random() - 0.5) * wordScaleY
    }
    aWord[i3] = wx
    aWord[i3 + 1] = wy
    aWord[i3 + 2] = (Math.random() - 0.5) * 0.22

    aSeed[slot] = Math.random()
    // El bando sale de la posición en el wordmark: la división NO es arbitraria,
    // es literalmente por dónde se parte la palabra.
    aSide[slot] = wx < 0 ? -1 : 1
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('aWord', new BufferAttribute(aWord, 3))
  geometry.setAttribute('aGrid', new BufferAttribute(aGrid, 3))
  geometry.setAttribute('aChaos', new BufferAttribute(aChaos, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(aSeed, 1))
  geometry.setAttribute('aSide', new BufferAttribute(aSide, 1))

  return { geometry, count }
}

/* ─────────────────────────────  COMPONENTE  ────────────────────────────── */

export function Particles() {
  const q = useMemo(() => getQuality(), [])
  const gl = useThree((s) => s.gl)

  const { geometry, count } = useMemo(
    // "MOOD" sale de @/content, no escrito a mano: si mañana la agencia cambia
    // de nombre, el wordmark 3D cambia con ella.
    // El conteo es el del presupuesto de ARRANQUE: es el techo. El degradado
    // adaptativo dibuja menos, pero jamás realoca (ver más abajo).
    () => buildBuffers(q.particles, AGENCY.name.split(' ')[0].toUpperCase()),
    [q.particles],
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      /* Tamaño DESACOPLADO de la cantidad.
       *
       * Antes era `90 / cbrt(particles)`, con buena intención: mantener la
       * "tinta" total constante. Pero acopla dos cosas que deben decidirse por
       * separado, y al bajar de 120k a 45k infló cada punto un 39% — menos
       * partículas, más agobio. La densidad la gobierna la CANTIDAD; el
       * tamaño lo gobierna el TAMAÑO. Un dial, un efecto. */
      uSize: { value: liveQuality.particleSize },
      uOrbit: { value: 1 },
      uExplode: { value: 0 },
      uWord: { value: 0 },
      uSplit: { value: 0 },
      uChaos: { value: 0 },
      uGrid: { value: 0 },
      uReturn: { value: 0 },
      uCollapse: { value: 0 },
      uBeat: { value: 0 },
      uSpeed: { value: 0 },
      uOpacity: { value: 0 },
      uColorNeutral: { value: new Color(WORLDS.void.ink) },
      uColorA: { value: new Color(WORLDS.control.accent) },
      uColorB: { value: new Color(WORLDS.net.accent) },
      uColorNet: { value: new Color(WORLDS.net.accent2) },
      uFogColor: { value: new Color(WORLDS.void.bg) },
      uFogDensity: { value: WORLDS.void.fog },
    }),
    // Sin dependencias: los uniforms se crean UNA vez y se mutan. El tamaño de
    // punto ya no cuelga del tier de arranque —lo gobierna `liveQuality`, que
    // puede cambiar en caliente— así que nada de acá justifica recrearlos.
    [],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms,
        vertexShader: particlesVertexShader,
        fragmentShader: particlesFragmentShader,
        transparent: true,
        // Aditivo: donde se amontonan, queman. Es lo que hace que la bola de
        // energía tenga un núcleo y no sea una nube plana.
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [uniforms],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  /**
   * DEGRADADO SIN REALOCAR.
   *
   * Bajar de tier NO reconstruye los buffers. Reconstruirlos significaría seis
   * Float32Array nuevos, otra rasterización del wordmark en un canvas 1024x256
   * y una subida entera a la GPU: cientos de milisegundos de tirón, justo en el
   * momento en que la máquina ya estaba sufriendo. Absurdo.
   *
   * `setDrawRange` es O(1) y no toca memoria: le dice a la GPU "de estos
   * 45.000 vértices, dibujá los primeros 26.000". El barajado de `writeOrder`
   * es lo que hace que ese prefijo sea una muestra honesta y no un recorte.
   *
   * El tamaño del punto sube al bajar al tier `low`, igual que en un móvil: con
   * un 60% menos de partículas, mantenerlo daría una constelación anémica.
   */
  useEffect(() => {
    const apply = (live: Readonly<QualityLive>) => {
      geometry.setDrawRange(0, Math.min(live.particles, count))
      uniforms.uSize.value = live.particleSize
    }

    apply(liveQuality)
    return subscribeQuality(apply)
  }, [geometry, uniforms, count])

  useFrame((_, delta) => {
    const p = scroll.progress
    const u = uniforms

    u.uTime.value += delta
    u.uPixelRatio.value = gl.getPixelRatio()

    /* ── Pesos de estado. El orden de los tramos ES el guion. ───────────── */
    u.uOrbit.value = 1 - range(p, 0.15, 0.182)
    u.uExplode.value = range(p, 0.166, 0.202)
    u.uWord.value = range(p, 0.198, 0.222)
    u.uSplit.value = range(p, 0.222, 0.243)
    u.uChaos.value = range(p, 0.243, 0.292)
    u.uGrid.value = range(p, 0.545, 0.618)
    u.uReturn.value = range(p, 0.9, 0.945)
    u.uCollapse.value = range(p, 0.945, 0.988)

    /* ── Latido. No hay audio, así que lo derivamos del reloj a 124 BPM, que
          es el pulso de un set de club. Sólo late donde hay show: en la red
          sería ruido, y con reduced motion no late en absoluto. ─────────── */
    if (q.reduced) {
      u.uBeat.value = 0
    } else {
      const phase = (u.uTime.value * (124 / 60)) % 1
      const pulse = (1 - phase) ** 3
      u.uBeat.value = pulse * u.uChaos.value * (1 - u.uGrid.value)
    }

    u.uSpeed.value = scroll.speed

    /* ── Envolvente de opacidad ─────────────────────────────────────────── */
    let opacity = 0.95
    // Estado 1: polvo suspendido, discreto. Sube al estallar.
    opacity *= 0.4 + 0.6 * range(p, 0.15, 0.2)
    // Durante los planes la red se retira: los cristales tienen que mandar.
    opacity *= 1 - 0.72 * (range(p, 0.665, 0.712) - range(p, 0.845, 0.888))
    opacity *= 1 - blackoutAmount(p)
    u.uOpacity.value = clamp01(opacity)

    /* ── Atmósfera compartida con el resto de la escena ─────────────────── */
    const w = readWorld(p)
    u.uFogColor.value.copy(w.bg)
    u.uFogDensity.value = w.fog
  })

  return (
    // frustumCulled=false es obligatorio: el vertex shader mueve las partículas
    // hasta ±9 unidades del origen, así que la bounding sphere del atributo
    // `position` miente y three las descartaría justo en el colapso.
    <points frustumCulled={false} renderOrder={2}>
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </points>
  )
}
