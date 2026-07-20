/**
 * EL NÚCLEO.
 *
 * Una sola entidad que vive desde el hero hasta el footer y muta en siete
 * estados. NADA de acá dentro se desmonta nunca: se apaga con `visible` o con
 * opacidad. Montar y desmontar entre capítulos significaría recompilar shaders
 * y realojar buffers en mitad de una transición, que es exactamente el tirón
 * que estamos evitando.
 *
 *   1 · esfera de displacement, respirando, iridiscente
 *   2 · fractura                    → <Particles />
 *   3 · wordmark MOOD y división    → <Particles />
 *   4 · bola de energía             → <Particles /> + <Lasers />
 *   5 · red de nodos                → <Particles /> + <Net />
 *   6 · los tres cristales          → <Crystals />
 *   7 · colapso al punto de luz     → <Particles /> + la chispa de acá abajo
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
} from 'three'
import { clamp01, range } from '@/core/chapters'
import { blackoutAmount, WORLDS } from '@/core/palette'
import { getQuality } from '@/core/quality'
import { scroll } from '@/core/scrollStore'
import {
  sparkFragmentShader,
  sparkVertexShader,
  sphereFragmentShader,
  sphereVertexShader,
} from '@/shaders'
import { Crystals } from './Crystals'
import { Lasers } from './Lasers'
import { Net } from './Net'
import { Particles } from './Particles'
import { readWorld } from './worldCache'

/* ─────────────────────  ESTADO 1 · LA ESFERA VIVA  ─────────────────────── */

function LivingSphere() {
  const q = useMemo(() => getQuality(), [])
  const mesh = useRef<Mesh>(null)
  const time = useRef(0)

  const gfx = useMemo(() => {
    // sphereDetail sale del presupuesto: 64 segmentos en un móvil, 256 en un
    // desktop. Es el mismo objeto, no una "versión mobile".
    const geometry = new SphereGeometry(1.15, q.sphereDetail, Math.round(q.sphereDetail / 2))
    const uniforms = {
      uTime: { value: 0 },
      uTension: { value: 0 },
      uAmplitude: { value: 1 },
      uScale: { value: 1 },
      uInk: { value: new Color(WORLDS.void.ink) },
      uAccent: { value: new Color(WORLDS.void.accent3) },
      uAccent2: { value: new Color(WORLDS.void.accent2) },
      uFogColor: { value: new Color(WORLDS.void.bg) },
      uFogDensity: { value: WORLDS.void.fog },
      uOpacity: { value: 1 },
      uFilm: { value: 1 },
    }
    const material = new ShaderMaterial({
      uniforms,
      vertexShader: sphereVertexShader,
      fragmentShader: sphereFragmentShader,
      transparent: true,
      depthWrite: false,
      // La esfera se abre por las grietas: hay que ver la cara interior.
      side: DoubleSide,
    })
    return { geometry, material, uniforms }
  }, [q.sphereDetail])

  useEffect(() => {
    const g = gfx
    return () => {
      g.geometry.dispose()
      g.material.dispose()
    }
  }, [gfx])

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return

    time.current += delta
    const p = scroll.progress
    const u = gfx.uniforms

    /* La esfera desaparece al estallar. Tres curvas ligeramente desfasadas:
       primero se tensa, después encoge, y la opacidad se va la última. Si las
       tres cayeran a la vez, la fractura sería un corte y no un estallido. */
    const tension = range(p, 0.138, 0.198)
    const gone = range(p, 0.172, 0.204)
    const fade = range(p, 0.168, 0.198)

    u.uTime.value = time.current
    u.uTension.value = tension
    u.uAmplitude.value = 1 - gone
    u.uScale.value = 1 - gone * 0.85
    u.uOpacity.value = clamp01((1 - fade) * (1 - blackoutAmount(p)))
    // La iridiscencia sube con la tensión: justo antes de romperse es cuando
    // más se parece a una pompa de jabón a punto de reventar.
    u.uFilm.value = 1 + tension * 1.4

    m.visible = u.uOpacity.value > 0.006
    if (!m.visible) return

    // Rotación: mitad tiempo (está viva), mitad scroll (responde al usuario).
    if (!q.reduced) {
      m.rotation.y = time.current * 0.06 + p * 4
      m.rotation.x = Math.sin(time.current * 0.13) * 0.12
    } else {
      m.rotation.y = p * 4
    }

    const w = readWorld(p)
    u.uInk.value.copy(w.ink)
    u.uAccent.value.copy(w.accent3)
    u.uAccent2.value.copy(w.accent2)
    u.uFogColor.value.copy(w.bg)
    u.uFogDensity.value = w.fog
  })

  return (
    <mesh ref={mesh}>
      <primitive object={gfx.geometry} attach="geometry" />
      <primitive object={gfx.material} attach="material" />
    </mesh>
  )
}

/* ──────────────  ESTADO 7 · EL PUNTO DE LUZ (la convergencia)  ─────────── */

function CollapseSpark() {
  const mesh = useRef<Mesh>(null)

  const gfx = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1)
    const uniforms = {
      uColor: { value: new Color(WORLDS.net.ink) },
      uIntensity: { value: 0 },
      uScale: { value: 4.2 },
    }
    const material = new ShaderMaterial({
      uniforms,
      vertexShader: sparkVertexShader,
      fragmentShader: sparkFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
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

    const p = scroll.progress

    /* Al cuadrado: el destello no crece, ESTALLA. Y arranca un pelo antes que
       el colapso de las partículas para que se lea como causa y no como efecto
       añadido: primero prende la luz, después llegan las partículas a ella. */
    const t = range(p, 0.938, 0.985)
    const intensity = t * t

    gfx.uniforms.uIntensity.value = intensity * 1.6
    // El halo se abre a medida que quema. El tope está calculado contra el
    // último keyframe de cámara (z≈3.6, fov 48): el destello llena el encuadre
    // sin desbordarlo, y como el núcleo cae con pow(...,8) sólo quema el punto.
    gfx.uniforms.uScale.value = 0.8 + intensity * 2.4

    m.visible = intensity > 0.002
  })

  return (
    // renderOrder alto + depthTest desactivado: la chispa es luz, no un objeto.
    // Tiene que estar delante de todo lo que quede en pantalla.
    <mesh ref={mesh} visible={false} renderOrder={10}>
      <primitive object={gfx.geometry} attach="geometry" />
      <primitive object={gfx.material} attach="material" />
    </mesh>
  )
}

/* ────────────────────────────────  EL TODO  ───────────────────────────── */

export function Nucleus() {
  return (
    <group>
      <LivingSphere />
      <Particles />
      <Lasers />
      <Net />
      <Crystals />
      <CollapseSpark />
    </group>
  )
}
