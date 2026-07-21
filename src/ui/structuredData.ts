import { BRAND, EVENTS, HOME_URL, SITE, TECH } from '@/content'

/**
 * JSON-LD — la ficha de la empresa para las máquinas.
 *
 * El `index.html` trae un negocio mínimo escrito a mano. Está ahí a propósito,
 * como suelo: es lo que lee un rastreador que no ejecuta JavaScript. Este módulo
 * lo SUSTITUYE en cuanto arranca la app por el grafo completo —la marca madre,
 * sus dos divisiones, sus diecisiete servicios, la dirección y el contacto—,
 * construido desde `@/content`.
 *
 * ¿Por qué generarlo y no escribirlo en el HTML? Por la misma regla que rige
 * todo el proyecto: una sola fuente de verdad para el copy. Un JSON-LD a mano es
 * una copia del catálogo de servicios que nadie actualiza. A los seis meses Mood
 * Creative vende cinco cosas distintas de las que Google cree que vende, y no
 * hay ningún test que lo detecte porque nadie lee ese bloque nunca más.
 *
 * ── POR QUÉ `ProfessionalService` Y NO `Organization` ────────────────────────
 *
 * Mood Control tiene una base física declarada (Utrera, Sevilla) y vende
 * servicios. `ProfessionalService` desciende de `LocalBusiness`, así que admite
 * `address` y `areaServed` con significado real y entra en las consultas
 * locales ("agencia de eventos en Sevilla"), que es donde se juega el partido.
 * Una `Organization` a secas no compite ahí.
 *
 * ⚠ OJO CON LOS NOMBRES: las constantes se llaman `EVENTS` y `TECH`, no
 * `CONTROL` y `NET`. Los ids `'control'` y `'net'` que verás por el proyecto son
 * identificadores de MUNDO, no marcas. Ver la cabecera de `@/content`.
 *
 * Google, Bing y las previsualizaciones de las redes ejecutan JS y ven esto.
 */

/** JSON puro, sin `any`: el tipo se define recursivamente y ya está. */
type JsonLdValue = string | number | boolean | null | JsonLdValue[] | { [key: string]: JsonLdValue }
type JsonLdNode = { [key: string]: JsonLdValue }

/** `id` del `<script>` de `index.html` que vamos a reescribir. */
const SCRIPT_ID = 'ld-json'

/** Las URLs de un grafo JSON-LD tienen que ser ABSOLUTAS, sin excepción. */
function abs(path: string): string {
  return `${SITE.url}${path}`
}

const ORG_ID = abs('/#organization')
/** Fragmentos internos del grafo. Describen la DIVISIÓN, no el mundo 3D. */
const EVENTS_ID = abs('/#mood-agency')
const TECH_ID = abs('/#mood-creative')

/**
 * Variantes por las que la gente busca la marca.
 *
 * Un buscador no sabe que "MoodControl", "Mood Control Utrera" y "Mood Control"
 * son la misma empresa hasta que se lo decís. Declararlas consolida la entidad
 * en vez de repartir las señales entre tres cadenas que compiten.
 *
 * Se GENERAN desde `SITE`: escribir los cuatro strings a mano es exactamente lo
 * que hace que dentro de seis meses el JSON-LD diga un nombre y la web otro.
 */
function brandAliases(): string[] {
  return [
    BRAND.name,
    BRAND.name.replace(/\s+/g, ''),
    `${BRAND.name} ${SITE.locality}`,
    `${BRAND.name} ${SITE.region}`,
  ]
}

/**
 * Catálogo de una división. `OfferCatalog` + `Offer` + `Service` es la cadena
 * que schema.org espera; volcar los servicios como una lista de strings es lo
 * que hace todo el mundo y no produce ningún dato aprovechable.
 */
function catalog(name: string, services: readonly { title: string; desc: string }[]): JsonLdNode {
  return {
    '@type': 'OfferCatalog',
    name,
    itemListElement: services.map((service, i) => ({
      '@type': 'Offer',
      position: i + 1,
      itemOffered: {
        '@type': 'Service',
        name: service.title,
        description: service.desc,
      },
    })),
  }
}

/** Una división: cuelga de la marca madre y aporta su propio catálogo. */
function division(id: string, name: string, kicker: string, intro: string, catalogNode: JsonLdNode): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': id,
    name,
    disambiguatingDescription: kicker,
    description: intro,
    parentOrganization: { '@id': ORG_ID },
    areaServed: [...SITE.areaServed],
    hasOfferCatalog: catalogNode,
  }
}

export function buildStructuredData(): JsonLdNode {
  /* Sin `streetAddress` ni `postalCode`: el cliente confirmó municipio y
     provincia, nada más. Un schema con una calle inventada es peor que uno
     incompleto — el incompleto no contradice a nadie. */
  const address: JsonLdNode = {
    '@type': 'PostalAddress',
    addressLocality: SITE.locality,
    addressRegion: SITE.region,
    addressCountry: SITE.country,
  }

  const business: JsonLdNode = {
    '@type': 'ProfessionalService',
    '@id': ORG_ID,
    name: BRAND.name,
    alternateName: brandAliases(),
    url: HOME_URL,
    description: BRAND.manifesto,
    slogan: BRAND.tagline,
    logo: {
      '@type': 'ImageObject',
      url: abs('/icon-512.png'),
      width: 512,
      height: 512,
    },
    image: abs(SITE.meta.ogImage),
    email: SITE.email,
    address,
    areaServed: [...SITE.areaServed],
    knowsLanguage: [...SITE.languages],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: SITE.email,
      areaServed: [...SITE.areaServed],
      availableLanguage: [...SITE.languages],
    },
    department: [{ '@id': EVENTS_ID }, { '@id': TECH_ID }],
  }

  // `sameAs` sólo si hay perfiles REALES. Declararle a Google una identidad que
  // no podés demostrar es peor que no declarar ninguna.
  if (SITE.social.length > 0) business.sameAs = SITE.social.map((profile) => profile.href)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      business,
      division(
        EVENTS_ID,
        EVENTS.name,
        EVENTS.kicker,
        EVENTS.intro,
        catalog(`Servicios de ${EVENTS.name}`, EVENTS.services),
      ),
      division(
        TECH_ID,
        TECH.name,
        TECH.kicker,
        TECH.intro,
        catalog(`Servicios de ${TECH.name}`, TECH.services),
      ),
      {
        '@type': 'WebSite',
        '@id': abs('/#website'),
        url: HOME_URL,
        name: `${BRAND.name} — ${BRAND.tagline}`,
        inLanguage: SITE.lang,
        publisher: { '@id': ORG_ID },
      },
    ],
  }
}

/**
 * GUARDIA DE DESARROLLO — el único punto donde `index.html` puede mentir.
 *
 * `SITE` es la fuente de verdad de dominio y metadatos, pero `index.html` es
 * estático y no puede importarlo: sus etiquetas son una copia. Y una copia sin
 * vigilancia se pudre — un cambio de dominio en `SITE` que nadie replique deja
 * el canonical apuntando al sitio viejo, que es de los errores de SEO más caros
 * y más silenciosos que existen.
 *
 * Esto no lo arregla; lo hace IMPOSIBLE DE NO VER. Sólo corre en desarrollo, así
 * que no cuesta ni un byte en producción.
 */
function assertHtmlMatchesSite(): void {
  const checks: readonly { what: string; found: string | undefined; expected: string }[] = [
    {
      what: '<link rel="canonical">',
      found: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
      expected: HOME_URL,
    },
    {
      what: '<meta property="og:url">',
      found: document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content,
      expected: HOME_URL,
    },
    {
      what: '<meta property="og:image">',
      found: document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content,
      expected: abs(SITE.meta.ogImage),
    },
    { what: '<title>', found: document.title, expected: SITE.meta.title },
  ]

  for (const check of checks) {
    if (check.found === undefined || check.found === check.expected) continue
    console.error(
      `[mood] ${check.what} de index.html no coincide con SITE de src/content.ts.\n` +
        `  index.html: ${check.found}\n` +
        `  SITE:       ${check.expected}\n` +
        '  Actualizá index.html: es una copia y hay que mantenerla a mano.',
    )
  }
}

/**
 * Sustituye el JSON-LD estático por el grafo completo. Idempotente: se puede
 * llamar tantas veces como haga falta (StrictMode monta dos veces en
 * desarrollo) porque siempre reescribe el MISMO nodo, nunca añade otro. Dos
 * bloques JSON-LD describiendo la misma organización es exactamente el tipo de
 * señal contradictoria que hace que un rastreador ignore los dos.
 */
export function injectStructuredData(): void {
  if (typeof document === 'undefined') return

  if (import.meta.env.DEV) assertHtmlMatchesSite()

  const json = JSON.stringify(buildStructuredData())
  const existing = document.getElementById(SCRIPT_ID)

  if (existing instanceof HTMLScriptElement) {
    existing.textContent = json
    return
  }

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.type = 'application/ld+json'
  script.textContent = json
  document.head.appendChild(script)
}
