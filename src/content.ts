/**
 * Todo el copy y los datos de la landing, en un solo lugar.
 *
 * Ningún componente escribe texto a mano. Si mañana Mood Control cambia un
 * servicio o quiere la web en inglés, se toca ESTE archivo y nada más.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ NOMBRES DE MARCA vs. IDENTIFICADORES INTERNOS — leer ANTES de tocar nada.
 *
 * La empresa se llama MOOD CONTROL y tiene dos divisiones:
 *
 *                          MOOD CONTROL              ← la marca madre (BRAND)
 *                                │
 *                  ┌─────────────┴─────────────┐
 *             MOOD AGENCY                 MOOD CREATIVE
 *          eventos, fiestas, DJs        informática, IA, web
 *            id interno 'control'          id interno 'net'
 *
 * Los ids `'control'` y `'net'` NO son nombres de marca: son identificadores
 * TÉCNICOS, cableados en `WorldId` y `ChapterId` (`@/core/chapters`), en `WORLDS`
 * (`@/core/palette`), en los 7 estados del Núcleo (`@/scenes`) y en los shaders.
 * Se quedan exactamente como están: renombrarlos es alto riesgo y cero beneficio
 * para el visitante.
 *
 * La traducción, que es lo único que hay que memorizar:
 *
 *   id 'control'  →  mundo de EVENTOS     →  marca Mood Agency    →  `EVENTS`
 *   id 'net'      →  mundo de TECNOLOGÍA  →  marca Mood Creative  →  `TECH`
 *
 * Y el que más confunde: la marca madre se llama Mood Control, que NO es el
 * mundo `'control'`. El mundo `'control'` es Mood Agency.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ────────────────────────────  LA MARCA MADRE  ─────────────────────────── */

export const BRAND = {
  name: 'Mood Control',
  tagline: 'Creamos estados de ánimo',
  claim: ['No hacemos webs.', 'No hacemos eventos.', 'Creamos ESTADOS DE ÁNIMO.'],
  manifesto:
    'Un mood es lo que queda cuando el evento ha terminado y la pantalla se ha apagado. Nosotros diseñamos esa huella: con luz, con sonido, con código.',
} as const

/**
 * IDENTIDAD PÚBLICA DEL SITIO — ÚNICO PUNTO DE CONFIGURACIÓN.
 *
 * Dominio, contacto, ubicación y metadatos. De acá salen el JSON-LD
 * (`@/ui/structuredData`), el `page` que viaja en cada lead y los textos que
 * `index.html` refleja. Si cambia algo del negocio, se cambia ACÁ.
 *
 * ⚠ LA ÚNICA EXCEPCIÓN, Y HAY QUE CONOCERLA: `index.html` es HTML estático y no
 * puede importar este módulo. Sus metadatos —`<title>`, `description`, canonical,
 * `og:*`, `twitter:*`— son una COPIA de `meta` y de `url`. No es un descuido:
 * los rastreadores sociales (Facebook, X, WhatsApp) no ejecutan JavaScript, así
 * que esos valores tienen que estar en el HTML servido o la previsualización
 * sale vacía.
 *
 * Para que esa copia no se pudra en silencio, `injectStructuredData()` compara
 * las dos fuentes EN DESARROLLO y grita por consola en cuanto divergen. O sea:
 * se toca `SITE`, y si hay que replicar algo en `index.html` el propio proyecto
 * te lo dice antes de que llegue a producción.
 *
 * También son copias servidas tal cual, y no pueden dejar de serlo:
 * `public/site.webmanifest`, `public/robots.txt` y `public/sitemap.xml`.
 */
export const SITE = {
  /** Dominio DEFINITIVO, sin barra final. Todo lo absoluto se construye desde acá. */
  url: 'https://moodcontrol.es',
  name: BRAND.name,
  locale: 'es_ES',
  lang: 'es',
  /**
   * ⚠ PENDIENTE DE CONFIRMAR CON EL CLIENTE: el buzón se dedujo del dominio
   * nuevo, no lo confirmó nadie. Antes de publicar hay que verificar que existe
   * y que alguien lo lee — es la única vía de contacto además del formulario.
   */
  email: 'hola@moodcontrol.es',

  /* ── Dónde está la empresa. Base real, confirmada por el cliente. ────────── */

  /** Municipio. Alimenta `address.addressLocality` y los alias de marca. */
  locality: 'Utrera',
  /** Provincia. Alimenta `address.addressRegion` y los alias de marca. */
  region: 'Sevilla',
  /** Código ISO 3166-1. Alimenta `address.addressCountry`. */
  country: 'ES',
  /**
   * Dónde se trabaja, no dónde se está. El cliente lo dijo explícito: la base es
   * Utrera pero se trabaja en cualquier sitio, así que España entera entra acá.
   * No se declara nada fuera de España porque nadie lo confirmó.
   */
  areaServed: ['Utrera', 'Sevilla', 'España'],
  /** Idiomas en los que se atiende. */
  languages: ['es', 'en'],
  /**
   * Perfiles oficiales. VACÍO A PROPÓSITO hasta que existan las URLs reales:
   * alimentan el `sameAs` del JSON-LD y los enlaces del pie, y las dos cosas
   * fallan igual de mal con un placeholder. Un `sameAs` inventado le afirma a
   * Google una identidad que no podés demostrar; un enlace `href="#"` en el pie
   * de una agencia es la misma clase de humo que una métrica inventada.
   * Se rellenan acá y aparecen solos en los dos sitios.
   */
  social: [] as readonly { label: string; href: string }[],
  /**
   * METADATOS DE CARA A BUSCADORES Y REDES.
   *
   * Fuente de verdad de lo que `index.html` copia. El guardia de desarrollo de
   * `structuredData.ts` avisa si las dos versiones dejan de coincidir.
   */
  meta: {
    /** `<title>` y `og:title`. Marca + las dos divisiones + dónde. */
    title: 'Mood Control — Eventos, DJs y desarrollo web en Utrera, Sevilla',
    description:
      'Mood Control, desde Utrera (Sevilla): Mood Agency produce eventos, DJs y festivales; Mood Creative desarrolla web, inteligencia artificial y software a medida.',
    /** Más corta y más directa: en una tarjeta social no hay sitio para matices. */
    ogDescription:
      'Dos divisiones, un mismo estándar. Mood Agency: producción de eventos, DJs y experiencias. Mood Creative: desarrollo web, IA y software a medida.',
    /** Texto alternativo de la tarjeta social. Lo leen quienes no ven la imagen. */
    ogAlt:
      'Mood Control — Creamos estados de ánimo. Eventos con Mood Agency, tecnología e IA con Mood Creative.',
    /** Ruta de la tarjeta social. Se sirve ABSOLUTA: las redes no resuelven rutas relativas. */
    ogImage: '/og.png',
  },
} as const

/** Home canónica, con barra final. Es lo que declara `<link rel="canonical">`. */
export const HOME_URL = `${SITE.url}/`

/* ─────────  MOOD AGENCY · división de eventos (mundo id 'control')  ─────── */

/* ─────────────────────────────  ARTISTAS  ──────────────────────────────── */

/**
 * QUÉ CLASE DE ACTO SUBE AL ESCENARIO.
 *
 * No es un adorno de diseño: `Rock & Bikes` es una BANDA de seis personas (se ve
 * en la foto que entregó el cliente, camiseta incluida) y `Malbie + Richa` son
 * dos. Presentarlos a todos como "DJs" es un dato incorrecto, y acá no se
 * publica un dato incorrecto ni por comodidad de maquetación.
 */
export type ActKind = 'dj' | 'duo' | 'band'

/**
 * Un artista del roster de Mood Agency.
 *
 * ⚠ DE ESTOS CUATRO SÓLO SE CONOCE EL NOMBRE. Nadie ha confirmado género
 * musical, trayectoria, ciudad, años de carrera, número de shows ni redes.
 * Por eso TODO lo demás es opcional y está vacío: es exactamente la misma
 * regla que vació `CLIENTS` y el portfolio inventado. Un dato inventado en la
 * web de una agencia real no es licencia creativa, es una mentira verificable.
 *
 * `id` y `accent` NO son datos del artista, son datos de PRESENTACIÓN: el id es
 * la clave estable y el acento decide qué neón domina su carta. Inventarlos no
 * engaña a nadie porque no afirman nada del mundo real.
 *
 * ── LA FOTO (`image`) ───────────────────────────────────────────────────────
 *
 * El cliente entrega UNA foto por artista y las coloca ÉL en `public/artists/`.
 * La ruta se declara acá aunque el archivo todavía no exista: `Roster` trata el
 * fallo de carga como un caso NORMAL, no como un error. Si el JPG no está, la
 * carta cae al arte generativo y no se ve ni un icono roto ni un hueco. O sea:
 * la landing es publicable HOY y mejora sola el día que el cliente suba los
 * cuatro archivos, sin tocar una línea de código.
 *
 * El arte generativo NO se retiró: sigue siendo el fondo y el marco de la carta,
 * y es el retrato completo mientras no haya foto.
 */
export interface Artist {
  /** Slug estable. Clave de React y semilla legible del arte generativo. */
  id: string
  /** Nombre REAL, exactamente como lo escribió el cliente. No se retoca. */
  name: string
  /** Qué neón de Mood Agency domina su carta. Presentación, no biografía. */
  accent: 'violet' | 'blue' | 'red'
  /**
   * QUÉ CLASE DE ACTO ES. Dato REAL y verificable, no una etiqueta de relleno:
   * meter una banda de seis personas en una lista titulada "DJs" es información
   * incorrecta, y en la carta funciona como la rareza de un cromo.
   */
  kind: ActKind
  /**
   * Ruta ABSOLUTA desde la raíz servida (`public/`). Opcional porque el día que
   * entre un artista nuevo su foto puede tardar, y la carta tiene que existir
   * igual. Ver el bloque de arriba: que el archivo falte no rompe nada.
   */
  image?: string

  /* ── TODO LO DE ABAJO ESTÁ PENDIENTE DEL CLIENTE ─────────────────────────
     Mientras siga `undefined` la web no dice nada de ese campo: no hay texto
     de relleno, no hay "próximamente" y no hay enlace muerto. En cuanto uno se
     rellene aparece solo en la carta y en su detalle, sin tocar un `.tsx`. */

  /** Una línea de qué hace. Ej. formato de sesión o rol. PREGUNTAR AL CLIENTE. */
  role?: string
  /** Dos o tres frases. PREGUNTAR AL CLIENTE. */
  bio?: string
  /** Perfiles REALES y verificados. Un `href="#"` acá es humo. PREGUNTAR AL CLIENTE. */
  links?: readonly { label: string; href: string }[]
}

/**
 * ROSTER REAL — FUENTE ÚNICA de los artistas de Mood Agency.
 *
 * De acá salen las DOS cosas que los muestran, y por eso añadir un artista es
 * tocar un solo sitio:
 *   1. el carrusel del capítulo `gallery` (`@/sections/Roster`);
 *   2. la lista `roster` del servicio "DJs & Booking", derivada más abajo con
 *      `ARTISTS.map(...)`. NO se escribe a mano: dos listas paralelas divergen
 *      el día que alguien añade un artista con prisa.
 *
 * El reparto de acentos es deliberado: cuatro cartas del mismo violeta se leen
 * como una sola mancha. Se repite violeta en la cuarta porque la paleta de Mood
 * Agency tiene tres neones, no cuatro.
 *
 * ⚠ LAS RUTAS DE `image` APUNTAN A ARCHIVOS QUE EL CLIENTE TODAVÍA NO HA SUBIDO.
 * Las carpetas existen y están vacías. Es deliberado: el nombre del archivo está
 * FIJADO (`01.jpg`) para que subirlo sea la única acción pendiente, y hasta que
 * ocurra la carta se dibuja con el arte generativo. No hay estado roto posible.
 */
export const ARTISTS: readonly Artist[] = [
  { id: 'morales', name: 'DJ Morales', accent: 'violet', kind: 'dj', image: '/artists/morales/01.jpg' },
  { id: 'fati-coronas', name: 'DJ Fati Coronas', accent: 'blue', kind: 'dj', image: '/artists/fati-coronas/01.jpg' },
  { id: 'malbie-richa', name: 'Malbie + Richa', accent: 'red', kind: 'duo', image: '/artists/malbie-richa/01.jpg' },
  { id: 'rock-bikes', name: 'Rock & Bikes', accent: 'violet', kind: 'band', image: '/artists/rock-bikes/01.jpg' },
]

/**
 * Un servicio de la división de eventos.
 *
 * `roster` sólo lo lleva el servicio de booking: son los artistas REALES con los
 * que se trabaja, no un ejemplo. Es opcional porque los otros ocho servicios no
 * tienen artistas asociados, no porque sea relleno.
 */
export interface EventService {
  /** Número de cartel. Dos dígitos, se muestra tal cual. */
  n: string
  title: string
  desc: string
  roster?: readonly string[]
}

const EVENT_SERVICES: readonly EventService[] = [
  { n: '01', title: 'Organización de eventos', desc: 'Concepto, producción y dirección de principio a fin.' },
  {
    n: '02',
    /* ⚠ NO ES "DJs & Booking", Y EL MATIZ ES UN DATO, NO UN GUSTO.
       Debajo de este título se lista `roster`, y ese roster tiene dos DJs, un
       dúo y una BANDA (`Rock & Bikes`, seis personas). Titularlo "DJs" describía
       mal a la mitad de la lista: quien busca una banda para su evento leía
       "DJs" y se iba. El ajuste es el mínimo posible — se añade la palabra que
       faltaba — y sigue conteniendo "DJs", que es lo que la gente escribe en
       Google. Ver `ActKind` y el campo `kind` de `Artist`. */
    title: 'DJs, bandas & booking',
    desc: 'Line-ups curados. Artistas que entienden el sitio y la hora.',
    /* DERIVADO de `ARTISTS`, nunca escrito a mano. Los mismos cuatro nombres se
       muestran en dos sitios —acá y en las cartas del capítulo `gallery`— y dos
       listas paralelas divergen el día que alguien añade un artista con prisa.
       Añadir o quitar un artista es tocar `ARTISTS` y sólo `ARTISTS`. */
    roster: ARTISTS.map((a) => a.name),
  },
  { n: '03', title: 'Festivales', desc: 'Multi-escenario, logística, permisos y operación integral.' },
  { n: '04', title: 'Producción audiovisual', desc: 'Aftermovies, contenido en vivo y visuales generativos.' },
  { n: '05', title: 'Sonido profesional', desc: 'Diseño e ingeniería de PA. Presión sin fatiga.' },
  { n: '06', title: 'Iluminación', desc: 'Diseño lumínico, timecode y programación al detalle.' },
  { n: '07', title: 'Escenarios', desc: 'Estructura, rigging y escenografía a medida.' },
  { n: '08', title: 'Branding para eventos', desc: 'Identidad que funciona en un cartel y en una pulsera.' },
  { n: '09', title: 'Experiencias inmersivas', desc: 'Mapping, interacción y espacios que responden.' },
]

export const EVENTS = {
  /** ⚠ Id TÉCNICO del mundo, no la marca. Ver la cabecera del archivo. */
  id: 'control',
  name: 'Mood Agency',
  kicker: 'División de experiencias en vivo',
  claim: 'Hacemos que la sala se caiga.',
  /** Encabezado de sección con las palabras que la gente escribe en Google, no un claim. */
  servicesHeading: 'Producción de eventos, DJs y festivales',
  intro:
    'Producción integral de eventos. Del primer boceto de escenario al último bis. Sonido, luz, imagen y una idea que lo sostiene todo.',
  services: EVENT_SERVICES,
  /** Copy de la lista de servicios. */
  servicesUI: {
    /** Encabeza los artistas dentro del servicio de booking. */
    rosterLabel: 'Roster',
  },
  artists: ARTISTS,
  /**
   * Copy de las CARTAS COLECCIONABLES del capítulo `gallery`.
   *
   * Vive acá por la misma regla que el resto: en los `.tsx` no se escribe ni una
   * palabra, y las etiquetas de accesibilidad son texto de cara al usuario tanto
   * como un titular.
   *
   * ⚠ Ni una sola clave de acá afirma nada sobre un artista concreto. Todo lo
   * que es específico de una persona sale de `ARTISTS`, y hoy está vacío.
   */
  artistsUI: {
    /** Encabezado de sección. Palabras reales, no un claim. */
    title: 'Los artistas con los que trabajamos',
    /** Etiqueta pequeña sobre el título. */
    kicker: 'Roster',
    /** Se ve bajo el título. Explica la mecánica, no vende humo. */
    hint: 'Pasa el puntero por encima · Pulsa una carta para verla en grande',
    /** `aria-label` del grupo de cartas. Un grupo sin nombre no es un grupo. */
    groupLabel: 'Cartas de los artistas de Mood Agency',
    /** Prefijo del `aria-label` de cada carta. Se compone con el nombre. */
    open: 'Ver la carta de',
    close: 'Cerrar la carta',
    /** Palabra que precede al número de carta: "Carta 01 / 04". */
    cardLabel: 'Carta',
    /** Glifo del cursor magnético sobre una carta. Dos palabras como mucho. */
    cardCta: 'Ver carta',
    sep: ' · ',
    /**
     * TIPO DE ACTO, tal y como se imprime en el marco de la carta.
     *
     * Las claves son los valores de `ActKind`: así el día que aparezca un
     * quinto tipo, TypeScript obliga a traducirlo acá antes de compilar. Nada
     * de `kind.toUpperCase()` en un `.tsx` — eso no es copy, es un accidente.
     */
    kinds: {
      dj: 'DJ',
      duo: 'Dúo',
      band: 'Banda',
    } as const satisfies Record<ActKind, string>,
    /** Prefijo del `alt` de la foto. Se compone con el nombre del artista. */
    photoAlt: 'Fotografía de',
    /**
     * EL SOBRE DE CROMOS. La sección arranca cerrada y se abre al pulsar.
     *
     * Ni una palabra de acá afirma nada de nadie: son la marca, una acción y un
     * recuento REAL (`ARTISTS.length`), que es todo lo que un sobre necesita.
     */
    pack: {
      /** `aria-label` del sobre cerrado. Lo que oye quien no lo ve. */
      label: 'Abrir el sobre de cartas del roster de Mood Agency',
      /** Llamada visible impresa en el sobre. */
      cta: 'Abrir el sobre',
      /** Se compone con el número de artistas: "04 cartas". */
      countLabel: 'cartas',
      /** Repetir la animación. La gente quiere verla dos veces; negarlo es peor. */
      replay: 'Abrir otra vez',
    },
    /** Encabezados del detalle. Sólo se pintan si el campo tiene valor. */
    fields: {
      role: 'Qué hace',
      about: 'Sobre el artista',
      links: 'Dónde escucharlo',
    },
    /**
     * CIERRE DEL DETALLE. Es lo que sostiene la ficha mientras `role`, `bio` y
     * `links` sigan vacíos: en vez de un "próximamente" de relleno, una salida
     * real al formulario. No afirma nada del artista, que es justo el punto.
     */
    booking: {
      body: '¿Quieres fechas, formato de sesión o el rider técnico? Escríbenos y te lo pasamos.',
      cta: 'Consultar disponibilidad',
      /** Ancla al capítulo del formulario. Existe: es `chapter-converge`. */
      href: '#chapter-converge',
    },
  },
} as const

/* ────────  MOOD CREATIVE · división de tecnología (mundo id 'net')  ─────── */

export const TECH = {
  /** ⚠ Id TÉCNICO del mundo, no la marca. Ver la cabecera del archivo. */
  id: 'net',
  name: 'Mood Creative',
  kicker: 'División de tecnología y producto',
  claim: 'Construimos lo que tu negocio todavía no sabe pedir.',
  /** Encabezado de sección con las palabras que la gente escribe en Google, no un claim. */
  servicesHeading: 'Desarrollo web, aplicaciones e inteligencia artificial',
  intro:
    'Software a medida, web e inteligencia artificial. Sin plantillas, sin atajos y sin deuda técnica heredada el día uno.',
  services: [
    { id: 'web', title: 'Desarrollo web', desc: 'Front-end moderno, rápido y accesible de verdad.' },
    { id: 'apps', title: 'Aplicaciones web', desc: 'Producto real: auth, roles, datos y escala.' },
    { id: 'ai', title: 'Inteligencia Artificial', desc: 'Modelos aplicados a un problema concreto, no a una demo.' },
    { id: 'auto', title: 'Automatización', desc: 'Procesos que dejan de comerte horas todos los días.' },
    { id: 'ux', title: 'Diseño UX/UI', desc: 'Investigación, sistema de diseño y prototipo.' },
    { id: 'brand', title: 'Branding digital', desc: 'Identidad pensada para pantalla y para movimiento.' },
    { id: 'custom', title: 'Software a medida', desc: 'Cuando el SaaS de turno ya no te sirve.' },
    { id: 'infra', title: 'Soluciones tecnológicas', desc: 'Arquitectura, integración y consultoría.' },
  ],
  /** Aristas de la red: qué servicio se ilumina con cuál. */
  edges: [
    ['web', 'ux'],
    ['web', 'brand'],
    ['apps', 'web'],
    ['apps', 'infra'],
    ['ai', 'auto'],
    ['ai', 'apps'],
    ['auto', 'infra'],
    ['custom', 'apps'],
    ['custom', 'infra'],
    ['ux', 'brand'],
  ] as ReadonlyArray<readonly [string, string]>,
} as const

/* ───────────────────────────────  PLANES  ──────────────────────────────── */

export type PlanTier = 'basico' | 'pro' | 'premium'

export interface Plan {
  id: PlanTier
  name: string
  /** Nivel de personalización: alimenta la complejidad visual del cristal. */
  level: 1 | 2 | 3
  pitch: string
  /** Señal de precio SIN cifras. El brief es explícito: nada de importes. */
  priceHint: string
  features: readonly string[]
  /** Qué hereda del plan anterior. */
  inherits?: string
  cta: string
}

export const PLANS: readonly Plan[] = [
  {
    id: 'basico',
    name: 'Básico',
    level: 1,
    pitch: 'Para pequeños negocios que necesitan una presencia online profesional.',
    priceHint: 'Punto de partida',
    features: [
      'Landing Page',
      'Web corporativa sencilla',
      'Diseño responsive',
      'SEO básico',
      'Formulario de contacto',
      'Integración con redes sociales',
    ],
    cta: 'Solicitar presupuesto',
  },
  {
    id: 'pro',
    name: 'Pro',
    level: 2,
    pitch: 'Pensado para empresas en crecimiento.',
    priceHint: 'Más personalización, más inversión',
    inherits: 'Todo lo del plan Básico',
    features: [
      'Diseño completamente personalizado',
      'Varias páginas',
      'Panel de administración',
      'Blog',
      'Catálogo',
      'Integraciones externas',
      'SEO avanzado',
      'Animaciones premium',
    ],
    cta: 'Solicitar presupuesto',
  },
  {
    id: 'premium',
    name: 'Premium',
    level: 3,
    pitch: 'Para empresas que quieren diferenciarse completamente.',
    priceHint: 'Proyecto a medida, presupuesto a medida',
    inherits: 'Todo lo del plan Pro',
    features: [
      'Desarrollo totalmente personalizado',
      'Experiencias 3D',
      'Inteligencia Artificial',
      'Automatizaciones',
      'Dashboards',
      'APIs',
      'Aplicaciones web',
      'Escalabilidad',
      'Consultoría tecnológica',
    ],
    cta: 'Solicitar presupuesto',
  },
] as const

/** Nota obligatoria: el brief prohíbe mostrar cifras. */
export const PRICING_NOTE =
  'Cada plan sube de precio a medida que sube el nivel de personalización y la complejidad del proyecto. El presupuesto se calcula sobre tu caso, no sobre una tabla.'

/* ────────────────────────────  STACK & MÉTODO  ─────────────────────────── */

export const STACK = [
  'React', 'TypeScript', 'Next.js', 'Node', 'Three.js', 'WebGL', 'GSAP',
  'TailwindCSS', 'PostgreSQL', 'Python', 'OpenAI', 'Docker', 'AWS', 'Figma',
] as const

export const METHOD = [
  { n: '01', title: 'Escuchar', desc: 'Entendemos el negocio antes que el brief. Si el brief está mal, lo decimos.' },
  { n: '02', title: 'Dirigir', desc: 'Dirección creativa y técnica. Decisiones argumentadas, no gustos.' },
  { n: '03', title: 'Construir', desc: 'Iteración corta, entregas visibles. Nada de cajas negras de tres meses.' },
  { n: '04', title: 'Sostener', desc: 'Medimos, ajustamos y acompañamos. El lanzamiento es el principio.' },
] as const

/**
 * CLIENTES — VACÍO A PROPÓSITO.
 *
 * Acá había diez nombres (`Nocturna`, `Vértice`, `Casa Ruido`, `Lumen`, `Norte`,
 * `Abril`, `Kraken`, `Studio 9`, `Marea`, `Faro`) inventados por una IA para
 * maquetar el muro. Atribuirle clientes a una agencia real es peor todavía que
 * la galería inventada: son terceros con nombre propio que nunca dieron permiso.
 *
 * Se rellena con los nombres REALES que confirme el cliente —y a poder ser con
 * el visto bueno de cada uno para aparecer—. Mientras siga vacío, `Clients`
 * pinta un estado vacío discreto y conserva su viewport de capítulo, que es lo
 * que la coreografía 3D necesita para no descolocarse.
 */
export const CLIENTS: readonly string[] = []

/** Copy del muro de clientes. Hoy sólo hace falta su estado vacío. */
export const CLIENTS_UI = {
  empty: 'Lista de clientes en preparación.',
} as const

/* ─────────────────────────────────  CTA  ───────────────────────────────── */

export const CTA = {
  title: '¿En qué mood estás?',
  sub: 'Cuéntanos qué quieres hacer. Te respondemos con una idea, no con un formulario automático.',
  /* ⚠ Los `id` son los TÉCNICOS ('control' = eventos, 'net' = tecnología): viajan
     dentro del lead y los consume quien recibe el formulario. No son la marca. */
  divisions: [
    { id: 'control', label: 'Quiero producir un evento' },
    { id: 'net', label: 'Quiero desarrollo o tecnología' },
    { id: 'both', label: 'Las dos cosas' },
  ],
  submit: 'Enviar',
} as const

/**
 * Copy del formulario. Vive acá por la misma razón que el resto: en los `.tsx`
 * no se escribe ni una palabra. Incluye los errores de validación, que son
 * texto de cara al usuario tanto como un titular.
 */
export const FORM = {
  fields: {
    name: { label: 'Nombre', placeholder: 'Cómo te llamas' },
    email: { label: 'Email', placeholder: 'Dónde te escribimos' },
    message: { label: 'Tu idea', placeholder: 'Cuéntanos qué quieres hacer' },
  },
  divisionLegend: '¿Con qué división hablas?',
  errors: {
    name: 'Necesitamos un nombre.',
    email: 'Ese email no parece válido.',
    message: 'Cuéntanos algo, aunque sean dos líneas.',
  },
  sending: 'Enviando',
  success: 'Recibido. Te respondemos con una idea, no con una plantilla.',
} as const

/**
 * Qué se le dice a quien acaba de intentar mandar su mensaje y no salió.
 *
 * Una clave por cada motivo de fallo de `submitLead()`. La cerradura vive del
 * otro lado: `FAILURE_MESSAGES` está anotado como `Record<LeadFailure, string>`,
 * así que el día que se añada un motivo nuevo el proyecto deja de compilar hasta
 * que alguien escriba su frase ACÁ. Sin eso, el motivo nuevo llegaría a
 * producción como `undefined` debajo del formulario.
 *
 * Regla de redacción: nada de "algo salió mal". Quien lee esto acaba de escribir
 * tres párrafos y quiere saber dos cosas — si se perdieron y qué hacer ahora.
 */
export const SUBMIT_FEEDBACK = {
  errors: {
    network: 'No llegamos al servidor. Mira tu conexión y vuelve a darle: no has perdido lo escrito.',
    server: 'Ha fallado de nuestro lado, no del tuyo. Prueba en un minuto o escríbenos directo al email.',
    rejected: 'El envío no se aceptó. Revisa el email y vuelve a intentarlo.',
    timeout: 'Está tardando demasiado. Vuelve a darle y, si sigue igual, escríbenos al email.',
    aborted: 'Se ha cancelado el envío. Cuando quieras, lo intentamos de nuevo.',
  },
} as const

/**
 * Copy del PANEL de contacto (el capítulo `converge`).
 *
 * Separado de `FORM` a propósito: `FORM` es el formulario en sí (campos, errores,
 * estados), esto es la superficie que lo contiene y las señales de confianza que
 * lo rodean. Son dos cosas que cambian por motivos distintos.
 *
 * ⚠ REGLA DURA: acá NO se inventa un dato de contacto. Ni teléfono, ni dirección
 * postal, ni horario, ni "te respondemos en 24h". Todo lo que se muestre tiene
 * que salir de `SITE`, que es lo único confirmado. Un tiempo de respuesta
 * inventado en el bloque de confianza es exactamente lo contrario de confianza.
 */
export const CONTACT_PANEL = {
  /** Etiqueta técnica de la cabecera del panel. Es mundo `net`: mono y seco. */
  kicker: 'Briefing',
  /** Encabeza la alternativa al formulario. */
  emailLabel: 'Escríbenos directo',
  /** Encabeza la procedencia. Dato, no promesa. */
  locationLabel: 'Base',
  /** Compuesto desde `SITE`: municipio + provincia. Nada más. */
  location: `${SITE.locality}, ${SITE.region}`,
} as const

/* ────────────────────────────────  APAGÓN  ─────────────────────────────── */

/** Las dos líneas del blackout: el corte narrativo entre las dos divisiones. */
export const BLACKOUT = {
  lines: ['Se acabó el show.', 'Enciende las luces.'],
} as const

export const FOOTER = {
  legal: `© ${new Date().getFullYear()} ${BRAND.name}`,
  /**
   * Sólo enlaces que EXISTEN. Los perfiles sociales salen de `SITE.social`, que
   * hoy está vacío: hasta que el cliente pase las URLs reales el pie muestra
   * únicamente el email. Un `href="#"` con la etiqueta "Instagram" es un enlace
   * que miente, y éste es justo el proyecto donde eso no vuelve a pasar.
   */
  links: [
    ...SITE.social,
    { label: SITE.email, href: `mailto:${SITE.email}` },
  ],
} as const
