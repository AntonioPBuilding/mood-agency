/**
 * ESTADO 4 · MUNDO 'control' = EVENTOS (marca Mood Agency) — el show.
 *
 * Láseres que barren, focos que giran, humo que no se está quieto y un apagón
 * que corta la corriente. Todo dirigido por el scroll salvo el latido, que es
 * lo único que tiene derecho a existir por su cuenta: un show no deja de sonar
 * porque el público se quede quieto.
 *
 * SOBRE LAS LUCES REALES: no hay ni una. Durante Mood Agency lo único en
 * pantalla son partículas y haces, y ambos usan ShaderMaterial crudo —material
 * sin iluminar—. Un `spotLight` acá sería una luz que no ilumina nada y que
 * igual paga su coste en cada programa. Lo que el ojo lee como "foco" es el
 * cono aditivo; lo que lee como "gira" es su matriz. Añadir la luz real sería
 * cargo cult.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
} from 'three'
import { clamp01, range } from '@/core/chapters'
import { blackoutAmount, WORLDS } from '@/core/palette'
import { getQuality } from '@/core/quality'
import { scroll } from '@/core/scrollStore'
import {
  beamFragmentShader,
  beamVertexShader,
  smokeFragmentShader,
  smokeVertexShader,
} from '@/shaders'

const BEAM_LENGTH = 26
const BEAM_RADIUS = 0.19

/** Objetos de trabajo. Fuera del componente: cero alocaciones en el bucle. */
const dummy = new Object3D()
const tmpColor = new Color()

function beamCount(tier: 'low' | 'mid' | 'high'): number {
  // No sale de un presupuesto propio porque los haces no son geometría pesada
  // (un cono de 10 lados) sino overdraw aditivo: lo que se paga son píxeles.
  //
  // Recortado de 4/8/12 a 3/5/7. Doce conos aditivos cruzándose sobre 45.000
  // partículas y ocho planos de humo saturan el fill rate justo en el capítulo
  // más cargado de la landing. A partir de siete, cada haz nuevo aporta menos
  // luz visible que coste: se superponen tanto que el ojo lee "hay lasers", no
  // "hay doce lasers".
  if (tier === 'low') return 3
  if (tier === 'mid') return 5
  return 7
}

interface BeamRig {
  x: number
  y: number
  z: number
  /** Velocidad y fase del barrido. */
  speed: number
  phase: number
  /** Apertura del barrido en radianes. */
  swing: number
}

function buildRig(count: number): BeamRig[] {
  const rig: BeamRig[] = []
  for (let i = 0; i < count; i++) {
    // Truss: dos filas de focos colgadas arriba, alternando profundidad. Es
    // exactamente cómo se cuelga una parrilla de verdad.
    const t = count > 1 ? i / (count - 1) : 0.5
    rig.push({
      x: (t - 0.5) * 11,
      y: 5.2 + (i % 2) * 0.7,
      z: i % 2 === 0 ? -2.6 : 2.2,
      speed: 0.35 + (i % 5) * 0.13,
      phase: i * 1.7,
      swing: 0.45 + (i % 3) * 0.22,
    })
  }
  return rig
}

export function Lasers() {
  const q = useMemo(() => getQuality(), [])
  const group = useRef<Group>(null)
  const beams = useRef<InstancedMesh>(null)
  const smoke = useRef<InstancedMesh>(null)
  const time = useRef(0)

  const count = useMemo(() => beamCount(q.tier), [q.tier])
  const rig = useMemo(() => buildRig(count), [count])
  const smokeCount = q.volumetricSteps

  const gfx = useMemo(() => {
    /* Cono HUECO (openEnded) con el ápice trasladado al origen: así la matriz
       de instancia rota el haz alrededor de la boca del foco, que es como gira
       una cabeza móvil de verdad. Con el ápice en el centro giraría como un
       molinete y se notaría al instante. */
    const beamGeo = new ConeGeometry(BEAM_RADIUS, BEAM_LENGTH, 10, 1, true)
    beamGeo.translate(0, -BEAM_LENGTH / 2, 0)

    const colors = new Float32Array(count * 3)
    const intensities = new Float32Array(count)
    const palette = [WORLDS.control.accent, WORLDS.control.accent2, WORLDS.control.accent3]
    for (let i = 0; i < count; i++) {
      tmpColor.set(palette[i % palette.length])
      colors[i * 3] = tmpColor.r
      colors[i * 3 + 1] = tmpColor.g
      colors[i * 3 + 2] = tmpColor.b
      intensities[i] = 0
    }
    const intensityAttr = new InstancedBufferAttribute(intensities, 1)
    beamGeo.setAttribute('aColor', new InstancedBufferAttribute(colors, 3))
    beamGeo.setAttribute('aIntensity', intensityAttr)

    const beamUniforms = { uTime: { value: 0 } }
    const beamMat = new ShaderMaterial({
      uniforms: beamUniforms,
      vertexShader: beamVertexShader,
      fragmentShader: beamFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      // DoubleSide: el haz es hueco, hay que ver la pared de atrás para que
      // sume volumen. Con FrontSide queda la mitad de denso.
      side: DoubleSide,
    })

    /* Humo: quads grandes encarados a cámara. La orientación se resuelve en el
       vertex shader (ver smokeVertexShader), así que la CPU no toca estas
       matrices NUNCA después de montarlas. */
    const smokeGeo = new PlaneGeometry(1, 1)
    const smokeSeeds = new Float32Array(Math.max(smokeCount, 1))
    for (let i = 0; i < smokeSeeds.length; i++) smokeSeeds[i] = Math.random()
    smokeGeo.setAttribute('aSeed', new InstancedBufferAttribute(smokeSeeds, 1))

    const smokeUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uScale: { value: 7.5 },
      uColor: { value: new Color(WORLDS.control.accent2) },
    }
    const smokeMat = new ShaderMaterial({
      uniforms: smokeUniforms,
      vertexShader: smokeVertexShader,
      fragmentShader: smokeFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })

    return {
      beamGeo,
      beamMat,
      beamUniforms,
      intensityAttr,
      // Guardamos el Float32Array además del atributo: `attribute.array` está
      // tipado como TypedArray genérico y escribir en él obligaría a un cast en
      // el bucle. Cero castings en el camino caliente.
      intensityData: intensities,
      smokeGeo,
      smokeMat,
      smokeUniforms,
    }
  }, [count, smokeCount])

  /* Matrices base. Los haces se reorientan cada frame; el humo, nunca. */
  useEffect(() => {
    const s = smoke.current
    if (!s) return
    for (let i = 0; i < smokeCount; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 5,
        // Repartido en profundidad: capas que se cruzan es lo que da la
        // sensación de volumen sin volumetría.
        -4 + (i / Math.max(smokeCount - 1, 1)) * 8,
      )
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      s.setMatrixAt(i, dummy.matrix)
    }
    s.instanceMatrix.needsUpdate = true
  }, [smokeCount])

  useEffect(() => {
    const g = gfx
    return () => {
      g.beamGeo.dispose()
      g.beamMat.dispose()
      g.smokeGeo.dispose()
      g.smokeMat.dispose()
    }
  }, [gfx])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return

    time.current += delta
    const t = time.current
    const p = scroll.progress

    gfx.beamUniforms.uTime.value = t
    gfx.smokeUniforms.uTime.value = t

    /* ── Presencia del show ──────────────────────────────────────────────
       Entra con Mood Agency y NO vuelve después del apagón: ese corte es
       irreversible a propósito, es el punto de giro de la landing. */
    const arrive = range(p, 0.232, 0.278)
    const kill = range(p, 0.492, 0.522)
    const presence = clamp01(arrive * (1 - kill))

    g.visible = presence > 0.004
    if (!g.visible) return

    const blackout = blackoutAmount(p)

    /* ── Latido a 124 BPM ────────────────────────────────────────────────
       Caída cúbica: golpe seco y cola corta, como un kick comprimido. */
    let beat = 1
    if (!q.reduced) {
      const phase = (t * (124 / 60)) % 1
      beat = 0.55 + 0.45 * (1 - phase) ** 3
    }

    /* ── Haces ───────────────────────────────────────────────────────────── */
    const mesh = beams.current
    if (mesh) {
      const intensities = gfx.intensityData
      for (let i = 0; i < count; i++) {
        const r = rig[i]

        dummy.position.set(r.x, r.y, r.z)
        // Barrido: un seno por eje con velocidades primas entre sí. Si los dos
        // ejes compartieran periodo, el haz dibujaría una recta y no un cono.
        const swing = q.reduced ? 0 : 1
        dummy.rotation.set(
          Math.sin(t * r.speed + r.phase) * r.swing * swing,
          Math.cos(t * r.speed * 0.61 + r.phase) * 0.35 * swing,
          Math.sin(t * r.speed * 0.83 + r.phase * 1.3) * r.swing * swing,
        )
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)

        /* EL APAGÓN, uno a uno. `kill` avanza 0 → 1 en el tramo de corte y cada
           haz tiene su propio umbral escalonado: se van muriendo en cascada en
           vez de desaparecer todos en el mismo frame. Ese detalle es lo que
           hace que se lea como "cortaron la corriente" y no como un fundido. */
        const stagger = clamp01((kill - (i / count) * 0.55) / 0.45)

        intensities[i] = presence * (1 - stagger) * beat * (0.55 + (i % 3) * 0.2)
      }
      mesh.instanceMatrix.needsUpdate = true
      gfx.intensityAttr.needsUpdate = true
    }

    /* ── Humo ────────────────────────────────────────────────────────────
       Se disipa más lento que los láseres: la luz se corta, el humo se queda
       flotando unos segundos. Esa diferencia es física y se nota. */
    const smokeFade = range(p, 0.495, 0.545)
    gfx.smokeUniforms.uOpacity.value =
      clamp01(range(p, 0.238, 0.29) * (1 - smokeFade) * (1 - blackout)) * 0.16
  })

  return (
    <group ref={group}>
      <instancedMesh
        ref={beams}
        args={[gfx.beamGeo, gfx.beamMat, count]}
        frustumCulled={false}
        renderOrder={1}
      />
      {smokeCount > 0 && (
        <instancedMesh
          ref={smoke}
          args={[gfx.smokeGeo, gfx.smokeMat, smokeCount]}
          frustumCulled={false}
          renderOrder={0}
        />
      )}
    </group>
  )
}
