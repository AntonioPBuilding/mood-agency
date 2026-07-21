import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { CONTACT_PANEL, CTA, FORM, SITE } from '@/content'
import { getQuality } from '@/core/quality'
import { SplitText, leadErrorMessage, submitLead } from '@/ui'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
import { CONTROL_RED, EASE_OUT_EXPO, INK, NET_CYAN, NET_GREY, alpha, chapterMeta } from './_tokens'

/**
 * CONVERGE — el CTA final. El ÚNICO elemento de la landing que convierte.
 *
 * ── POR QUÉ ESTE CAPÍTULO NO SIGUE LA REGLA ESTÉTICA DE LOS DEMÁS ────────────
 *
 * En el resto de la landing la opacidad baja es una decisión de dirección de
 * arte: un titular al 45% se lee igual porque es enorme y porque nadie tiene que
 * INTERACTUAR con él. Acá no. Un label al 45%, un placeholder al 25% y una línea
 * inferior al 22% sobre un canvas de partículas en movimiento obligan al usuario
 * a ADIVINAR dónde hacer click, y lo que se pierde cuando adivina mal no es
 * elegancia: es el presupuesto que el cliente no recibe.
 *
 * Por eso este capítulo —y sólo éste— sube contraste y le pone una SUPERFICIE al
 * formulario. No es una barrida global de legibilidad: fuera de este archivo no
 * cambia una sola opacidad.
 *
 * ── LA SUPERFICIE ────────────────────────────────────────────────────────────
 *
 * Un panel técnico del mundo `net` (Mood Creative): fondo casi opaco del propio
 * `--color-net-bg`, retícula de 1px, borde fino cian y marcas de esquina. Encaja
 * con la dirección de arte —es el mismo idioma que `NetIntro`— y a la vez cumple
 * la función: TAPA las partículas, así que el texto deja de competir con ruido.
 *
 * ⚠ Sin `backdrop-filter`. Un filtro de fondo recompone en CADA frame que dibuja
 * el Núcleo, y esta sección ya va justa. Opacidad alta sobre color plano cuesta
 * cero y separa igual de bien.
 *
 * ── POR QUÉ LOS ESTADOS DE CAMPO VAN POR ESTADO DE REACT Y NO POR `peer-*` ───
 *
 * Los colores salen de `color-mix` sobre tokens, o sea de estilos inline, y un
 * estilo inline no tiene variantes `hover:`/`focus:`. Se podría puentear con
 * custom properties + clases arbitrarias, pero acá el indicador de foco es un
 * requisito de accesibilidad, no un adorno: prefiero que dependa de estado
 * explícito y no de que el escáner de Tailwind genere la clase correcta.
 *
 * Los inputs llevan `outline: none`, así que el foco lo dibujamos nosotros:
 * borde cian + anillo de 2px. Si eso desaparece, el campo deja de ser usable con
 * teclado — es la regla que ninguna decisión estética puede tocar.
 */

type DivisionId = (typeof CTA.divisions)[number]['id']
type FieldId = 'name' | 'email' | 'message'
type Status = 'idle' | 'sending' | 'sent'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const META = chapterMeta('converge')

/** Fondo del propio mundo `net`, no exportado en `_tokens`: se usa la variable. */
const NET_BG = 'var(--color-net-bg)'

/**
 * El panel. 96% de opacidad sobre el fondo del mundo: las partículas quedan
 * detrás, no encima del texto. El 4% que queda es lo justo para que el panel no
 * parezca un recorte pegado y siga respirando con la escena.
 */
const PANEL_STYLE: CSSProperties = {
  backgroundColor: alpha(NET_BG, 96),
  borderColor: alpha(NET_CYAN, 24),
  backgroundImage: [
    `linear-gradient(155deg, ${alpha(NET_CYAN, 6)}, transparent 60%)`,
    `linear-gradient(to right, ${alpha(NET_GREY, 7)} 1px, transparent 1px)`,
    `linear-gradient(to bottom, ${alpha(NET_GREY, 7)} 1px, transparent 1px)`,
  ].join(', '),
  backgroundSize: '100% 100%, 48px 48px, 48px 48px',
  boxShadow: `0 40px 120px -60px ${alpha(NET_CYAN, 40)}`,
}

/** Marcas de esquina: el detalle que convierte un rectángulo en un instrumento. */
const CORNERS = [
  'left-0 top-0 border-l border-t',
  'right-0 top-0 border-r border-t',
  'left-0 bottom-0 border-b border-l',
  'right-0 bottom-0 border-b border-r',
] as const

/**
 * Configuración de teclado por campo. `inputMode` cambia el teclado que sale en
 * móvil y `autoComplete` es lo que permite rellenar con un toque: los dos
 * ahorran fricción justo donde más caro sale perderla.
 */
const KEYBOARD: Record<FieldId, { autoComplete: string; inputMode?: 'email' | 'text' }> = {
  name: { autoComplete: 'name', inputMode: 'text' },
  email: { autoComplete: 'email', inputMode: 'email' },
  message: { autoComplete: 'off' },
}

export function Converge(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const uid = useId()

  const [values, setValues] = useState<Record<FieldId, string>>({
    name: '',
    email: '',
    message: '',
  })
  const [errors, setErrors] = useState<Partial<Record<FieldId, string>>>({})
  const [division, setDivision] = useState<DivisionId | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  /** Fallo del ENVÍO, no de validación: vive aparte de `errors`. */
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [focused, setFocused] = useState<FieldId | null>(null)
  const [hovered, setHovered] = useState<FieldId | null>(null)

  // Al desmontar se cancela el envío en vuelo: si no, `submitLead` resuelve
  // sobre un componente que ya no existe y el `fetch` sigue vivo de gratis.
  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    const el = sectionRef.current
    if (!el || getQuality().reduced) return

    const ctx = gsap.context(() => {
      gsap.from('[data-field]', {
        opacity: 0,
        yPercent: 30,
        duration: 0.8,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: '[data-form]', start: 'top 85%' },
      })
    }, el)

    return () => ctx.revert()
  }, [])

  const setField = (field: FieldId, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    // El error se limpia al corregir, no al reenviar: castigar dos veces por el
    // mismo fallo es la forma más rápida de perder un lead.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (status !== 'idle') return

    const next: Partial<Record<FieldId, string>> = {}
    if (values.name.trim().length < 2) next.name = FORM.errors.name
    if (!EMAIL.test(values.email.trim())) next.email = FORM.errors.email
    if (values.message.trim().length < 10) next.message = FORM.errors.message

    setErrors(next)
    if (Object.keys(next).length > 0) {
      const first = (['name', 'email', 'message'] as const).find((f) => next[f])
      document.getElementById(`${uid}-${first}`)?.focus()
      return
    }

    setSubmitError(null)
    setStatus('sending')

    // Envío REAL. `submitLead` nunca lanza: devuelve un resultado tipado, así
    // que no hace falta try/catch y el formulario no se puede quedar clavado en
    // "Enviando" para siempre.
    const controller = new AbortController()
    abortRef.current = controller
    const result = await submitLead({ ...values, division }, { signal: controller.signal })

    if (result.ok) {
      setStatus('sent')
      return
    }

    // `aborted` significa que fuimos NOSOTROS (desmontaje): no hay a quién
    // avisar y el componente ya no está. Cualquier otro motivo sí se cuenta.
    if (result.reason !== 'aborted') {
      setSubmitError(leadErrorMessage(result.reason))
      setStatus('idle')
    }
  }

  /**
   * Los cinco estados del campo, en un solo sitio y con la precedencia explícita:
   * error > foco > hover > relleno > reposo. El reposo arranca en 34% —no en el
   * 22% de antes— porque por debajo de eso el campo no se ve sobre la escena y
   * el usuario no sabe ni cuántos campos hay.
   */
  const fieldStyle = (id: FieldId): CSSProperties => {
    const hasError = Boolean(errors[id])
    const isFocused = focused === id
    const filled = values[id].trim().length > 0
    // Con error, TODO el campo pasa a rojo: el foco sigue viéndose, pero avisando.
    const tone = hasError ? CONTROL_RED : NET_CYAN

    const borderColor = hasError
      ? alpha(CONTROL_RED, 90)
      : isFocused
        ? NET_CYAN
        : hovered === id
          ? alpha(INK, 64)
          : filled
            ? alpha(INK, 50)
            : alpha(INK, 34)

    return {
      color: INK,
      borderColor,
      backgroundColor: isFocused ? alpha(INK, 10) : alpha(INK, 5),
      // El anillo es el indicador de foco (los controles llevan `outline: none`).
      // 2px y en color de acento: inequívoco con ratón y con teclado.
      boxShadow: isFocused ? `0 0 0 2px ${alpha(tone, 60)}` : undefined,
      transitionProperty: 'background-color, border-color',
      transitionDuration: '200ms',
      transitionTimingFunction: EASE_OUT_EXPO,
    }
  }

  const field = (id: FieldId, multiline = false) => {
    const inputId = `${uid}-${id}`
    const errorId = `${inputId}-error`
    const error = errors[id]
    const config = FORM.fields[id]

    const shared = {
      id: inputId,
      name: id,
      value: values[id],
      placeholder: config.placeholder,
      'data-cursor': 'hover',
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? errorId : undefined,
      onFocus: () => setFocused(id),
      onBlur: () => setFocused((prev) => (prev === id ? null : prev)),
      onPointerEnter: () => setHovered(id),
      onPointerLeave: () => setHovered((prev) => (prev === id ? null : prev)),
      style: fieldStyle(id),
      // `min-h-12` = 48px: por encima del mínimo táctil de 44 incluso con el
      // texto más corto. El placeholder al 50% se lee, pero sigue estando por
      // debajo de lo que escribe el usuario (100%), que es quien manda.
      className:
        'peer w-full resize-none border bg-transparent px-4 py-3 text-lg leading-snug outline-none placeholder:opacity-60 md:text-xl',
    }

    return (
      <div data-field className="gpu flex flex-col gap-2">
        {/* 88% de opacidad, no 45%. Un label de formulario es una instrucción:
            si hay que forzar la vista para leerlo, el campo ya falló. */}
        <label
          htmlFor={inputId}
          className="type-label"
          style={{ color: alpha(INK, 88), fontSize: '0.75rem', letterSpacing: '0.16em' }}
        >
          {config.label}
        </label>

        {multiline ? (
          <textarea {...shared} rows={4} onChange={(e) => setField(id, e.target.value)} />
        ) : (
          <input
            {...shared}
            type={id === 'email' ? 'email' : 'text'}
            autoComplete={KEYBOARD[id].autoComplete}
            inputMode={KEYBOARD[id].inputMode}
            onChange={(e) => setField(id, e.target.value)}
          />
        )}

        {/* Mono sí, versalitas no: un error tiene que leerse a la primera.
            El comentario va FUERA del `&&`: dentro del paréntesis sólo cabe
            una expresión, y un comentario JSX sólo vale como hijo de JSX. */}
        {error && (
          <p id={errorId} role="alert" className="font-mono text-xs" style={{ color: CONTROL_RED }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  const sending = status === 'sending'

  return (
    <ChapterSection
      id="converge"
      sectionRef={sectionRef}
      sticky={false}
      /* `justify-start`, NO `justify-center`.
         Los botones "Solicitar presupuesto" apuntan a `#chapter-converge`, que
         es el BORDE de la sección. Con el contenido centrado en dos viewports,
         el usuario aterrizaba medio viewport por encima del formulario: click
         en el CTA y pantalla vacía. El contenido tiene que empezar donde
         termina el ancla. */
      innerClassName="justify-start gap-[4vh] px-5 pb-[8vh] pt-[8vh] md:gap-[6vh] md:px-10 md:pb-[10vh] md:pt-[12vh]"
    >
      <div className="flex flex-col gap-6">
        <h2 className="type-mega on-scene uppercase">
          <SplitText by="word" stagger={0.06}>
            {CTA.title}
          </SplitText>
        </h2>
        <p className="text-lead on-scene max-w-[46ch] text-balance" style={{ color: alpha(INK, 78) }}>
          {CTA.sub}
        </p>
      </div>

      {/* LA SUPERFICIE. Todo lo interactivo vive dentro: nada del formulario
          flota directamente sobre las partículas. */}
      <div className="relative w-full max-w-3xl border p-5 sm:p-7 md:p-9" style={PANEL_STYLE}>
        {CORNERS.map((corner) => (
          <span
            key={corner}
            aria-hidden="true"
            className={`pointer-events-none absolute h-4 w-4 ${corner}`}
            style={{ borderColor: NET_CYAN }}
          />
        ))}

        <header
          className="relative mb-7 flex items-baseline justify-between gap-4 border-b pb-3"
          style={{ borderColor: alpha(NET_GREY, 34) }}
        >
          <p className="type-label" style={{ color: NET_CYAN }}>
            {CONTACT_PANEL.kicker}
          </p>
          <p className="type-label shrink-0" style={{ color: alpha(INK, 55) }}>
            {META.index}
          </p>
        </header>

        {status === 'sent' ? (
          <p
            role="status"
            className="type-huge max-w-[24ch] text-balance"
            style={{ color: NET_CYAN }}
          >
            {FORM.success}
          </p>
        ) : (
          <form data-form noValidate onSubmit={handleSubmit} className="flex flex-col gap-7">
            {/* Una sola columna hasta `md`: a 375px dos campos de email no entran
                sin comerse el target táctil. */}
            <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
              {field('name')}
              {field('email')}
            </div>

            {/* `role="radiogroup"` explícito sobre el fieldset, pero con radios
                NATIVOS dentro: así las flechas del teclado funcionan sin escribir
                una sola línea de gestión de foco. Reinventar eso siempre sale mal. */}
            <fieldset
              data-field
              role="radiogroup"
              aria-labelledby={`${uid}-division`}
              className="gpu m-0 flex flex-col gap-3 border-0 p-0"
            >
              <legend
                id={`${uid}-division`}
                className="type-label"
                style={{ color: alpha(INK, 88), fontSize: '0.75rem', letterSpacing: '0.16em' }}
              >
                {FORM.divisionLegend}
              </legend>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {CTA.divisions.map((option) => {
                  const selected = division === option.id
                  return (
                    <label key={option.id} data-cursor="hover" className="group relative flex">
                      <input
                        type="radio"
                        name="division"
                        value={option.id}
                        checked={selected}
                        onChange={() => setDivision(option.id)}
                        className="peer sr-only"
                      />
                      {/* `min-h-12` (48px) y no `py-3`: la etiqueta es mono
                          pequeña, así que con padding simétrico la caja se
                          quedaba por debajo del mínimo táctil de 44.
                          El seleccionado NO se distingue sólo por el borde:
                          cambia relleno, color de texto y enciende el punto.
                          Un único canal de señal siempre se le escapa a alguien. */}
                      <span
                        className="type-label flex min-h-12 w-full items-center gap-3 px-4 transition-colors duration-300 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 sm:w-auto"
                        style={{
                          border: `1px solid ${selected ? NET_CYAN : alpha(INK, 38)}`,
                          color: selected ? NET_BG : alpha(INK, 88),
                          backgroundColor: selected ? NET_CYAN : alpha(INK, 5),
                          outlineColor: NET_CYAN,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: selected ? NET_BG : 'transparent',
                            border: `1px solid ${selected ? NET_BG : alpha(INK, 45)}`,
                          }}
                        />
                        {option.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {field('message', true)}

            {/* El fallo de envío va PEGADO al botón y con caja propia: quien
                acaba de escribir tres párrafos tiene que verlo sin buscarlo. */}
            {submitError && (
              <p
                role="alert"
                className="border px-4 py-3 font-mono text-xs leading-relaxed"
                style={{
                  color: INK,
                  borderColor: alpha(CONTROL_RED, 70),
                  backgroundColor: alpha(CONTROL_RED, 14),
                }}
              >
                {submitError}
              </p>
            )}

            <div data-field className="gpu flex flex-col gap-4">
              {/* Botón NATIVO `type="submit"`, no `MagneticButton`.
                  Tres motivos, ninguno estético:
                  1. `MagneticButton` renderiza `type="button"` — hacía falta un
                     submit oculto para que Enter enviara. Con un submit real,
                     Enter funciona solo y sobra el duplicado.
                  2. No acepta `disabled`: durante el envío se podía pulsar otra
                     vez y disparar dos leads.
                  3. Su variante `neon` es violeta de Control — la marca
                     EQUIVOCADA en un capítulo del mundo `net`.
                  Relleno cian sólido: es el elemento con más contraste del
                  bloque, que es exactamente lo que debe ser. */}
              <button
                type="submit"
                data-cursor="cta"
                disabled={sending}
                aria-busy={sending}
                className="type-label inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full px-10 transition-colors duration-300 sm:w-auto sm:self-start"
                style={{
                  fontSize: '0.8125rem',
                  color: NET_BG,
                  backgroundColor: sending ? alpha(NET_CYAN, 55) : NET_CYAN,
                  border: `1px solid ${NET_CYAN}`,
                  boxShadow: `0 0 36px -12px ${NET_CYAN}`,
                  transitionTimingFunction: EASE_OUT_EXPO,
                }}
              >
                {sending && (
                  // `animate-pulse` sólo toca `opacity`: no dispara layout ni
                  // pintado caro mientras el Núcleo sigue animando detrás.
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 animate-pulse rounded-full"
                    style={{ backgroundColor: NET_BG }}
                  />
                )}
                {sending ? FORM.sending : CTA.submit}
              </button>
            </div>

            {/* Región viva persistente: si se montara junto con el mensaje, buena
                parte de los lectores no llegaría a anunciarlo. */}
            <p role="status" className="sr-only">
              {sending ? FORM.sending : ''}
            </p>
          </form>
        )}

        {/* CONFIANZA. Sólo datos que existen en `SITE`: email y procedencia.
            Ni teléfono, ni horario, ni tiempo de respuesta — inventar eso es
            justo lo contrario de generar confianza. Se muestra también tras el
            envío: es cuando más falta hace saber que hay alguien del otro lado. */}
        <div
          className="relative mt-8 flex flex-col gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          style={{ borderColor: alpha(NET_GREY, 30) }}
        >
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="type-label" style={{ color: alpha(INK, 60) }}>
              {CONTACT_PANEL.emailLabel}
            </span>
            <a
              href={`mailto:${SITE.email}`}
              data-cursor="hover"
              className="inline-flex min-h-11 items-center font-mono text-sm underline underline-offset-4"
              style={{ color: NET_CYAN }}
            >
              {SITE.email}
            </a>
          </p>

          <p className="flex items-center gap-3">
            <span className="type-label" style={{ color: alpha(INK, 60) }}>
              {CONTACT_PANEL.locationLabel}
            </span>
            <span className="font-mono text-sm" style={{ color: alpha(INK, 85) }}>
              {CONTACT_PANEL.location}
            </span>
          </p>
        </div>
      </div>
    </ChapterSection>
  )
}
