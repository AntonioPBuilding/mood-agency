import { NET } from '@/content'
import { DecodeText } from '@/ui'
import { ChapterSection } from './ChapterSection'
import { INK, NET_CYAN, NET_GREY, alpha, chapterMeta } from './_tokens'

/**
 * MOOD NET — la otra voz.
 *
 * Después del apagón todo cambia de temperatura: retícula, líneas de 1px,
 * etiquetas en mono y cero neón. La contención ES el mensaje; si esta sección
 * brillara, las dos divisiones se confundirían.
 *
 * Las "coordenadas" no son copy inventado: son el tramo real que ocupa el
 * capítulo en el timeline global. Dato, no decoración.
 */

const META = chapterMeta('netIntro')
const GUIDES = [25, 50, 75]

const GRID_BACKGROUND = {
  backgroundImage: `linear-gradient(to right, ${alpha(NET_GREY, 9)} 1px, transparent 1px), linear-gradient(to bottom, ${alpha(NET_GREY, 9)} 1px, transparent 1px)`,
  backgroundSize: '72px 72px',
}

export function NetIntro(): React.JSX.Element {
  return (
    <ChapterSection
      id="netIntro"
      ariaLabel={NET.name}
      innerClassName="justify-between px-5 py-8 md:px-10 md:py-12"
    >
      {/* Retícula estática: sólo pinta, no anima. Es fondo, no efecto. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={GRID_BACKGROUND} />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {GUIDES.map((left) => (
          <span
            key={left}
            className="absolute top-0 h-full w-px"
            style={{ left: `${left}%`, backgroundColor: alpha(NET_GREY, 14) }}
          />
        ))}
      </div>

      <header
        className="relative flex items-baseline justify-between gap-4 border-b pb-3"
        style={{ borderColor: alpha(NET_GREY, 30) }}
      >
        <p className="type-label" style={{ color: NET_CYAN }}>
          {NET.kicker}
        </p>
        <p className="type-label shrink-0" style={{ color: alpha(INK, 40) }}>
          {META.index}
        </p>
      </header>

      <div className="relative flex flex-1 flex-col justify-center gap-6">
        <h2 className="type-giga uppercase">
          <DecodeText duration={1.6}>{NET.name}</DecodeText>
        </h2>
        <p className="type-label" style={{ color: alpha(NET_CYAN, 70) }}>
          {META.span}
        </p>
      </div>

      <footer
        className="relative flex flex-col gap-4 border-t pt-4 md:flex-row md:items-end md:justify-between"
        style={{ borderColor: alpha(NET_GREY, 30) }}
      >
        <p className="text-lead max-w-[44ch] leading-snug" style={{ color: alpha(INK, 72) }}>
          {NET.intro}
        </p>
      </footer>
    </ChapterSection>
  )
}
