/**
 * ENSAMBLAJE DE LA ESCENA.
 *
 * Punto de entrada del Canvas (lo importa App como default). Acá sólo hay tres
 * cosas: el Núcleo, la atmósfera y la dirección de cámara y luz. Ni un cálculo
 * de estado del Núcleo se escapa a este archivo.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AmbientLight, DirectionalLight, PerspectiveCamera, PointLight } from 'three'
import { clamp01, lerp, range, smoothstep } from '@/core/chapters'
import { blackoutAmount, WORLDS } from '@/core/palette'
import { getQuality } from '@/core/quality'
import { scroll } from '@/core/scrollStore'
import { Atmosphere } from './Atmosphere'
import { CRYSTAL_SLOTS } from './layout'
import { Nucleus } from './Nucleus'

/* ─────────────────────────  DIRECCIÓN DE CÁMARA  ──────────────────────── */

interface CamKey {
  p: number
  x: number
  y: number
  z: number
  fov: number
}

/**
 * La cámara es el narrador. Cada corte tiene una intención concreta:
 * acercarse para escuchar, alejarse para leer, abrir el angular para el show,
 * cerrarlo a teleobjetivo para el plano técnico de la red.
 *
 * Los tres keyframes del capítulo `plans` leen de CRYSTAL_SLOTS: la cámara y
 * los cristales comparten la misma fuente de coordenadas, así que es imposible
 * que la cámara se pare mirando al vacío si alguien retoca el layout.
 */
function buildTrack(): CamKey[] {
  const [sa, sb, sc] = CRYSTAL_SLOTS
  return [
    { p: 0.0, x: 0, y: 0, z: 6.2, fov: 45 },      // hero: plano medio, el Núcleo manda
    { p: 0.08, x: 0, y: 0.22, z: 4.5, fov: 42 },  // manifiesto: nos acercamos a escuchar
    { p: 0.16, x: 0, y: 0, z: 5.0, fov: 45 },     // tensión previa a la fractura
    { p: 0.21, x: 0, y: 0, z: 7.6, fov: 47 },     // retroceso: hay que LEER "MOOD"
    { p: 0.27, x: 0, y: 0.35, z: 8.4, fov: 54 },  // el show: gran angular, aire
    { p: 0.4, x: 0, y: -0.25, z: 6.8, fov: 56 },
    { p: 0.5, x: 0, y: 0, z: 8.0, fov: 50 },      // apagón
    { p: 0.58, x: 0, y: 0, z: 9.6, fov: 33 },     // red: teleobjetivo, plano de ingeniería
    { p: 0.66, x: 0, y: 0, z: 8.8, fov: 33 },
    { p: 0.697, x: sa, y: 0.05, z: 4.7, fov: 38 }, // Básico
    { p: 0.737, x: sb, y: 0.15, z: 4.5, fov: 38 }, // Pro
    { p: 0.777, x: sc, y: 0.3, z: 4.3, fov: 38 },  // Premium
    { p: 0.83, x: 0, y: 0, z: 8.2, fov: 38 },
    { p: 0.9, x: 0, y: 0, z: 6.4, fov: 43 },
    { p: 0.97, x: 0, y: 0, z: 2.7, fov: 52 },      // entramos en el punto de luz
    { p: 1.0, x: 0, y: 0, z: 3.6, fov: 48 },
  ]
}

/**
 * Puntero global.
 *
 * El wrapper del Canvas lleva `pointer-events-none` para que el scroll y los
 * clicks lleguen al DOM, así que el canvas NUNCA recibe eventos de puntero y
 * `state.pointer` de R3F se queda clavado en (0,0). El listener va en `window`
 * y escribe en un objeto mutable de módulo: mismo criterio que el scrollStore
 * —cero estado de React en el camino del render—.
 */
const pointer = { tx: 0, ty: 0, x: 0, y: 0 }

export function Scene() {
  const q = useMemo(() => getQuality(), [])
  const camera = useThree((s) => s.camera)
  const track = useMemo(() => buildTrack(), [])
  const time = useRef(0)

  const ambient = useRef<AmbientLight>(null)
  const key = useRef<DirectionalLight>(null)
  const fill = useRef<DirectionalLight>(null)
  const rim = useRef<PointLight>(null)

  // Sólo la cámara en perspectiva tiene `fov`. Comprobarlo una vez y no en cada
  // frame; `instanceof` estrecha el tipo sin ningún cast.
  const perspective = useMemo(
    () => (camera instanceof PerspectiveCamera ? camera : null),
    [camera],
  )

  useEffect(() => {
    if (q.reduced) return
    const onMove = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [q.reduced])

  useFrame((_, delta) => {
    time.current += delta
    const p = scroll.progress
    const blackout = blackoutAmount(p)

    /* ── Cámara ─────────────────────────────────────────────────────────── */
    if (q.reduced) {
      // "Sin cámara viajando": encuadre único que abarca los siete estados. La
      // historia se sigue contando entera, porque quien transforma es el
      // Núcleo, no el punto de vista.
      camera.position.set(0, 0, 8.6)
      camera.lookAt(0, 0, 0)
      if (perspective && Math.abs(perspective.fov - 46) > 0.01) {
        perspective.fov = 46
        perspective.updateProjectionMatrix()
      }
    } else {
      // Búsqueda lineal sobre 16 claves: más barata que mantener un índice
      // cacheado, y correcta cuando el usuario scrollea hacia arriba.
      let i = 0
      while (i < track.length - 2 && track[i + 1].p < p) i++
      const a = track[i]
      const b = track[i + 1]
      // smoothstep en vez de lineal: el contrato lo exige y además evita el
      // tirón de aceleración al cruzar cada keyframe.
      const t = smoothstep(a.p, b.p, p)

      // Paralaje del ratón, suavizado. El seguimiento directo se siente
      // nervioso; el retardo exponencial se siente como peso.
      pointer.x = lerp(pointer.x, pointer.tx, 1 - Math.exp(-6 * delta))
      pointer.y = lerp(pointer.y, pointer.ty, 1 - Math.exp(-6 * delta))

      // El paralaje se apaga cuando la cámara está haciendo su propio recorrido
      // por los cristales: dos movimientos a la vez se leen como un temblor.
      const parallax = 1 - range(p, 0.68, 0.71) * (1 - range(p, 0.8, 0.83))

      const cx = lerp(a.x, b.x, t)
      const cy = lerp(a.y, b.y, t)
      const cz = lerp(a.z, b.z, t)

      camera.position.set(
        cx + pointer.x * 0.6 * parallax,
        cy - pointer.y * 0.38 * parallax,
        cz,
      )
      camera.lookAt(cx, cy * 0.35, 0)

      // Roll: sólo durante el show. Un plano inclinado es lenguaje de
      // concierto; en Mood Net sería ruido y contradice el discurso.
      const show = range(p, 0.24, 0.3) * (1 - range(p, 0.48, 0.52))
      camera.rotation.z = Math.sin(time.current * 0.35) * 0.045 * show

      const fov = lerp(a.fov, b.fov, t)
      if (perspective && Math.abs(perspective.fov - fov) > 0.01) {
        perspective.fov = fov
        perspective.updateProjectionMatrix()
      }
    }

    /* ── Luz ────────────────────────────────────────────────────────────
       Sólo los cristales usan materiales iluminados; todo lo demás emite por
       su cuenta. Por eso hay cuatro luces y no doce: cada una está acá porque
       hace un trabajo concreto sobre esos tres objetos. */
    const roomLight = range(p, 0.53, 0.6)   // la luz de sala se enciende tras el apagón
    const lit = 1 - blackout

    if (ambient.current) {
      ambient.current.intensity = (0.18 + roomLight * 0.85) * lit
    }
    if (key.current) {
      key.current.intensity = (0.6 + roomLight * 2.2) * lit
    }
    if (fill.current) {
      fill.current.intensity = (0.2 + roomLight * 0.9) * lit
    }
    if (rim.current) {
      // Contraluz: separa los cristales del fondo. Sube con el foco en planes.
      const plans = clamp01(range(p, 0.66, 0.7) * (1 - range(p, 0.82, 0.86)))
      rim.current.intensity = (2 + plans * 14) * lit
    }
  })

  return (
    <>
      <ambientLight ref={ambient} color={WORLDS.net.ink} intensity={0.18} />
      <directionalLight ref={key} position={[4, 6, 5]} color={WORLDS.net.ink} intensity={0.6} />
      <directionalLight ref={fill} position={[-5, -2, 3]} color={WORLDS.net.accent2} intensity={0.2} />
      <pointLight ref={rim} position={[0, 0.5, -6]} color={WORLDS.net.accent} intensity={2} distance={22} decay={2} />

      <Nucleus />
      <Atmosphere />
    </>
  )
}

export default Scene
