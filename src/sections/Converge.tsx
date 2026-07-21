import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CTA, FORM } from '@/content'
import { getQuality } from '@/core/quality'
import { MagneticButton, SplitText } from '@/ui'
import { ChapterSection } from './ChapterSection'
import { gsap } from './_gsap'
import { ACCENT, CONTROL_RED, EASE_OUT_EXPO, INK, NET_CYAN, alpha } from './_tokens'

/**
 * CONVERGE — el CTA final.
 *
 * Un formulario de verdad, no una decoración: valida en cliente, dice qué falla
 * y en qué campo, y anuncia el resultado a la asistencia (`role="alert"` para
 * los errores, `role="status"` para el éxito).
 *
 * Los inputs no tienen caja: sólo una línea inferior que se dibuja al enfocar.
 * Eso obliga a apagar el `outline` por defecto, así que la línea de foco es
 * gruesa y en color de acento: el foco SIEMPRE tiene que verse, el brief estético
 * no puede ganarle a esa regla.
 */

type DivisionId = (typeof CTA.divisions)[number]['id']
type FieldId = 'name' | 'email' | 'message'
type Status = 'idle' | 'sending' | 'sent'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const UNDERLINE_BASE = 'pointer-events-none absolute inset-x-0 bottom-0 h-px'
const UNDERLINE_FOCUS =
  'pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-500 peer-focus:scale-x-100'

export function Converge(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const timerRef = useRef<number>(0)
  const uid = useId()

  const [values, setValues] = useState<Record<FieldId, string>>({
    name: '',
    email: '',
    message: '',
  })
  const [errors, setErrors] = useState<Partial<Record<FieldId, string>>>({})
  const [division, setDivision] = useState<DivisionId | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
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

    setStatus('sending')
    // TODO(backend): sustituir por POST real (endpoint de formularios, Resend,
    // etc.). Payload listo: { ...values, division }. Hoy sólo simula la latencia
    // para que el estado de envío sea el definitivo cuando exista el endpoint.
    timerRef.current = window.setTimeout(() => setStatus('sent'), 900)
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
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? errorId : undefined,
      className:
        'peer w-full resize-none border-0 bg-transparent py-3 text-xl outline-none placeholder:opacity-25 md:text-2xl',
    }

    return (
      <div data-field className="gpu flex flex-col">
        <label htmlFor={inputId} className="type-label" style={{ color: alpha(INK, 45) }}>
          {config.label}
        </label>

        <div className="relative">
          {multiline ? (
            <textarea
              {...shared}
              rows={3}
              onChange={(e) => setField(id, e.target.value)}
            />
          ) : (
            <input
              {...shared}
              type={id === 'email' ? 'email' : 'text'}
              autoComplete={id === 'email' ? 'email' : 'name'}
              onChange={(e) => setField(id, e.target.value)}
            />
          )}

          <span aria-hidden="true" className={UNDERLINE_BASE} style={{ backgroundColor: alpha(INK, 22) }} />
          <span
            aria-hidden="true"
            className={UNDERLINE_FOCUS}
            style={{ backgroundColor: ACCENT, transitionTimingFunction: EASE_OUT_EXPO }}
          />
        </div>

        {/* Mono sí, versalitas no: un error tiene que leerse a la primera.
            El comentario va FUERA del `&&`: dentro del paréntesis sólo cabe
            una expresión, y un comentario JSX sólo vale como hijo de JSX. */}
        {error && (
          <p id={errorId} role="alert" className="mt-2 font-mono text-xs" style={{ color: CONTROL_RED }}>
            {error}
          </p>
        )}
      </div>
    )
  }

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
        <h2 className="type-mega uppercase">
          <SplitText by="word" stagger={0.06}>
            {CTA.title}
          </SplitText>
        </h2>
        <p className="text-lead max-w-[46ch] text-balance" style={{ color: alpha(INK, 65) }}>
          {CTA.sub}
        </p>
      </div>

      {status === 'sent' ? (
        <p
          role="status"
          className="type-huge max-w-[24ch] text-balance"
          style={{ color: NET_CYAN }}
        >
          {FORM.success}
        </p>
      ) : (
        <form
          ref={formRef}
          data-form
          noValidate
          onSubmit={handleSubmit}
          className="flex w-full max-w-3xl flex-col gap-8"
        >
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
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
            <legend id={`${uid}-division`} className="type-label" style={{ color: alpha(INK, 45) }}>
              {FORM.divisionLegend}
            </legend>

            <div className="flex flex-wrap gap-3">
              {CTA.divisions.map((option) => {
                const selected = division === option.id
                return (
                  <label
                    key={option.id}
                    data-cursor="hover"
                    className="group relative"
                  >
                    <input
                      type="radio"
                      name="division"
                      value={option.id}
                      checked={selected}
                      onChange={() => setDivision(option.id)}
                      className="peer sr-only"
                    />
                    {/* `min-h-11` + centrado vertical en vez de `py-3`: la
                        etiqueta es `type-label` (11px), así que con padding
                        simétrico la caja se quedaba en 39px de alto — por
                        debajo del mínimo táctil de 44. El aspecto no cambia:
                        el texto sigue centrado, sólo crece el blanco. */}
                    <span
                      className="type-label flex min-h-11 items-center px-4 transition-colors duration-300 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4"
                      style={{
                        border: `1px solid ${selected ? ACCENT : alpha(INK, 22)}`,
                        color: selected ? 'var(--world-bg)' : alpha(INK, 75),
                        backgroundColor: selected ? ACCENT : 'transparent',
                        outlineColor: ACCENT,
                      }}
                    >
                      {option.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {field('message', true)}

          <div data-field className="gpu flex items-center gap-6">
            {/* MagneticButton renderiza un `type="button"`: no envía nada por sí
                solo. `requestSubmit()` dispara el mismo camino que un submit
                real (incluido nuestro onSubmit), sin duplicar la validación. */}
            <MagneticButton variant="neon" onClick={() => formRef.current?.requestSubmit()}>
              {status === 'sending' ? FORM.sending : CTA.submit}
            </MagneticButton>

            {/* Submit real y oculto: sin él, pulsar Enter dentro de un campo no
                envía el formulario. Fuera del orden de tabulación para que nadie
                se encuentre dos veces el mismo botón. */}
            <button type="submit" tabIndex={-1} aria-hidden="true" className="sr-only">
              {CTA.submit}
            </button>
          </div>

          {/* Región viva persistente: si se montara junto con el mensaje, buena
              parte de los lectores no llegaría a anunciarlo. */}
          <p role="status" className="sr-only">
            {status === 'sending' ? FORM.sending : ''}
          </p>
        </form>
      )}
    </ChapterSection>
  )
}
