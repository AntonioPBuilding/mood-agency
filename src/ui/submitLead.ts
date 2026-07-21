import { CTA, SUBMIT_FEEDBACK } from '@/content'

/**
 * ENVÍO DEL LEAD.
 *
 * El formulario de `Converge` valida bien, anuncia bien y no manda NADA: un
 * `setTimeout` de 900ms y a fingir. Para una landing cuyo único objetivo es
 * captar, eso no es una funcionalidad pendiente, es un agujero por el que se
 * cae el negocio entero — y encima silencioso, porque el usuario ve "Recibido".
 *
 * Este módulo es el canal de verdad. Dos modos, un solo contrato:
 *
 * - CON `VITE_LEAD_ENDPOINT` → POST real de JSON.
 * - SIN ella → el comportamiento simulado de hoy, IDÉNTICO (misma latencia),
 *   para que el desarrollo local y las previsualizaciones no dependan de tener
 *   credenciales. El resultado viene marcado con `simulated: true`: quien
 *   quiera distinguirlo, puede.
 *
 * ── DECISIONES QUE PARECEN DETALLE Y NO LO SON ───────────────────────────────
 *
 * 1. NUNCA LANZA. Devuelve un resultado tipado, siempre. Un `throw` dentro de
 *    un `onSubmit` de React que nadie captura deja el formulario clavado en
 *    "Enviando" para siempre, y el usuario no vuelve a intentarlo.
 *
 * 2. `Accept: application/json`. Formspree y compañía responden un REDIRECT 302
 *    a su página de gracias si no ve esta cabecera. Con `fetch` eso se sigue
 *    solo, acaba en un HTML ajeno y el `res.ok` te miente. Una línea, y es la
 *    diferencia entre saber si el lead llegó o no.
 *
 * 3. TIMEOUT PROPIO. `fetch` no lo trae: sin esto, con la red caída el botón se
 *    queda en "Enviando" hasta que el usuario cierra la pestaña.
 */

/** Las divisiones salen de `@/content`: si mañana hay una tercera, esto sigue. */
export type LeadDivision = (typeof CTA.divisions)[number]['id']

export interface LeadPayload {
  name: string
  email: string
  message: string
  /** `null` mientras el usuario no elija: el campo no es obligatorio. */
  division: LeadDivision | null
}

export type LeadFailure =
  /** No hubo respuesta: sin conexión, DNS, CORS, el endpoint no existe. */
  | 'network'
  /** El servidor respondió, pero con un 5xx. Reintentar tiene sentido. */
  | 'server'
  /** El servidor respondió 4xx: el envío está mal o el endpoint lo rechaza. */
  | 'rejected'
  /** Tardó más de `TIMEOUT_MS`. */
  | 'timeout'
  /** Lo canceló quien llamó (típicamente, el componente se desmontó). */
  | 'aborted'

export type LeadResult =
  | { ok: true; simulated: boolean }
  | { ok: false; reason: LeadFailure; status?: number }

/**
 * Texto de cara al usuario para cada motivo de fallo.
 *
 * La anotación `Record<LeadFailure, string>` NO es decorativa: es un candado.
 * El día que se añada un motivo nuevo a `LeadFailure`, esta línea deja de
 * compilar hasta que alguien escriba su frase en `@/content`. Sin ella, el
 * motivo nuevo llegaría a producción como `undefined` bajo el formulario.
 */
const FAILURE_MESSAGES: Record<LeadFailure, string> = SUBMIT_FEEDBACK.errors

/** Qué mostrarle a quien acaba de perder su mensaje. Nunca un "algo falló". */
export function leadErrorMessage(reason: LeadFailure): string {
  return FAILURE_MESSAGES[reason]
}

/** Misma latencia que simulaba `Converge`: el cambio no se nota en local. */
const SIMULATED_LATENCY_MS = 900

/** Más de esto y ya no es lentitud, es que no va a llegar. */
const TIMEOUT_MS = 15_000

/** ¿Hay endpoint configurado? Útil para avisar en un panel de estado. */
export function isLeadEndpointConfigured(): boolean {
  return endpoint() !== null
}

function endpoint(): string | null {
  const raw = import.meta.env.VITE_LEAD_ENDPOINT
  const value = typeof raw === 'string' ? raw.trim() : ''
  return value.length > 0 ? value : null
}

/** Espera cancelable. Resuelve `false` si la cancelaron antes de tiempo. */
function delay(ms: number, signal: AbortSignal | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false)
      return
    }

    let timer = 0
    const settle = (completed: boolean) => {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve(completed)
    }
    const onAbort = () => settle(false)

    timer = window.setTimeout(() => settle(true), ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * El cuerpo que viaja. Se envía la ETIQUETA de la división además del id: en la
 * bandeja de entrada de quien lea el lead, `"both"` no significa nada y
 * `"Las dos cosas"` sí. Un dato de tres bytes que ahorra abrir el código.
 */
function body(payload: LeadPayload) {
  const option = CTA.divisions.find((d) => d.id === payload.division)

  return {
    name: payload.name.trim(),
    email: payload.email.trim(),
    message: payload.message.trim(),
    division: payload.division,
    divisionLabel: option?.label ?? null,
    /** De qué página vino. El día que haya más de una landing, se agradece. */
    page: typeof window === 'undefined' ? null : window.location.href,
    sentAt: new Date().toISOString(),
  }
}

export async function submitLead(
  payload: LeadPayload,
  options: { signal?: AbortSignal } = {},
): Promise<LeadResult> {
  const { signal } = options
  const url = endpoint()

  /* ── Modo simulado ──────────────────────────────────────────────────────
     Es el camino por defecto en local y en cualquier despliegue sin la
     variable. El aviso va en consola y sólo en desarrollo: si sale a
     producción sin endpoint, alguien tiene que enterarse antes que el
     cliente que no recibe leads. */
  if (!url) {
    if (import.meta.env.DEV) {
      console.warn(
        '[mood] VITE_LEAD_ENDPOINT no está definida: el formulario simula el envío y NO manda el lead. Ver README.md.',
      )
    }
    const completed = await delay(SIMULATED_LATENCY_MS, signal)
    return completed ? { ok: true, simulated: true } : { ok: false, reason: 'aborted' }
  }

  /* ── Envío real ─────────────────────────────────────────────────────── */
  const controller = new AbortController()
  let timedOut = false

  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)

  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort, { once: true })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body(payload)),
      signal: controller.signal,
    })

    if (response.ok) return { ok: true, simulated: false }

    return {
      ok: false,
      reason: response.status >= 500 ? 'server' : 'rejected',
      status: response.status,
    }
  } catch {
    // El orden de las preguntas importa: nuestro timeout también aborta la
    // señal, así que hay que descartarlo ANTES de mirar la del usuario.
    if (timedOut) return { ok: false, reason: 'timeout' }
    if (signal?.aborted) return { ok: false, reason: 'aborted' }
    return { ok: false, reason: 'network' }
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
