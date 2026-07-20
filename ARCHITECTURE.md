# Mood Agency — Contrato de arquitectura

> Leé esto ANTES de escribir código. Estas reglas no son sugerencias: son lo que
> sostiene los 60fps y la coherencia narrativa de la landing.

## El concepto: EL NÚCLEO

Hay **una sola entidad 3D** que vive desde el preloader hasta el footer y nunca
se desmonta. Muta en 7 estados a lo largo del scroll. El usuario sigue bajando
porque quiere ver en qué se convierte.

| # | Estado | Capítulo |
|---|--------|----------|
| 1 | Esfera de displacement noise, respirando, iridiscente | `hero`, `manifesto` |
| 2 | Fractura → partículas | `division` |
| 3 | Partículas → wordmark `MOOD` → se parte en dos | `division` |
| 4 | Bola de energía, lasers, humo volumétrico | `controlIntro` … `blackout` |
| 5 | Red de nodos wireframe | `netIntro`, `netServices` |
| 6 | Tres cristales de complejidad creciente | `plans` |
| 7 | Colapso a un punto de luz | `converge` |

## Reglas no negociables

### 1. Un solo `<Canvas>`
Fijo, `position: fixed`, detrás del DOM. **Nunca** montes un segundo Canvas ni
desmontes el existente. Un contexto WebGL, un render loop, buffers reutilizados.

### 2. El scroll NUNCA entra por estado de React en el loop de render
```ts
// ✅ CORRECTO — dentro de la escena 3D
import { scroll } from '@/core/scrollStore'
useFrame(() => {
  mesh.current.rotation.y = scroll.progress * Math.PI * 2
})

// ❌ PROHIBIDO — un re-render por frame te come el presupuesto de 16.6ms
const [p, setP] = useState(0)
```
Para componentes DOM de baja frecuencia (cambiar el modo del cursor al entrar en
otro mundo) usá `subscribeChapter()`, que sólo emite al cambiar de capítulo.

### 3. Todas las animaciones se derivan del progreso global
Nada de timers ni de `IntersectionObserver` para lo scroll-linked. Usá los
helpers de `@/core/chapters`:
```ts
chapterProgress(scroll.progress, 'plans')  // 0→1 dentro del capítulo
range(scroll.progress, 0.42, 0.47)         // 0→1 en un tramo arbitrario
bump(scroll.progress, 0.30, 0.40)          // 0→1→0, para elementos efímeros
smoothstep(a, b, x)                        // jamás interpolación lineal
```

### 4. Presupuesto de calidad, no números mágicos
```ts
const q = getQuality()  // 'low' | 'mid' | 'high' + reduced motion
// q.particles, q.sphereDetail, q.dpr, q.postFx, q.volumetricSteps
```
Nunca hardcodees `100000` partículas. Pedíselo al presupuesto.

### 5. Cero alocaciones dentro de `useFrame`
Nada de `new Vector3()` ni `new Color()` por frame. Instanciá fuera del
componente y mutá. El GC en medio de una animación se ve como un tirón.

### 6. Colores desde tokens
`@/core/palette` para 3D, variables CSS (`var(--world-accent)`) para DOM.
Ningún hex hardcodeado en un componente.

### 7. Contenido desde `@/content`
Ningún texto escrito a mano en un `.tsx`.

### 8. Accesibilidad real
Todo interactivo es `<button>` o `<a>`, tabulable, con `:focus-visible` visible.
`prefers-reduced-motion` recorta movimiento pero **no** rompe la narrativa: el
usuario tiene que poder leer las 14 secciones igual.

## Estructura

```
src/
  core/        chapters.ts · scrollStore.ts · palette.ts · quality.ts · useSmoothScroll.ts
  scenes/      El Núcleo y sus 7 estados (dueño: agente 3D)
  shaders/     GLSL como template literals TS (dueño: agente 3D)
  ui/          Cursor, botones magnéticos, texto animado, preloader (dueño: agente UI)
  sections/    Los 14 capítulos DOM (dueño: agente secciones)
  content.ts   Todo el copy
  App.tsx      Ensamblaje
```

Cada agente es dueño de su carpeta. **No se edita la carpeta de otro.**

## Contrato de `src/ui` (interfaz pública)

Los componentes de sección importan exactamente esto. Las firmas son fijas:

```ts
// Cursor global. Se monta una vez en App.
export function Cursor(): JSX.Element

// Los interactivos declaran cómo debe reaccionar el cursor:
//   data-cursor="hover" | "drag" | "text" | "cta"

// Botón que se imanta al puntero.
export function MagneticButton(props: {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  /** Fuerza del imán en px. Default 24. */
  strength?: number
  variant?: 'solid' | 'ghost' | 'neon'
  className?: string
}): JSX.Element

// Texto que se revela por carácter/palabra/línea, atado al scroll.
export function SplitText(props: {
  children: string
  as?: keyof JSX.IntrinsicElements   // default 'span'
  by?: 'char' | 'word' | 'line'      // default 'char'
  className?: string
  /** Retardo entre unidades, en segundos. Default 0.02. */
  stagger?: number
  /** Dispara al entrar en viewport. Default true. */
  trigger?: boolean
}): JSX.Element

// Texto que se "descifra" — la voz tipográfica de Mood Net.
export function DecodeText(props: {
  children: string
  className?: string
  duration?: number
}): JSX.Element

// Preloader. Llama a onComplete cuando termina el contador.
export function Preloader(props: { onComplete: () => void }): JSX.Element

// Indicador de progreso + capítulo actual, fijo en pantalla.
export function ScrollHUD(): JSX.Element
```

## Contrato de `src/scenes`

```ts
// El Núcleo completo. Se monta UNA vez dentro del Canvas de App.
export function Nucleus(): JSX.Element

// Post-processing + niebla + fondo, dirigidos por blendWorld(scroll.progress).
export function Atmosphere(): JSX.Element
```

## Contrato de `src/sections`

Cada capítulo exporta un componente sin props que renderiza un `<section>` con
`data-chapter="<id>"` y altura tomada de `CHAPTER_MAP[id].vh * 100vh`.

```ts
export function Hero(): JSX.Element
export function Manifesto(): JSX.Element
// ... uno por cada ChapterId
```

El DOM va **encima** del Canvas (`relative z-10`), con fondo transparente salvo
que un capítulo necesite tapar la escena a propósito.
