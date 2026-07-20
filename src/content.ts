/**
 * Todo el copy y los datos de la landing, en un solo lugar.
 *
 * Ningún componente escribe texto a mano. Si mañana Mood Agency cambia un
 * servicio o quiere la web en inglés, se toca ESTE archivo y nada más.
 */

export const AGENCY = {
  name: 'Mood Agency',
  tagline: 'Creamos estados de ánimo',
  claim: ['No hacemos webs.', 'No hacemos eventos.', 'Creamos ESTADOS DE ÁNIMO.'],
  manifesto:
    'Un mood es lo que queda cuando el evento terminó y la pantalla se apagó. Nosotros diseñamos esa huella: con luz, con sonido, con código.',
} as const

/* ────────────────────────────  MOOD CONTROL  ──────────────────────────── */

export const CONTROL = {
  id: 'control',
  name: 'Mood Control',
  kicker: 'División de experiencias en vivo',
  claim: 'Hacemos que la sala se caiga.',
  intro:
    'Producción integral de eventos. Del primer boceto de escenario al último bis. Sonido, luz, imagen y una idea que lo sostiene todo.',
  services: [
    { n: '01', title: 'Organización de eventos', desc: 'Concepto, producción y dirección de principio a fin.' },
    { n: '02', title: 'DJs & Booking', desc: 'Line-ups curados. Artistas que entienden el sitio y la hora.' },
    { n: '03', title: 'Festivales', desc: 'Multi-escenario, logística, permisos y operación integral.' },
    { n: '04', title: 'Producción audiovisual', desc: 'Aftermovies, contenido en vivo y visuales generativos.' },
    { n: '05', title: 'Sonido profesional', desc: 'Diseño e ingeniería de PA. Presión sin fatiga.' },
    { n: '06', title: 'Iluminación', desc: 'Diseño lumínico, timecode y programación al detalle.' },
    { n: '07', title: 'Escenarios', desc: 'Estructura, rigging y escenografía a medida.' },
    { n: '08', title: 'Branding para eventos', desc: 'Identidad que funciona en un cartel y en una pulsera.' },
    { n: '09', title: 'Experiencias inmersivas', desc: 'Mapping, interacción y espacios que responden.' },
  ],
  /**
   * PORTFOLIO.
   *
   * `images` apunta a `public/gallery/<id>/NN.jpg`. Los archivos todavía no
   * existen: la galería tiene fallback a placeholder por imagen, así que el
   * cliente puede ir subiendo fotos de a una sin romper nada ni tocar código.
   * Ver `public/gallery/README.md`.
   *
   * `accent` decide qué neón de Control domina la tarjeta y su ficha. Es dato,
   * no estilo: el componente lo traduce a un token, nunca a un hex.
   */
  gallery: [
    {
      id: 'g1',
      title: 'Nocturna',
      meta: 'Festival · 12.000 asistentes',
      year: '2024',
      client: 'Nocturna Festival',
      location: 'Ciudad de las Artes, Valencia',
      role: ['Dirección creativa', 'Producción integral', 'Diseño de sonido', 'Iluminación y timecode'],
      description:
        'Tres noches, dos escenarios y una sola idea: que la noche no se sintiera igual en ningún momento. Diseñamos el recorrido lumínico completo para que cada cambio de line-up leyera como un capítulo distinto. El cierre se programó al frame contra el amanecer.',
      stats: [
        { label: 'Asistentes', value: '12.000' },
        { label: 'Escenarios', value: '2' },
        { label: 'Noches', value: '3' },
      ],
      images: ['/gallery/g1/01.jpg', '/gallery/g1/02.jpg', '/gallery/g1/03.jpg'],
      accent: 'violet',
    },
    {
      id: 'g2',
      title: 'Blackroom',
      meta: 'Club series · 8 fechas',
      year: '2023 — 2024',
      client: 'Sala Blackroom',
      location: 'Poblenou, Barcelona',
      role: ['Concepto de serie', 'Booking y line-up', 'Escenografía', 'Visuales generativos'],
      description:
        'Ocho fechas con una única regla: nada de luz blanca. Construimos una serie de club donde el sonido manda y la imagen se le rinde. Cada fecha estrenó un visual generativo hecho a medida de ese line-up.',
      stats: [
        { label: 'Fechas', value: '8' },
        { label: 'Artistas', value: '21' },
        { label: 'Ocupación media', value: '96%' },
      ],
      images: ['/gallery/g2/01.jpg', '/gallery/g2/02.jpg', '/gallery/g2/03.jpg'],
      accent: 'blue',
    },
    {
      id: 'g3',
      title: 'Solstice',
      meta: 'Open air · Producción integral',
      year: '2024',
      client: 'Solstice Open Air',
      location: 'Cabo de Gata, Almería',
      role: ['Producción integral', 'Permisos y logística', 'Diseño de escenario', 'Sonido profesional'],
      description:
        'Un open air en mitad de un parque natural: cero infraestructura y cero excusas. Llevamos generación, agua, PA y estructura a un sitio donde no entraba un camión. Se montó y se desmontó sin dejar rastro.',
      stats: [
        { label: 'Asistentes', value: '4.500' },
        { label: 'Montaje', value: '9 días' },
        { label: 'Residuo neto', value: '0 kg' },
      ],
      images: ['/gallery/g3/01.jpg', '/gallery/g3/02.jpg', '/gallery/g3/03.jpg'],
      accent: 'red',
    },
    {
      id: 'g4',
      title: 'Reactor',
      meta: 'Mapping · Fachada 40m',
      year: '2023',
      client: 'Fundación Reactor',
      location: 'Antiguo Matadero, Madrid',
      role: ['Dirección creativa', 'Mapping arquitectónico', 'Producción audiovisual', 'Diseño sonoro'],
      description:
        'Cuarenta metros de fachada industrial convertidos en una máquina que respira. El mapping no decora el edificio: lo desarma y lo vuelve a montar tres veces por pase. Doce minutos, siete pases por noche, cuatro noches.',
      stats: [
        { label: 'Fachada', value: '40 m' },
        { label: 'Proyectores', value: '14' },
        { label: 'Pases', value: '28' },
      ],
      images: ['/gallery/g4/01.jpg', '/gallery/g4/02.jpg', '/gallery/g4/03.jpg'],
      accent: 'blue',
    },
    {
      id: 'g5',
      title: 'Pulse',
      meta: 'Corporate · Lanzamiento',
      year: '2025',
      client: 'Pulse Mobility',
      location: 'Pabellón 8, IFEMA Madrid',
      role: ['Dirección de evento', 'Escenografía', 'Contenido en vivo', 'Branding para eventos'],
      description:
        'Un lanzamiento de producto que no quería parecerse a una keynote. Cambiamos las filas de sillas por un recorrido: el público caminaba y el producto aparecía. La prensa salió con el titular que buscaba el cliente, sin que se lo dictáramos.',
      stats: [
        { label: 'Invitados', value: '800' },
        { label: 'Impactos en prensa', value: '64' },
        { label: 'Duración', value: '52 min' },
      ],
      images: ['/gallery/g5/01.jpg', '/gallery/g5/02.jpg', '/gallery/g5/03.jpg'],
      accent: 'violet',
    },
    {
      id: 'g6',
      title: 'Neón Sur',
      meta: 'Festival · 3 escenarios',
      year: '2024',
      client: 'Neón Sur',
      location: 'Puerto de Málaga',
      role: ['Producción integral', 'Booking', 'Diseño lumínico', 'Operación multi-escenario'],
      description:
        'Tres escenarios dentro de un puerto activo, con horarios de carga que no se negocian. Toda la programación se diseñó alrededor de esa restricción en vez de pelearse con ella. Los solapes se calcularon para que nunca compitiera un bombo con otro.',
      stats: [
        { label: 'Escenarios', value: '3' },
        { label: 'Asistentes', value: '9.200' },
        { label: 'Horas de show', value: '31' },
      ],
      images: ['/gallery/g6/01.jpg', '/gallery/g6/02.jpg', '/gallery/g6/03.jpg'],
      accent: 'red',
    },
    {
      id: 'g7',
      title: 'Vórtice',
      meta: 'Immersive · Instalación',
      year: '2025',
      client: 'Bienal Vórtice',
      location: 'Nave 16, Zaragoza',
      role: ['Concepto e instalación', 'Interacción y sensores', 'Diseño sonoro', 'Producción técnica'],
      description:
        'Una sala que reacciona a cuánta gente hay adentro. Vacía es un zumbido y una línea de luz; llena se vuelve un organismo. Nadie recibe instrucciones al entrar: la instalación se explica sola.',
      stats: [
        { label: 'Visitantes', value: '23.000' },
        { label: 'Superficie', value: '640 m²' },
        { label: 'Semanas en cartel', value: '11' },
      ],
      images: ['/gallery/g7/01.jpg', '/gallery/g7/02.jpg', '/gallery/g7/03.jpg'],
      accent: 'violet',
    },
    {
      id: 'g8',
      title: 'Cierre',
      meta: 'Aftermovie · Dirección',
      year: '2024',
      client: 'Mood Agency',
      location: 'Rodaje en 5 ciudades',
      role: ['Dirección', 'Producción audiovisual', 'Montaje y color', 'Diseño sonoro'],
      description:
        'El aftermovie de una temporada entera contada como si fuera una sola noche. Se rodó en cinco ciudades y se montó para que no se note ni una vez el corte entre ellas. Es la pieza que mejor explica qué hacemos cuando no podemos estar delante.',
      stats: [
        { label: 'Material bruto', value: '38 h' },
        { label: 'Pieza final', value: '2:48' },
        { label: 'Reproducciones', value: '1,4 M' },
      ],
      images: ['/gallery/g8/01.jpg', '/gallery/g8/02.jpg', '/gallery/g8/03.jpg'],
      accent: 'blue',
    },
  ],
  /**
   * Copy de la UI de la galería (carrusel + ficha de proyecto).
   * Vive acá por la misma regla que el resto: en los `.tsx` no se escribe ni una
   * palabra, y las etiquetas de accesibilidad son texto de cara al usuario
   * tanto como un titular.
   */
  galleryUI: {
    cta: 'Ver proyecto',
    hint: 'Arrastrá para explorar · Clic para ver la ficha',
    prev: 'Proyecto anterior',
    next: 'Proyecto siguiente',
    goTo: 'Ir al proyecto',
    close: 'Cerrar la ficha del proyecto',
    sep: ' · ',
    fields: {
      year: 'Año',
      client: 'Cliente',
      location: 'Dónde',
      role: 'Qué hicimos',
    },
    aboutLabel: 'El proyecto',
    statsLabel: 'En números',
    imagesLabel: 'Galería',
    imageAlt: 'Imagen del proyecto',
    prevImage: 'Imagen anterior',
    nextImage: 'Imagen siguiente',
    goToImage: 'Ir a la imagen',
    /** Se muestra sobre el placeholder cuando la foto todavía no está subida. */
    pending: 'Imagen en producción',
    liveLabel: 'Proyecto en pantalla',
  },
} as const

/* ──────────────────────────────  MOOD NET  ─────────────────────────────── */

export const NET = {
  id: 'net',
  name: 'Mood Net',
  kicker: 'División de tecnología y producto',
  claim: 'Construimos lo que tu negocio todavía no sabe pedir.',
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

export const CLIENTS = [
  'Nocturna', 'Vértice', 'Casa Ruido', 'Lumen', 'Norte', 'Abril',
  'Kraken', 'Studio 9', 'Marea', 'Faro',
] as const

/* ─────────────────────────────────  CTA  ───────────────────────────────── */

export const CTA = {
  title: '¿En qué mood estás?',
  sub: 'Contanos qué querés hacer. Te respondemos con una idea, no con un formulario automático.',
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
    name: { label: 'Nombre', placeholder: 'Cómo te llamás' },
    email: { label: 'Email', placeholder: 'Dónde te escribimos' },
    message: { label: 'Tu idea', placeholder: 'Contanos qué querés hacer' },
  },
  divisionLegend: '¿Con qué división hablás?',
  errors: {
    name: 'Necesitamos un nombre.',
    email: 'Ese email no parece válido.',
    message: 'Contanos algo, aunque sean dos líneas.',
  },
  sending: 'Enviando',
  success: 'Recibido. Te respondemos con una idea, no con una plantilla.',
} as const

/* ────────────────────────────────  APAGÓN  ─────────────────────────────── */

/** Las dos líneas del blackout: el corte narrativo entre las dos divisiones. */
export const BLACKOUT = {
  lines: ['El show terminó.', 'Encendé las luces.'],
} as const

export const FOOTER = {
  legal: `© ${new Date().getFullYear()} Mood Agency`,
  links: [
    { label: 'Instagram', href: '#' },
    { label: 'LinkedIn', href: '#' },
    { label: 'Behance', href: '#' },
    { label: 'hola@moodagency.com', href: 'mailto:hola@moodagency.com' },
  ],
} as const
