/**
 * Presupuesto de calidad.
 *
 * "60 FPS" no es un deseo, es un presupuesto que se reparte. Detectamos el
 * músculo del dispositivo UNA vez al arranque y todo el resto de la escena pide
 * sus números acá. Nada de números mágicos sueltos por los componentes.
 *
 * Esto NO es una "versión mobile". Es la misma historia con menos polígonos.
 */

export type Tier = 'low' | 'mid' | 'high'

export interface QualityBudget {
  tier: Tier
  /** Partículas del Núcleo (el buffer más caro de la escena). */
  particles: number
  /** Segmentos de la esfera de displacement. */
  sphereDetail: number
  /**
   * DPR efectivo, calculado a partir de un PRESUPUESTO DE PÍXELES.
   *
   * Esto es lo más importante de todo el archivo. El post-processing (bloom,
   * aberración, viñeta, grano) no cuesta por polígono: cuesta POR PÍXEL, y el
   * coste escala con el CUADRADO del dpr. Un `dpr: 2` en un monitor de 1440p
   * son 14,7 millones de fragmentos por pasada, por cinco efectos, sesenta
   * veces por segundo. No hay GPU de portátil que lo sostenga.
   *
   * Por eso no fijamos un dpr: fijamos cuántos píxeles estamos dispuestos a
   * pagar y derivamos el dpr de ahí. Así un portátil con pantalla chica
   * aprovecha nitidez, y un monitor 4K no funde la GPU.
   */
  dpr: [number, number]
  /** ¿Post-processing pesado (bloom + god rays + chroma)? */
  postFx: boolean
  /** ¿Sombras en tiempo real? */
  shadows: boolean
  /**
   * Planos de humo de la división de eventos.
   *
   * ⚠ ES EL NÚMERO MÁS CARO DEL ARCHIVO, y no lo parece.
   *
   * Cada "paso" es un plano grande, semitransparente y con blending aditivo. No
   * cuesta por polígono: cuesta por OVERDRAW. Con 20 planos, cada píxel que
   * cubren se escribe veinte veces —encima de los conos de laser y de las
   * partículas, que también son aditivos— y como todos van con
   * `depthWrite: false` el GPU no puede descartar NADA: pinta hasta lo tapado.
   *
   * El humo es difuso por definición: la diferencia entre 8 capas y 20 no se
   * ve, y el coste se divide por dos y medio.
   */
  volumetricSteps: number
  /** El usuario pidió menos movimiento: la historia se cuenta igual, quieta. */
  reduced: boolean
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function detectTier(): Tier {
  if (typeof window === 'undefined') return 'mid'

  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 768

  // Un móvil potente sigue teniendo un presupuesto térmico que un desktop no tiene.
  if (coarse && small) return cores >= 8 && mem >= 6 ? 'mid' : 'low'
  if (cores <= 4 || mem <= 4) return 'mid'
  return 'high'
}

/**
 * Techo de fragmentos que aceptamos pintar por pasada, por tier.
 *
 * Referencias para calibrar: 1080p = 2,07M · 1440p = 3,69M · 4K = 8,29M.
 * Con cinco efectos a pantalla completa encima, 2,3M ya es exigente.
 */
const PIXEL_BUDGET: Record<Tier, number> = {
  /* Recortado ~22% en los tres escalones (era 1,1M / 1,8M / 2,4M).
   *
   * Es la palanca con más recorrido que queda: TODAS las pasadas de
   * post-proceso cuestan por píxel, así que un 22% menos de fragmentos es un
   * 22% menos en bloom, tone mapping, viñeta, grano Y en el propio dibujado de
   * la escena. Se paga en nitidez del canvas —que es un fondo de partículas y
   * glow difuso detrás de un scrim, donde nadie percibe el detalle que no
   * calculamos—. La tipografía es DOM y no se toca: sigue nítida siempre. */
  low: 900_000,
  mid: 1_400_000,
  high: 1_900_000,
}

/** Suelo de nitidez. Por debajo de esto la tipografía del canvas se empasta. */
const MIN_DPR = 0.75

function dprFor(tier: Tier): number {
  if (typeof window === 'undefined') return 1

  const w = window.innerWidth
  const h = window.innerHeight
  const native = Math.min(window.devicePixelRatio || 1, 2)

  // dpr² · área = presupuesto  →  dpr = √(presupuesto / área)
  const fromBudget = Math.sqrt(PIXEL_BUDGET[tier] / Math.max(w * h, 1))
  return Math.max(MIN_DPR, Math.min(native, fromBudget))
}

function resolveDpr(tier: Tier): [number, number] {
  // Devolvemos un rango degenerado: R3F no debe reescalar solo por su cuenta,
  // el presupuesto ya decidió.
  const dpr = dprFor(tier)
  return [dpr, dpr]
}

const BUDGETS: Record<Tier, Omit<QualityBudget, 'tier' | 'reduced' | 'dpr'>> = {
  low: {
    particles: 18_000,
    sphereDetail: 64,
    /* `true`, aunque sea el tier más bajo.
     *
     * Estaba en `false` por prudencia, y el efecto secundario era brutal: la
     * identidad de los tres mundos NO vive en el fondo (los tres son negro y se
     * diferencian menos de un 4%), vive en el bloom. Sin post-fx, en móvil
     * Mood Agency y Mood Creative se ven idénticos y la narrativa desaparece.
     *
     * Ahora es asumible: con el presupuesto de píxeles, `low` pinta 1,1M de
     * fragmentos, y el bloom a media resolución son 275k. En este tier
     * `Atmosphere` monta SÓLO bloom + tone mapping. */
    postFx: true,
    shadows: false,
    volumetricSteps: 0,
  },
  mid: {
    particles: 26_000,
    sphereDetail: 128,
    postFx: true,
    shadows: false,
    volumetricSteps: 5,
  },
  high: {
    // 45k, no 120k. Más partículas no es más impacto: pasado cierto umbral el
    // ojo deja de leer "constelación" y empieza a leer "ruido", y el fondo
    // compite con el texto en vez de sostenerlo. Densidad ≠ calidad.
    particles: 45_000,
    sphereDetail: 192,
    postFx: true,
    shadows: false,
    volumetricSteps: 8,
  },
}

let cached: QualityBudget | null = null

/**
 * PRESUPUESTO DE ARRANQUE. Es el TECHO: lo que se aloca una sola vez (buffers,
 * segmentos de esfera, retícula) y nunca crece. Para lo que se puede recortar
 * en caliente, mirá `liveQuality` más abajo.
 */
export function getQuality(): QualityBudget {
  if (cached) return cached
  const tier = detectTier()
  const reduced = prefersReducedMotion()
  cached = {
    tier,
    reduced,
    ...BUDGETS[tier],
    dpr: resolveDpr(tier),
    // Reduced motion recorta partículas: menos movimiento periférico, misma escena.
    particles: reduced ? Math.min(BUDGETS[tier].particles, 12_000) : BUDGETS[tier].particles,
  }
  return cached
}

/* ═══════════════════════  CALIDAD ADAPTATIVA (RUNTIME)  ══════════════════
 *
 * `detectTier()` adivina. Mira núcleos, memoria y tipo de puntero, y decide
 * antes de haber dibujado un solo triángulo. Cuando acierta, perfecto. Cuando
 * falla —una integrada de hace seis años que reporta 8 núcleos, un portátil
 * en modo ahorro, un navegador con la aceleración por software— el usuario se
 * come 45.000 partículas con blending aditivo, bloom, aberración, viñeta y
 * grano durante catorce capítulos, y NADIE se entera nunca.
 *
 * Acá medimos frames de verdad y bajamos de escalón si no damos el cuero.
 *
 * TRES REGLAS QUE GOBIERNAN TODO ESTO:
 *
 * 1. BAJAR ES BARATO, SUBIR ES ARRIESGADO. No hay subida automática. Un
 *    sistema que sube y baja oscila, y una oscilación de calidad se VE mucho
 *    más que una calidad estable un escalón por debajo. Si querés forzar un
 *    tier para probar, `window.__moodQuality.force('high')`.
 *
 * 2. NUNCA SE REALOCA NADA. Bajar de tier no reconstruye buffers ni geometrías:
 *    mueve un `drawRange`, un dpr y la lista de efectos. Reconstruir el buffer
 *    de partículas en caliente costaría un tirón de cientos de ms y perdería
 *    el muestreo del wordmark. El techo lo fija `getQuality()` al arranque.
 *
 * 3. LO QUE MIDE NO DECIDE SOLO. Un frame malo no significa nada: un GC, un
 *    alt-tab o una compilación de shader producen deltas de 200ms sin que la
 *    escena esté pidiendo auxilio. Por eso hay ventana móvil, descarte de
 *    outliers, calentamiento, sostenimiento e histéresis.
 */

/** Qué tramo de post-proceso se monta. Cada escalón es una pasada menos. */
export type PostChain = 'full' | 'mid' | 'lean'

export interface QualityLive {
  /** Tier EFECTIVO ahora mismo. Empieza igual que el de `getQuality()`. */
  tier: Tier
  /** Partículas realmente dibujadas. Siempre ≤ las alocadas al arranque. */
  particles: number
  /** DPR efectivo, escalar. Siempre ≤ el del arranque. */
  dpr: number
  /** Cadena de post-proceso activa. */
  postChain: PostChain
  /** Tamaño del punto de partícula: compensa la pérdida de densidad. */
  particleSize: number
}

const POST_CHAIN: Record<Tier, PostChain> = {
  high: 'full', // bloom + chroma + tone + viñeta + grano
  mid: 'mid',   // bloom + tone + viñeta (fuera aberración y grano)
  low: 'lean',  // bloom + tone
}

const PARTICLE_SIZE: Record<Tier, number> = { high: 1.45, mid: 1.45, low: 2.0 }

/**
 * ESTADO VIVO. Objeto mutable de módulo, mismo criterio que `scroll`: se LEE
 * dentro del loop, no se copia a estado de React ni se reemplaza el objeto.
 */
export const liveQuality: QualityLive = {
  tier: 'mid',
  particles: 0,
  dpr: 1,
  postChain: 'mid',
  particleSize: 1.45,
}

type QualityListener = (q: Readonly<QualityLive>) => void
const qualityListeners = new Set<QualityListener>()

/**
 * Suscripción de BAJA frecuencia: como mucho se emite dos veces en toda la
 * sesión (high → mid → low). NO emite al suscribirse: el valor inicial está en
 * `liveQuality` y quien monta ya lo leyó. Así, si nunca hay degradado, el
 * comportamiento es idéntico al de antes de existir este módulo.
 */
export function subscribeQuality(fn: QualityListener): () => void {
  qualityListeners.add(fn)
  return () => {
    qualityListeners.delete(fn)
  }
}

/* ─────────────────────────────  EL MUESTREO  ───────────────────────────── */

/** Frames de la media móvil. 60 ≈ 1s a pleno rendimiento. */
const WINDOW = 60
/** Frames descartados al arrancar: compilación de shaders, primer layout, fuentes. */
const WARMUP_COLD = 60
/** Frames descartados al reanudar tras una pausa o un cambio de tier. */
const WARMUP_WARM = 30
/** Un frame más largo que esto no es "la escena va lenta", es otra cosa. */
const OUTLIER_MS = 250
/** Por debajo de esto consideramos que no llegamos. */
const DOWN_FPS = 50
/** Histéresis: hasta recuperar ESTO no se reinicia el contador de sufrimiento. */
const RECOVER_FPS = 56
/** Hay que sufrir sostenidamente, no en un pico. */
const SUSTAIN_MS = 1000
/** Tras bajar, el propio cambio provoca hitches: no los midas. */
const COOLDOWN_MS = 4000

const frameMs = new Float32Array(WINDOW)
let head = 0
let filled = 0
let sum = 0
let warmup = WARMUP_COLD
let badSince = 0
let cooldownUntil = 0
/** Se apaga cuando ya no queda escalón por debajo: dejamos de medir del todo. */
let adaptive = false

/**
 * Un frame. Llamalo UNA vez por frame desde el loop de render (`useFrame`).
 * Coste: una resta, una suma, una división. Cero alocaciones.
 */
export function sampleFrame(delta: number): void {
  if (!adaptive) return

  const ms = delta * 1000
  // Descarte de outliers: no entran ni en la ventana ni en la media. Un GC o
  // una pestaña que vuelve del fondo no puede disparar una bajada de calidad.
  if (!(ms > 0) || ms > OUTLIER_MS) return

  if (warmup > 0) {
    warmup--
    return
  }

  // Ventana circular con suma incremental: la media es O(1).
  sum -= frameMs[head]
  frameMs[head] = ms
  sum += ms
  head = (head + 1) % WINDOW

  if (filled < WINDOW) {
    filled++
    return
  }

  const now = performance.now()
  if (now < cooldownUntil) return

  const fps = 1000 / (sum / WINDOW)

  if (fps < DOWN_FPS) {
    if (badSince === 0) badSince = now
    else if (now - badSince >= SUSTAIN_MS) stepDown(now)
  } else if (fps >= RECOVER_FPS) {
    // Histéresis: entre DOWN_FPS y RECOVER_FPS no se hace NADA. Sin esta zona
    // muerta, una máquina que ronda los 50fps entraría y saldría del estado
    // "mal" cada pocos frames y el cooldown no alcanzaría a estabilizarla.
    badSince = 0
  }
}

/** Reinicia la medición. Llamalo al reanudar el render tras una pausa. */
export function resetQualitySampler(): void {
  if (!adaptive) return
  frameMs.fill(0)
  head = 0
  filled = 0
  sum = 0
  badSince = 0
  warmup = WARMUP_WARM
}

function stepDown(now: number) {
  const next: Tier | null =
    liveQuality.tier === 'high' ? 'mid' : liveQuality.tier === 'mid' ? 'low' : null

  if (!next) {
    // Suelo tocado. Si sigue yendo mal ya no es cosa nuestra: apagamos la
    // medición para no gastar ni esa resta por frame.
    adaptive = false
    return
  }

  applyTier(next)
  cooldownUntil = now + COOLDOWN_MS
  resetQualitySampler()
}

function applyTier(tier: Tier) {
  const ceiling = getQuality()

  liveQuality.tier = tier
  // El techo manda SIEMPRE: no se puede dibujar más de lo que se alocó, ni
  // pintar a más dpr del que el presupuesto de píxeles autorizó al arrancar.
  liveQuality.particles = Math.min(BUDGETS[tier].particles, ceiling.particles)
  liveQuality.dpr = Math.min(dprFor(tier), ceiling.dpr[0])
  liveQuality.postChain = POST_CHAIN[tier]
  liveQuality.particleSize = PARTICLE_SIZE[tier]

  // Debug legible sin abrir el inspector de React: `<html data-quality="mid">`.
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.quality = tier
  }

  for (const fn of qualityListeners) fn(liveQuality)
}

/** Fija el tier a mano. Sólo para depurar: apaga el degradado automático. */
function force(tier: Tier) {
  adaptive = false
  applyTier(tier)
}

declare global {
  interface Window {
    /** Mirilla de depuración. No la uses desde el código de la app. */
    __moodQuality?: { live: Readonly<QualityLive>; force: (tier: Tier) => void }
  }
}

/* Inicialización: el estado vivo arranca clavado al presupuesto detectado. */
function initLiveQuality() {
  const q = getQuality()
  applyTier(q.tier)
  // Con `low` ya no hay escalón por debajo: ni medimos.
  adaptive = q.tier !== 'low'
  if (typeof window !== 'undefined') {
    window.__moodQuality = { live: liveQuality, force }
  }
}

initLiveQuality()
