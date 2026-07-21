/**
 * EL NÚCLEO — mapa narrativo.
 *
 * Toda la landing es UN timeline. Cada capítulo ocupa un rango del progreso
 * global de scroll (0 → 1). Tanto el DOM como la escena 3D leen de acá:
 * una sola fuente de verdad, cero desincronización.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ `control` Y `net` SON IDS TÉCNICOS, NO MARCAS. Leer antes de renombrar nada.
 *
 * Los ids de mundo y los `ChapterId` que salen de ellos (`controlIntro`,
 * `controlServices`, `netIntro`, `netServices`) son anteriores a los nombres
 * definitivos de las divisiones y ya NO coinciden con ellos:
 *
 *   'control' / `controlIntro` / `controlServices`
 *        →  mundo de EVENTOS      →  marca MOOD AGENCY      →  `EVENTS` de @/content
 *
 *   'net' / `netIntro` / `netServices`
 *        →  mundo de TECNOLOGÍA   →  marca MOOD CREATIVE    →  `TECH` de @/content
 *
 * Y el que engaña a todo el mundo: la marca madre se llama MOOD CONTROL y NO es
 * el mundo `'control'`. El mundo `'control'` es Mood Agency, una de sus dos
 * divisiones. La marca madre es `BRAND` en `@/content` y no tiene mundo propio:
 * es la landing entera.
 *
 * Se quedan así a propósito: estos ids son la clave con la que el DOM, los 7
 * estados del Núcleo (`@/scenes`), la paleta (`@/core/palette`) y los shaders se
 * encuentran entre sí. Renombrarlos es tocar la mitad del proyecto para que el
 * visitante no note nada. Lo visible sale de `@/content`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type WorldId = 'void' | 'control' | 'net'

export type ChapterId =
  | 'hero'
  | 'manifesto'
  | 'division'
  | 'controlIntro'
  | 'controlServices'
  | 'gallery'
  | 'blackout'
  | 'netIntro'
  | 'netServices'
  | 'plans'
  | 'stack'
  | 'clients'
  | 'converge'
  | 'footer'

export interface Chapter {
  id: ChapterId
  /** Inicio en progreso global normalizado (0-1). */
  start: number
  /** Fin en progreso global normalizado (0-1). */
  end: number
  /** Mundo cromático activo durante el capítulo. */
  world: WorldId
  /** Alto de la sección en viewports. Define el ritmo del scroll. */
  vh: number
}

/**
 * ⚠ DOS FUENTES DE VERDAD PARA LO MISMO — leer antes de tocar un solo número.
 *
 * `start`/`end` y `vh` describen el MISMO hecho —cuánto dura un capítulo— por
 * dos caminos distintos: el DOM se coloca con `vh` acumulados y la coreografía
 * 3D se dispara con `start`/`end`. No hay nada que los mantenga sincronizados,
 * así que sólo coinciden mientras alguien los recalcule a mano. Hoy NO coinciden.
 *
 * ── 1. DE DÓNDE SALIÓ LA TABLA ──────────────────────────────────────────────
 *
 * Los 14 pares `start`/`end` son exactamente `vh acumulado / 25.1`, redondeado a
 * dos decimales. Coinciden los 14, no 13: no es una coincidencia, es el origen.
 * 25.1 era el `TOTAL_VH` de cuando `converge` medía 2.0 viewports.
 *
 * Al bajar `converge` a 1.5 (ver el comentario de su línea) `TOTAL_VH` pasó a
 * 24.6 y la tabla se quedó como estaba. Ese medio viewport es TODO el desfase.
 *
 * ── 2. CUÁNTO SE DESVÍA, EN NÚMEROS ─────────────────────────────────────────
 *
 * Repartiendo el timeline en proporción a los `vh` reales (`cum / 24.6`), la
 * frontera declarada de cada capítulo se adelanta respecto de la real:
 *
 *   hero +0.13pp · manifesto +0.26 · division +0.39 · controlIntro +0.49
 *   controlServices +0.65 · gallery +0.78 · blackout +0.88 · netIntro +0.98
 *   netServices +1.11 · plans +1.30 · stack +1.40 · clients +1.46
 *   converge −0.44 · footer 0.00
 *
 * Es una deriva ACUMULATIVA y uniforme —cada capítulo dura un 1.6% menos de lo
 * que declara— que llega a su máximo en `clients` (+1.46 puntos porcentuales) y
 * se cierra sola al final. Por debajo de 1.5pp sobre un timeline de 24 viewports
 * son ~35px de scroll: no se ve. NO SE TOCA.
 *
 * ── 3. LA EXCEPCIÓN: `converge` ─────────────────────────────────────────────
 *
 * La deriva de arriba es del 1.6% en TODOS los capítulos menos dos:
 *
 *   converge → declara 8.00% del timeline y ocupa 6.10%  →  +31% relativo
 *   footer   → declara 2.00% del timeline y ocupa 2.44%  →  −18% relativo
 *
 * `converge` es el único desfase grave del archivo (>8%): la escena estira el
 * colapso de partículas un tercio más de lo que dura la sección en pantalla.
 * En puntos absolutos cuesta poco (−0.44pp) porque es el penúltimo capítulo y
 * el error se compensa contra el final del documento, pero el capítulo entero
 * corre a otra velocidad que su DOM. Queda REPORTADO, no corregido: la escena
 * está calibrada contra estos valores y decide un humano.
 *
 * ── 4. EL OTRO DESFASE, QUE NO ES DE ESTA TABLA ─────────────────────────────
 *
 * Hay un segundo error, más grande, y ninguna de las dos columnas lo ve: el
 * progreso de Lenis es `scroll / limit`, y `limit` es `alto del documento −
 * viewport`, o sea 23.6 viewports, no 24.6. Repartir sobre 24.6 supone que se
 * llega a `p = 1` con el final del documento en el BORDE SUPERIOR de la
 * pantalla, y se llega un viewport antes.
 *
 * Contra el progreso REAL (`cum / 23.6`) la desviación crece hasta +5.34pp en
 * `clients`. Traducido a lo que se ve: cuando la escena cree estar entrando en
 * `blackout` (p=0.48) arriba del viewport todavía está `gallery`; cuando cree
 * entrar en `converge` (p=0.90) arriba todavía está `stack`.
 *
 * Que la landing funcione igual no es casualidad: DOM y escena leen los MISMOS
 * `start`/`end`, así que están desfasados en bloque respecto al documento pero
 * perfectamente sincronizados entre ellos, que es lo que el ojo juzga. Por eso
 * tampoco se toca — corregirlo sin recalibrar la escena rompería más de lo que
 * arregla.
 *
 * ── 5. SI ALGÚN DÍA SE ARREGLA ──────────────────────────────────────────────
 *
 * El arreglo de verdad no es retocar números: es borrar `start`/`end` y
 * derivarlos de los `vh` (y de `limit`) en tiempo de módulo. Mientras las dos
 * columnas convivan, CUALQUIER cambio de `vh` obliga a recalcular la tabla
 * entera a mano o la deriva vuelve a crecer.
 */
export const CHAPTERS: readonly Chapter[] = [
  { id: 'hero', start: 0.0, end: 0.08, world: 'void', vh: 2.0 },
  { id: 'manifesto', start: 0.08, end: 0.16, world: 'void', vh: 2.0 },
  { id: 'division', start: 0.16, end: 0.24, world: 'void', vh: 2.0 },
  { id: 'controlIntro', start: 0.24, end: 0.3, world: 'control', vh: 1.5 },
  { id: 'controlServices', start: 0.3, end: 0.4, world: 'control', vh: 2.5 },
  { id: 'gallery', start: 0.4, end: 0.48, world: 'control', vh: 2.0 },
  { id: 'blackout', start: 0.48, end: 0.54, world: 'control', vh: 1.5 },
  { id: 'netIntro', start: 0.54, end: 0.6, world: 'net', vh: 1.5 },
  { id: 'netServices', start: 0.6, end: 0.68, world: 'net', vh: 2.0 },
  { id: 'plans', start: 0.68, end: 0.8, world: 'net', vh: 3.0 },
  { id: 'stack', start: 0.8, end: 0.86, world: 'net', vh: 1.5 },
  { id: 'clients', start: 0.86, end: 0.9, world: 'net', vh: 1.0 },
  // 1.5, no 2.0: con el contenido alineado arriba, dos viewports dejaban medio
  // viewport muerto debajo del formulario.
  { id: 'converge', start: 0.9, end: 0.98, world: 'net', vh: 1.5 },
  { id: 'footer', start: 0.98, end: 1.0, world: 'net', vh: 0.6 },
] as const

export const CHAPTER_MAP = Object.fromEntries(
  CHAPTERS.map((c) => [c.id, c]),
) as Record<ChapterId, Chapter>

/** Clamp a [0,1]. */
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Interpolación lineal. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Progreso LOCAL dentro de un capítulo (0 antes de entrar, 1 al salir).
 * Es la primitiva que usan todas las animaciones scroll-linked.
 */
export function chapterProgress(globalProgress: number, id: ChapterId): number {
  const { start, end } = CHAPTER_MAP[id]
  return clamp01((globalProgress - start) / (end - start))
}

/**
 * Rampa suave dentro de un rango arbitrario del timeline global.
 * Útil para solapar animaciones entre capítulos vecinos.
 */
export function range(globalProgress: number, from: number, to: number): number {
  return clamp01((globalProgress - from) / (to - from))
}

/** Curva de entrada/salida: 0 → 1 → 0 dentro del rango. Para elementos efímeros. */
export function bump(globalProgress: number, from: number, to: number): number {
  const t = range(globalProgress, from, to)
  return Math.sin(t * Math.PI)
}

/** smoothstep de GLSL, en JS. Nada de movimiento lineal en la escena. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Altura total del documento, en viewports. */
export const TOTAL_VH = CHAPTERS.reduce((sum, c) => sum + c.vh, 0)
