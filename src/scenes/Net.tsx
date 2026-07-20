/**
 * ESTADO 5 · MOOD NET.
 *
 * Cuando las partículas se ordenan en la retícula, esta capa las convierte en
 * una RED: nodos y aristas. Estética opuesta a Mood Control —cero bloom, líneas
 * de 1px, cian y azul, nada de humo—. El contraste entre los dos mundos es todo
 * el argumento de la página.
 *
 * Las aristas se calculan UNA vez, al montar. Recorrer pares de nodos por frame
 * es O(n²) y no hay ningún motivo: los nodos no se mueven entre sí.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  MeshBasicMaterial,
  Object3D,
  OctahedronGeometry,
  PointsMaterial,
} from 'three'
import { NET } from '@/content'
import { clamp01, range } from '@/core/chapters'
import { blackoutAmount, WORLDS } from '@/core/palette'
import { getQuality } from '@/core/quality'
import { scroll } from '@/core/scrollStore'

/** PRNG determinista: la red tiene que verse IGUAL en cada recarga. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const AMBIENT_COLS = 8
const AMBIENT_ROWS = 4
const AMBIENT_LAYERS = 4
const AMBIENT_EXTENT = { x: 10.2, y: 5.4, z: 5.4 }
/** Radio de vecindad para tejer aristas. Ajustado para ~3 aristas por nodo. */
const LINK_RADIUS = 2.05

/** Reutilizable para escribir matrices de instancia. Fuera del componente. */
const dummy = new Object3D()

interface NetData {
  ambientNodes: Float32Array
  ambientEdges: Float32Array
  serviceNodes: Float32Array
  serviceEdges: Float32Array
  serviceCount: number
}

function buildNet(): NetData {
  const rand = mulberry32(0x5eed)

  /* ── Nodos de servicio ────────────────────────────────────────────────
     Ocho, uno por servicio de Mood Net. La disposición es determinista (dos
     filas de cuatro, profundidad repartida con la razón áurea) para que las
     aristas de @/content se lean como un diagrama y no como una maraña. */
  const services = NET.services
  const serviceCount = services.length
  const serviceNodes = new Float32Array(serviceCount * 3)
  const indexById = new Map<string, number>()

  for (let i = 0; i < serviceCount; i++) {
    const col = i % 4
    const row = Math.floor(i / 4)
    serviceNodes[i * 3] = (col / 3 - 0.5) * 7.4
    serviceNodes[i * 3 + 1] = row === 0 ? 1.45 : -1.45
    serviceNodes[i * 3 + 2] = (((i * 0.6180339887) % 1) - 0.5) * 2.6
    indexById.set(services[i].id, i)
  }

  // Las aristas NO son decorativas: son exactamente las de NET.edges.
  const serviceEdgeList: number[] = []
  for (const [from, to] of NET.edges) {
    const a = indexById.get(from)
    const b = indexById.get(to)
    if (a === undefined || b === undefined) continue
    serviceEdgeList.push(
      serviceNodes[a * 3], serviceNodes[a * 3 + 1], serviceNodes[a * 3 + 2],
      serviceNodes[b * 3], serviceNodes[b * 3 + 1], serviceNodes[b * 3 + 2],
    )
  }

  /* ── Nodos ambiente ──────────────────────────────────────────────────
     La retícula de fondo. Con jitter: una rejilla perfecta vista desde un
     ángulo cualquiera produce moiré y parece un error de render. */
  const ambientCount = AMBIENT_COLS * AMBIENT_ROWS * AMBIENT_LAYERS
  const ambientNodes = new Float32Array(ambientCount * 3)
  let n = 0
  for (let iz = 0; iz < AMBIENT_LAYERS; iz++) {
    for (let iy = 0; iy < AMBIENT_ROWS; iy++) {
      for (let ix = 0; ix < AMBIENT_COLS; ix++) {
        ambientNodes[n * 3] =
          (ix / (AMBIENT_COLS - 1) - 0.5) * AMBIENT_EXTENT.x + (rand() - 0.5) * 0.35
        ambientNodes[n * 3 + 1] =
          (iy / (AMBIENT_ROWS - 1) - 0.5) * AMBIENT_EXTENT.y + (rand() - 0.5) * 0.35
        ambientNodes[n * 3 + 2] =
          (iz / (AMBIENT_LAYERS - 1) - 0.5) * AMBIENT_EXTENT.z + (rand() - 0.5) * 0.35
        n++
      }
    }
  }

  // O(n²) sobre 128 nodos = 8.128 comparaciones, UNA sola vez al montar.
  // Aceptable de sobra frente a un k-d tree que habría que mantener.
  const ambientEdgeList: number[] = []
  for (let i = 0; i < ambientCount; i++) {
    for (let j = i + 1; j < ambientCount; j++) {
      const dx = ambientNodes[i * 3] - ambientNodes[j * 3]
      const dy = ambientNodes[i * 3 + 1] - ambientNodes[j * 3 + 1]
      const dz = ambientNodes[i * 3 + 2] - ambientNodes[j * 3 + 2]
      if (dx * dx + dy * dy + dz * dz > LINK_RADIUS * LINK_RADIUS) continue
      ambientEdgeList.push(
        ambientNodes[i * 3], ambientNodes[i * 3 + 1], ambientNodes[i * 3 + 2],
        ambientNodes[j * 3], ambientNodes[j * 3 + 1], ambientNodes[j * 3 + 2],
      )
    }
  }

  return {
    ambientNodes,
    ambientEdges: Float32Array.from(ambientEdgeList),
    serviceNodes,
    serviceEdges: Float32Array.from(serviceEdgeList),
    serviceCount,
  }
}

export function Net() {
  const q = useMemo(() => getQuality(), [])
  const group = useRef<Group>(null)
  const nodesRef = useRef<InstancedMesh>(null)
  const time = useRef(0)

  const data = useMemo(() => buildNet(), [])

  const gfx = useMemo(() => {
    const ambientGeo = new BufferGeometry()
    ambientGeo.setAttribute('position', new BufferAttribute(data.ambientNodes, 3))

    const ambientEdgeGeo = new BufferGeometry()
    ambientEdgeGeo.setAttribute('position', new BufferAttribute(data.ambientEdges, 3))

    const serviceEdgeGeo = new BufferGeometry()
    serviceEdgeGeo.setAttribute('position', new BufferAttribute(data.serviceEdges, 3))

    const nodeGeo = new OctahedronGeometry(0.14, 0)

    // `linewidth` se ignora en WebGL en todas las plataformas: SIEMPRE 1px.
    // Que aquí eso sea exactamente lo que buscábamos es una feliz coincidencia.
    const ambientLine = new LineBasicMaterial({
      color: new Color(WORLDS.net.accent3),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const serviceLine = new LineBasicMaterial({
      color: new Color(WORLDS.net.accent),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const nodePoints = new PointsMaterial({
      color: new Color(WORLDS.net.accent2),
      size: 0.055,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const nodeMat = new MeshBasicMaterial({
      color: new Color(WORLDS.net.accent),
      wireframe: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })

    return {
      ambientGeo,
      ambientEdgeGeo,
      serviceEdgeGeo,
      nodeGeo,
      ambientLine,
      serviceLine,
      nodePoints,
      nodeMat,
    }
  }, [data])

  /* Matrices de instancia: se escriben al montar. Si sólo se escribieran en el
     bucle de animación, con `prefers-reduced-motion` los ocho nodos quedarían
     apilados en el origen con la matriz identidad. */
  useEffect(() => {
    const nodes = nodesRef.current
    if (!nodes) return
    for (let i = 0; i < data.serviceCount; i++) {
      dummy.position.set(
        data.serviceNodes[i * 3],
        data.serviceNodes[i * 3 + 1],
        data.serviceNodes[i * 3 + 2],
      )
      dummy.rotation.set(0, i * 0.7, 0.4)
      dummy.updateMatrix()
      nodes.setMatrixAt(i, dummy.matrix)
    }
    nodes.instanceMatrix.needsUpdate = true
  }, [data])

  useEffect(() => {
    const g = gfx
    return () => {
      g.ambientGeo.dispose()
      g.ambientEdgeGeo.dispose()
      g.serviceEdgeGeo.dispose()
      g.nodeGeo.dispose()
      g.ambientLine.dispose()
      g.serviceLine.dispose()
      g.nodePoints.dispose()
      g.nodeMat.dispose()
    }
  }, [gfx])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return

    time.current += delta
    const p = scroll.progress

    // La red entra cuando se enciende la luz de sala y se retira cuando mandan
    // los cristales. Vuelve para el cierre y desaparece en la convergencia.
    let presence = range(p, 0.535, 0.605)
    presence *= 1 - 0.85 * (range(p, 0.665, 0.712) - range(p, 0.845, 0.888))
    presence *= 1 - range(p, 0.885, 0.915)
    presence *= 1 - blackoutAmount(p)
    presence = clamp01(presence)

    // Ahorro real: durante ~70% de la landing esto son cuatro draw calls que no
    // se ven. `visible` las saca del render sin desmontar nada.
    g.visible = presence > 0.005
    if (!g.visible) return

    gfx.ambientLine.opacity = presence * 0.16
    gfx.serviceLine.opacity = presence * 0.7
    gfx.nodePoints.opacity = presence * 0.75
    gfx.nodeMat.opacity = presence * 0.9

    if (q.reduced) return

    // Paralaje mínimo, derivado del SCROLL y no de un timer: la red no deriva
    // sola, responde a que el usuario avanza. Mood Net no hace nada gratis.
    g.rotation.y = Math.sin(p * 9) * 0.09

    const nodes = nodesRef.current
    if (!nodes) return
    for (let i = 0; i < data.serviceCount; i++) {
      dummy.position.set(
        data.serviceNodes[i * 3],
        data.serviceNodes[i * 3 + 1],
        data.serviceNodes[i * 3 + 2],
      )
      dummy.rotation.set(0, i * 0.7 + time.current * 0.22, 0.4)
      dummy.updateMatrix()
      nodes.setMatrixAt(i, dummy.matrix)
    }
    nodes.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={group}>
      <points>
        <primitive object={gfx.ambientGeo} attach="geometry" />
        <primitive object={gfx.nodePoints} attach="material" />
      </points>

      <lineSegments>
        <primitive object={gfx.ambientEdgeGeo} attach="geometry" />
        <primitive object={gfx.ambientLine} attach="material" />
      </lineSegments>

      <lineSegments>
        <primitive object={gfx.serviceEdgeGeo} attach="geometry" />
        <primitive object={gfx.serviceLine} attach="material" />
      </lineSegments>

      {/* Los ocho servicios, como octaedros: la forma más "técnica" que existe
          con seis vértices. Un solo draw call para los ocho. */}
      <instancedMesh
        ref={nodesRef}
        args={[gfx.nodeGeo, gfx.nodeMat, data.serviceCount]}
        frustumCulled={false}
      />
    </group>
  )
}
