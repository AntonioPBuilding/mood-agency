import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getQuality } from '@/core/quality'

/**
 * REVEAL TIPOGRÁFICO ATADO AL SCROLL.
 *
 * Dos cosas que casi todo el mundo hace mal y acá no:
 *
 * 1. ACCESIBILIDAD. Un lector de pantalla que se encuentra 40 `<span>` con una
 *    letra cada uno deletrea la frase. El texto real va una sola vez en un
 *    `sr-only` y TODA la maquinaria visual va con `aria-hidden`.
 *
 * 2. LÍNEAS DE VERDAD. `by="line"` no puede resolverse partiendo por `\n`: una
 *    línea es el resultado del reflow, no del contenido. Se renderizan las
 *    palabras, se miden sus `offsetTop` y se agrupan. Todo en `useLayoutEffect`,
 *    antes del paint, para que el usuario nunca vea el estado intermedio.
 */

interface SplitTextProps {
  children: string
  as?: keyof React.JSX.IntrinsicElements
  by?: 'char' | 'word' | 'line'
  className?: string
  /** Retardo entre unidades, en segundos. Default 0.02. */
  stagger?: number
  /** Dispara al entrar en viewport. Default true. */
  trigger?: boolean
}

gsap.registerPlugin(ScrollTrigger)

/**
 * `overflow: hidden` sobre un inline-block recorta los descendentes (g, y, p) y
 * además mueve la línea base. El padding + margen negativo devuelve el espacio
 * al glifo sin alterar la maquetación.
 */
const CLIP: React.CSSProperties = {
  display: 'inline-block',
  overflow: 'hidden',
  verticalAlign: 'bottom',
  paddingBottom: '0.14em',
  marginBottom: '-0.14em',
}

const UNIT: React.CSSProperties = {
  display: 'inline-block',
  willChange: 'transform',
}

export function SplitText({
  children,
  as = 'span',
  by = 'char',
  className = '',
  stagger = 0.02,
  trigger = true,
}: SplitTextProps): React.JSX.Element {
  const rootRef = useRef<HTMLElement | null>(null)
  const widthRef = useRef(0)
  // Si el reveal ya ocurrió, un re-split por resize NO debe volver a animarlo.
  const playedRef = useRef(false)

  const words = children.split(/\s+/).filter(Boolean)
  const [lines, setLines] = useState<string[] | null>(null)
  const needsMeasure = by === 'line' && lines === null

  // ── Paso 1: medir el reflow real y agrupar palabras en líneas ──────────────
  useLayoutEffect(() => {
    if (by !== 'line' || lines !== null) return
    const root = rootRef.current
    if (!root) return

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-word]'))
    if (nodes.length === 0) return

    widthRef.current = root.offsetWidth

    const grouped: string[][] = []
    let top = Number.NaN
    for (const node of nodes) {
      const y = Math.round(node.offsetTop)
      if (y !== top) {
        top = y
        grouped.push([])
      }
      grouped[grouped.length - 1].push(node.textContent ?? '')
    }

    setLines(grouped.map((g) => g.join(' ')))
  }, [by, lines, children])

  // Un cambio de ancho cambia dónde rompe el texto: hay que volver a medir.
  useLayoutEffect(() => {
    if (by !== 'line') return
    const root = rootRef.current
    if (!root) return

    let timer = 0
    const onResize = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (root.offsetWidth !== widthRef.current) setLines(null)
      }, 180)
    }

    window.addEventListener('resize', onResize)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [by])

  // ── Paso 2: el reveal ──────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || needsMeasure) return

    const reduced = getQuality().reduced

    const ctx = gsap.context(() => {
      const units = root.querySelectorAll<HTMLElement>('[data-unit]')
      if (units.length === 0) return

      // Ya se reveló y sólo estamos re-partiendo por resize: estado final y fuera.
      if (playedRef.current) {
        gsap.set(units, { yPercent: 0, opacity: 1 })
        return
      }

      /**
       * EL REVEAL SE DISPARA POR OBSERVACIÓN, NO POR MEDICIÓN.
       *
       * Antes esto colgaba de un ScrollTrigger con `start: 'top 88%'`. El
       * problema: los triggers se crean al montar, mientras el Preloader tapa
       * la pantalla y la fuente variable todavía no cargó. Cuando `Archivo`
       * entra, las métricas de los titulares gigantes cambian, el documento se
       * recoloca varios viewports, y el trigger se queda esperando en una
       * coordenada que ya no existe. Resultado: texto escondido en
       * `yPercent: 115` para siempre. Refrescar ayudaba, pero seguía siendo una
       * apuesta a que la medición coincidiera con la realidad.
       *
       * `IntersectionObserver` no mide nada: el navegador avisa cuando el
       * elemento está VISIBLE de verdad. No hay coordenada que se quede vieja,
       * y no le afecta que Lenis mueva el scroll por su cuenta.
       *
       * El `rootMargin` inferior del 12% reproduce el viejo 'top 88%': la
       * animación arranca cuando el bloque ya entró un poco en cuadro, no
       * justo al asomar por el borde.
       */
      const tween = reduced
        ? (gsap.set(units, { opacity: 0, yPercent: 0 }),
          gsap.to(units, {
            opacity: 1,
            duration: 0.5,
            stagger: stagger * 0.5,
            paused: true,
            onStart: () => {
              playedRef.current = true
            },
          }))
        : /* Dos movimientos superpuestos a ritmos distintos, no uno solo.
           *
           * Antes era una única máscara con `expo.out`: una curva que arranca
           * casi instantánea y frena al final. Sirve para un impacto, pero en
           * un titular se lee como un portazo — el texto aparece de golpe.
           *
           * Ahora la subida usa `power3.out` (misma sensación de peso, entrada
           * mucho más gentil) y dura más; y encima va un fundido MÁS CORTO, que
           * termina cuando el glifo aún está subiendo. Ese desfase es todo el
           * truco: la letra ya es legible mientras acaba de acomodarse, en vez
           * de materializarse en su sitio final.
           *
           * 115% y no 100%: el margen extra evita que asome el antialiasing
           * del glifo por el borde de la máscara en pantallas HiDPI. */
          gsap
            .timeline({
              paused: true,
              onStart: () => {
                playedRef.current = true
              },
            })
            .set(units, { yPercent: 115, opacity: 0 })
            .to(
              units,
              { yPercent: 0, duration: 1.25, ease: 'power3.out', stagger: stagger * 1.5 },
              0,
            )
            .to(
              units,
              { opacity: 1, duration: 0.7, ease: 'power1.out', stagger: stagger * 1.5 },
              0,
            )

      if (!trigger) {
        tween.delay(0.05).play()
        return
      }

      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return
          tween.play()
          io.disconnect() // equivale al `once: true` de antes
        },
        { rootMargin: '0px 0px -12% 0px' },
      )
      io.observe(root)

      // gsap.context respeta la función de limpieza que devolvamos acá.
      return () => io.disconnect()
    }, root)

    return () => ctx.revert()
  }, [needsMeasure, lines, by, stagger, trigger, children])

  /* `ElementType` a secas es la unión de TODAS las etiquetas intrínsecas, y al
     renderizarla TypeScript intersecta sus props hasta dejarlas en `never`
     (de ahí el "children expects a single child of type never"). Lo tipamos
     como un componente que acepta atributos HTML genéricos: es lo único que
     este componente necesita —className, style, children, ref— y así el JSX
     resuelve limpio. */
  const Tag = as as unknown as React.ComponentType<
    React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }
  >

  let visual: React.ReactNode

  if (by === 'line') {
    if (needsMeasure) {
      // Render de medición: mismas palabras, mismo estilo, sin envoltorios.
      visual = words.map((word, i) => (
        <Fragment key={i}>
          <span data-word className="inline-block">
            {word}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))
    } else {
      visual = (lines ?? []).map((line, i) => (
        <span key={i} className="mask-line" style={{ paddingBottom: '0.14em', marginBottom: '-0.14em' }}>
          <span data-unit style={{ display: 'block', willChange: 'transform' }}>
            {line}
          </span>
        </span>
      ))
    }
  } else if (by === 'word') {
    visual = words.map((word, i) => (
      <Fragment key={i}>
        <span style={CLIP}>
          <span data-unit style={UNIT}>
            {word}
          </span>
        </span>
        {i < words.length - 1 ? ' ' : null}
      </Fragment>
    ))
  } else {
    visual = words.map((word, i) => (
      <Fragment key={i}>
        {/* La palabra no puede partirse por la mitad al hacer wrap. */}
        <span className="inline-block whitespace-nowrap">
          {Array.from(word).map((ch, j) => (
            <span key={j} style={CLIP}>
              <span data-unit style={UNIT}>
                {ch}
              </span>
            </span>
          ))}
        </span>
        {i < words.length - 1 ? ' ' : null}
      </Fragment>
    ))
  }

  return (
    <Tag
      ref={rootRef}
      className={className}
      style={by === 'line' ? { display: 'block' } : undefined}
    >
      <span className="sr-only">{children}</span>
      {/* En modo línea los hijos son bloques: el envoltorio no puede ser inline. */}
      <span aria-hidden="true" style={{ display: by === 'line' ? 'block' : 'inline' }}>
        {visual}
      </span>
    </Tag>
  )
}
