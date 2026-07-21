/**
 * CAPAS QUE TAPAN EL CANVAS.
 *
 * Cuando el modal de un proyecto está abierto, el Núcleo sigue renderizando a
 * 60fps detrás de una capa opaca a pantalla completa. Es el gasto más absurdo
 * de todo el pipeline: la GPU pinta cuarenta y cinco mil partículas con bloom
 * para nadie.
 *
 * Este módulo es la señal —y nada más que la señal— de "hay algo tapándome".
 * Quien abre la capa la declara; `App` pausa el frameloop. Mismo criterio que
 * `scrollStore`: objeto mutable de módulo, cero estado de React en el camino.
 *
 * ┌─ API PÚBLICA ────────────────────────────────────────────────────────────┐
 * │                                                                          │
 * │  import { setOverlay } from '@/core/overlayStore'                        │
 * │                                                                          │
 * │  // Al abrir / cerrar el modal:                                          │
 * │  setOverlay('roster-modal', true)                                       │
 * │  setOverlay('roster-modal', false)                                      │
 * │                                                                          │
 * │  // O, si preferís no importar nada (mismo efecto):                      │
 * │  window.dispatchEvent(new CustomEvent('mood:overlay', {                  │
 * │    detail: { id: 'roster-modal', open: true },                          │
 * │  }))                                                                     │
 * │                                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * El `id` importa: dos capas pueden solaparse (un modal encima de un menú) y
 * la escena sólo puede reanudarse cuando NO queda ninguna. Con un booleano
 * suelto, la que cierra primero reanudaría el render por debajo de la otra.
 *
 * Si nadie lo usa nunca, el conjunto queda vacío, `isOverlayOpen()` devuelve
 * `false` siempre y el comportamiento es exactamente el de hoy.
 */

const open = new Set<string>()

type OverlayListener = (open: boolean) => void
const listeners = new Set<OverlayListener>()

/** ¿Hay alguna capa tapando el Canvas ahora mismo? */
export function isOverlayOpen(): boolean {
  return open.size > 0
}

/**
 * Declara (o retira) una capa que tapa el Canvas por completo.
 *
 * Idempotente: llamarla dos veces con el mismo valor no emite nada. Sólo se
 * notifica cuando cambia el AGREGADO (de "ninguna capa" a "alguna", o al revés).
 */
export function setOverlay(id: string, isOpen: boolean): void {
  const before = open.size > 0

  if (isOpen) open.add(id)
  else open.delete(id)

  const after = open.size > 0
  if (before === after) return

  for (const fn of listeners) fn(after)
}

/**
 * Suscripción de baja frecuencia. NO emite al suscribirse: el valor actual lo
 * tenés en `isOverlayOpen()`.
 */
export function subscribeOverlay(fn: OverlayListener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/* ───────────────────────────  PUENTE POR EVENTO  ───────────────────────── */

/**
 * Alternativa sin import para quien prefiera no acoplarse al módulo. Se
 * registra una sola vez, al cargar; un `detail` mal formado se ignora en
 * silencio (esto NO puede tirar la página por un typo en otro archivo).
 */
export const OVERLAY_EVENT = 'mood:overlay'

interface OverlayEventDetail {
  id?: unknown
  open?: unknown
}

if (typeof window !== 'undefined') {
  window.addEventListener(OVERLAY_EVENT, (e: Event) => {
    const detail = (e as CustomEvent<OverlayEventDetail>).detail
    if (!detail) return
    const id = typeof detail.id === 'string' ? detail.id : 'anonymous'
    if (typeof detail.open !== 'boolean') return
    setOverlay(id, detail.open)
  })
}
