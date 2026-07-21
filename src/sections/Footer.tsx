import { BRAND, FOOTER } from '@/content'
import { ChapterSection } from './ChapterSection'
import { INK, alpha } from './_tokens'

/**
 * FOOTER — se sale por donde se entró.
 *
 * El último capítulo dura 0.6 viewports: después de 14 secciones nadie quiere
 * un mapa del sitio, quiere una salida limpia. Legal, cuatro enlaces y la firma
 * (que es el mismo tagline con el que arrancó el Hero: la landing cierra el
 * círculo con la frase que la abrió).
 */

export function Footer(): React.JSX.Element {
  return (
    <ChapterSection
      id="footer"
      sticky={false}
      innerClassName="justify-end px-5 pb-8 pt-[12vh] md:px-10 md:pb-10"
    >
      <div
        className="flex flex-col gap-6 border-t pt-6 md:flex-row md:items-center md:justify-between"
        style={{ borderColor: alpha(INK, 15) }}
      >
        <p className="type-label" style={{ color: alpha(INK, 55) }}>
          {FOOTER.legal}
        </p>

        <nav>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {FOOTER.links.map((link) => (
              <li key={link.label}>
                {/* `inline-flex` + `min-h-11`: en `type-label` la caja de un
                    enlace mide 15px de alto. Es tabulable y clicable con ratón,
                    pero con el dedo es una lotería. El alto mínimo táctil se
                    consigue con la caja, no con el cuerpo del texto. */}
                <a
                  href={link.href}
                  data-cursor="hover"
                  className="type-label inline-flex min-h-11 items-center transition-colors duration-300 hover:text-[var(--world-accent)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <p className="type-label" style={{ color: alpha(INK, 28) }}>
          {BRAND.tagline}
        </p>
      </div>
    </ChapterSection>
  )
}
