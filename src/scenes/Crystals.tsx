/**
 * ESTADO 6 · LOS TRES CRISTALES.
 *
 * El brief prohíbe mostrar cifras, así que el precio se comunica con la única
 * moneda que le queda a una escena 3D: COMPLEJIDAD VISUAL. Un cubo mate, un
 * prisma que refracta, y un cristal iridiscente con luz volumétrica y satélites
 * propios. Nadie necesita leer un número para entender cuál cuesta más.
 *
 * La complejidad NO está escrita a mano por cristal: se deriva de `plan.level`
 * de `@/content`. Si mañana aparece un cuarto plan, la escena lo entiende sola.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial } from '@react-three/drei'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  PointsMaterial,
  ShaderMaterial,
} from 'three'
import type { Plan } from '@/content'
import { PLANS } from '@/content'
import type { ChapterId } from '@/core/chapters'
import { chapterProgress, clamp01, range, smoothstep } from '@/core/chapters'
import { WORLDS } from '@/core/palette'
import { getQuality } from '@/core/quality'
import { scroll, subscribeChapter } from '@/core/scrollStore'
import {
  haloFragmentShader,
  haloVertexShader,
  sphereFragmentShader,
  sphereVertexShader,
} from '@/shaders'
import { CRYSTAL_SCALE, CRYSTAL_SLOTS } from './layout'
import { readWorld } from './worldCache'

/* ── Art direction por nivel. Índice = plan.level - 1. ───────────────────── */

/** Altura base: cuanto más caro, más levita. Literalmente está por encima. */
const BASE_HEIGHT = [-0.2, 0.05, 0.4]
/** Amplitud de la flotación. */
const FLOAT_AMP = [0.06, 0.15, 0.3]
/** Velocidad de giro en rad/s. */
const SPIN = [0.1, 0.24, 0.45]
/** Tamaño relativo. */
const SIZE = [0.82, 0.95, 1.12]

/** Capítulos a partir de los cuales conviene tener el material caro montado. */
const PREWARM_FROM: ReadonlySet<ChapterId> = new Set<ChapterId>([
  'netIntro',
  'netServices',
  'plans',
  'stack',
  'clients',
  'converge',
  'footer',
])

/** Puntos en una órbita ecuatorial con dispersión. Se calcula una vez. */
function makeOrbit(count: number, radius: number, spread: number): BufferGeometry {
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const r = radius + (Math.random() - 0.5) * spread
    pos[i * 3] = Math.cos(a) * r
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 1.6
    pos[i * 3 + 2] = Math.sin(a) * r
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  return geo
}

/* ───────────────────────────────  UN CRISTAL  ──────────────────────────── */

interface CrystalProps {
  plan: Plan
  index: number
  /** ¿Ya se puede pagar el material caro? Ver el comentario en <Crystals />. */
  heavy: boolean
}

function Crystal({ plan, index, heavy }: CrystalProps) {
  const q = useMemo(() => getQuality(), [])
  const root = useRef<Group>(null)
  const body = useRef<Mesh>(null)
  const satellites = useRef<Group>(null)
  const time = useRef(0)

  const level = plan.level
  const slot = CRYSTAL_SLOTS[index] ?? 0

  /* Material iridiscente del Premium: es EXACTAMENTE el shader de la esfera del
     estado 1. No es reciclaje perezoso, es narrativa: el plan más caro es el
     único hecho de la misma materia que el Núcleo. */
  const iridescent = useMemo(() => {
    if (level < 3) return null
    const uniforms = {
      uTime: { value: 0 },
      uTension: { value: 0 },
      uAmplitude: { value: 0.85 },
      uScale: { value: 1 },
      uInk: { value: new Color(WORLDS.net.ink) },
      uAccent: { value: new Color(WORLDS.net.accent) },
      uAccent2: { value: new Color(WORLDS.control.accent) },
      uFogColor: { value: new Color(WORLDS.net.bg) },
      uFogDensity: { value: WORLDS.net.fog },
      uOpacity: { value: 1 },
      uFilm: { value: 1.5 },
    }
    const material = new ShaderMaterial({
      uniforms,
      vertexShader: sphereVertexShader,
      fragmentShader: sphereFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    })
    return { uniforms, material }
  }, [level])

  /* Luz volumétrica: sólo el Premium. Un cono cenital con el ápice arriba. */
  const halo = useMemo(() => {
    if (level < 3) return null
    const geometry = new ConeGeometry(1.5, 4.2, 20, 1, true)
    geometry.translate(0, -4.2 / 2, 0)
    const uniforms = {
      uColor: { value: new Color(WORLDS.net.accent) },
      uTime: { value: 0 },
      uIntensity: { value: 0 },
    }
    const material = new ShaderMaterial({
      uniforms,
      vertexShader: haloVertexShader,
      fragmentShader: haloFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    })
    return { geometry, uniforms, material }
  }, [level])

  /* Satélites: el Pro tiene unos pocos, el Premium tiene una órbita entera. */
  const orbit = useMemo(() => {
    if (level < 2) return null
    const budget = Math.round((q.particles / 1000) * (level === 3 ? 6 : 2))
    const count = Math.max(40, Math.min(budget, level === 3 ? 900 : 260))
    const geometry = makeOrbit(count, level === 3 ? 1.7 : 1.35, level === 3 ? 0.7 : 0.35)
    const material = new PointsMaterial({
      color: new Color(level === 3 ? WORLDS.control.accent : WORLDS.net.accent),
      size: 0.028,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    return { geometry, material }
  }, [level, q.particles])

  useEffect(() => {
    return () => {
      iridescent?.material.dispose()
      halo?.material.dispose()
      halo?.geometry.dispose()
      orbit?.material.dispose()
      orbit?.geometry.dispose()
    }
  }, [iridescent, halo, orbit])

  useFrame((_, delta) => {
    const g = root.current
    if (!g) return

    time.current += delta
    const t = time.current
    const p = scroll.progress

    // Los cristales entran antes de que empiece el capítulo y salen después:
    // aparecer justo en el borde se lee como un pop-in.
    const presence = clamp01(range(p, 0.655, 0.702) * (1 - range(p, 0.812, 0.855)))
    g.visible = presence > 0.004
    if (!g.visible) return

    /* Foco: la cámara recorre los tres en secuencia (ver Scene.tsx, que usa
       LOS MISMOS slots). El que está enfocado crece, gira más y brilla más. */
    const local = chapterProgress(p, 'plans')
    const center = (index + 0.5) / PLANS.length
    const focus = smoothstep(0, 1, clamp01(1 - Math.abs(local - center) / 0.3))

    const idx = level - 1
    const floatAmp = q.reduced ? FLOAT_AMP[idx] * 0.35 : FLOAT_AMP[idx]

    g.position.set(
      slot,
      BASE_HEIGHT[idx] + Math.sin(t * (0.35 + level * 0.12) + index * 2.1) * floatAmp,
      0,
    )
    const scale = CRYSTAL_SCALE * SIZE[idx] * presence * (0.9 + focus * 0.18)
    g.scale.setScalar(scale)

    const mesh = body.current
    if (mesh) {
      // El giro escala con el nivel: el Básico casi ni se mueve, el Premium no
      // para. Es la misma jerarquía que las features, dicha con movimiento.
      const spin = q.reduced ? SPIN[idx] * 0.3 : SPIN[idx] * (0.7 + focus * 0.8)
      mesh.rotation.y += delta * spin
      mesh.rotation.x += delta * spin * 0.35
    }

    if (iridescent) {
      iridescent.uniforms.uTime.value = t
      // Distorsión viva: sube con el foco. Cuando la cámara lo mira, hierve.
      iridescent.uniforms.uAmplitude.value = 0.7 + focus * 0.5
      iridescent.uniforms.uFilm.value = 1.2 + focus * 0.8
      iridescent.uniforms.uOpacity.value = presence
      const w = readWorld(p)
      iridescent.uniforms.uFogColor.value.copy(w.bg)
      iridescent.uniforms.uFogDensity.value = w.fog
    }

    if (halo) {
      halo.uniforms.uTime.value = t
      halo.uniforms.uIntensity.value = presence * (0.16 + focus * 0.4)
    }

    if (orbit) {
      orbit.material.opacity = presence * (0.35 + focus * 0.5)
      const sat = satellites.current
      if (sat && !q.reduced) {
        sat.rotation.y += delta * (level === 3 ? 0.55 : 0.3)
        sat.rotation.z = Math.sin(t * 0.4) * 0.25
      }
    }
  })

  return (
    <group ref={root} visible={false}>
      {/* ── NIVEL 1 · BÁSICO ──────────────────────────────────────────────
          Un cubo. Material mate, sin transmisión, sin adornos. No es pobreza:
          es honestidad. Hace lo que dice que hace. */}
      {level === 1 && (
        <mesh ref={body} castShadow={q.shadows}>
          <boxGeometry args={[1.15, 1.15, 1.15]} />
          <meshStandardMaterial
            color={WORLDS.net.accent3}
            roughness={0.68}
            metalness={0.08}
            flatShading
          />
        </mesh>
      )}

      {/* ── NIVEL 2 · PRO ─────────────────────────────────────────────────
          Octaedro con refracción real y luz interna. */}
      {level === 2 && (
        <>
          <mesh ref={body}>
            <octahedronGeometry args={[1, 0]} />
            {heavy && q.tier !== 'low' ? (
              <MeshTransmissionMaterial
                // resolution explícita: sin ella drei usa el tamaño del canvas y
                // pagás un render de escena a pantalla completa POR FRAME.
                resolution={256}
                samples={q.tier === 'high' ? 6 : 4}
                transmission={1}
                thickness={0.85}
                roughness={0.08}
                chromaticAberration={0.35}
                anisotropicBlur={0.3}
                distortion={0.2}
                distortionScale={0.4}
                temporalDistortion={0.1}
                ior={1.6}
                backside={false}
                color={WORLDS.net.ink}
              />
            ) : (
              // Fallback de gama baja y de precalentamiento. Sigue leyéndose
              // como vidrio, pero sin el render extra de escena.
              <meshPhysicalMaterial
                color={WORLDS.net.ink}
                roughness={0.1}
                metalness={0}
                transparent
                opacity={0.42}
                iridescence={0.6}
                iridescenceIOR={1.4}
              />
            )}
          </mesh>
          {/* Luz interna: es lo que delata que hay algo DENTRO del cristal.
              decay=2 y distance acotada para que no contamine a los vecinos. */}
          <pointLight color={WORLDS.net.accent} intensity={6} distance={4.5} decay={2} />
        </>
      )}

      {/* ── NIVEL 3 · PREMIUM ─────────────────────────────────────────────
          Otra liga: iridiscencia con displacement, núcleo emisivo, órbita
          propia y luz volumétrica cenital. */}
      {level === 3 && iridescent && halo && (
        <>
          <mesh ref={body}>
            <icosahedronGeometry args={[0.92, q.tier === 'high' ? 3 : 2]} />
            <primitive object={iridescent.material} attach="material" />
          </mesh>

          {/* Núcleo interior. Sin él el cristal se lee hueco. */}
          <mesh scale={0.34}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={WORLDS.control.accent} />
          </mesh>
          <pointLight color={WORLDS.control.accent} intensity={9} distance={5} decay={2} />

          {/* Cono cenital, ápice arriba: el cristal está siempre "en foco". */}
          <mesh position={[0, 2.1, 0]}>
            <primitive object={halo.geometry} attach="geometry" />
            <primitive object={halo.material} attach="material" />
          </mesh>
        </>
      )}

      {orbit && (
        <group ref={satellites}>
          <points frustumCulled={false}>
            <primitive object={orbit.geometry} attach="geometry" />
            <primitive object={orbit.material} attach="material" />
          </points>
        </group>
      )}
    </group>
  )
}

/* ────────────────────────────  LOS TRES JUNTOS  ────────────────────────── */

export function Crystals() {
  /**
   * `MeshTransmissionMaterial` renderiza la escena entera a un FBO en CADA
   * frame, esté visible o no. Montarlo desde el arranque significaría pagar un
   * segundo pase de 120.000 partículas durante TODA la landing por un cristal
   * que no aparece hasta el 68% del scroll.
   *
   * Lo montamos al llegar a Mood Net: un único re-render en toda la sesión,
   * disparado por `subscribeChapter` —el canal de baja frecuencia que el
   * contrato de arquitectura autoriza expresamente— y con margen de sobra para
   * que el shader compile antes de que el cristal se vea. Una vez montado no se
   * desmonta jamás: volver a compilarlo al scrollear hacia arriba sería peor
   * que el problema.
   */
  const [heavy, setHeavy] = useState(false)

  useEffect(() => {
    if (heavy) return
    return subscribeChapter((s) => {
      if (PREWARM_FROM.has(s.chapter)) setHeavy(true)
    })
  }, [heavy])

  return (
    <group>
      {PLANS.map((plan, i) => (
        <Crystal key={plan.id} plan={plan} index={i} heavy={heavy} />
      ))}
    </group>
  )
}
