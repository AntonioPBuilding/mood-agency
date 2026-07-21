# Mood Control

Landing de **Mood Control**, con base en Utrera (Sevilla) y sus dos divisiones:
**Mood Agency** (eventos, DJs, festivales) y **Mood Creative** (web, IA, software
a medida). Una sola página, 14 capítulos encadenados por scroll, con un fondo de
partículas WebGL que reacciona al avance de la lectura.

> ⚠ Los ids internos `'control'` y `'net'` **no** son nombres de marca:
> `'control'` es el mundo de eventos (Mood Agency) y `'net'` el de tecnología
> (Mood Creative). Ver la cabecera de [`src/content.ts`](src/content.ts).

---

## Arrancar

```bash
npm install
npm run dev
```

Y listo: <http://localhost:5173>.

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Typecheck (`tsc -b`) y build de producción |
| `npm run preview` | Sirve el build ya hecho |
| `npm run lint` | Oxlint |

> El capítulo `gallery` ya no es un portfolio: son las **cartas coleccionables**
> del roster de artistas (`ARTISTS` en `src/content.ts`). No lleva ni una foto y
> no hace falta subir ninguna — el arte de cada carta se genera de forma
> determinista a partir del nombre del artista. Ver `src/sections/Roster.tsx`.

---

## Configurar el formulario de contacto

**Sin configurar, el formulario NO manda el lead.** Valida, dice "Recibido" y
tira el mensaje a la basura. Es a propósito —así se desarrolla en local sin
credenciales— pero es lo primero que hay que resolver antes de publicar.

```bash
cp .env.example .env.local
```

Y en `.env.local`:

```ini
VITE_LEAD_ENDPOINT=https://formspree.io/f/xxxxxxxx
```

Con la variable puesta, [`src/ui/submitLead.ts`](src/ui/submitLead.ts) hace un
`POST` de JSON de verdad. Sin ella, simula 900ms de latencia y responde OK. El
resultado viene marcado (`{ ok: true, simulated: true }`), así que quien llama
siempre puede distinguir un envío real de uno de mentira.

En desarrollo, además, avisa por consola. Si ves esto, el lead no salió:

```
[mood] VITE_LEAD_ENDPOINT no está definida: el formulario simula el envío…
```

### Qué se envía

`POST` con `Content-Type: application/json`:

```json
{
  "name": "…",
  "email": "…",
  "message": "…",
  "division": "control",
  "divisionLabel": "Quiero producir un evento",
  "page": "https://moodcontrol.es/",
  "sentAt": "2026-01-31T10:12:00.000Z"
}
```

`division` puede ser `"control"`, `"net"`, `"both"` o `null`. La etiqueta viaja
junto al id a propósito: en la bandeja de quien lee el lead, `"both"` no
significa nada y `"Las dos cosas"` sí.

### Con qué proveedor

| | Cómo se configura | Notas |
| --- | --- | --- |
| **Formspree** | Creá un form y copiá `https://formspree.io/f/<id>` | Lo más rápido. Acepta JSON tal cual. Ya mandamos `Accept: application/json`, que es lo que evita que responda un redirect a su página de gracias. |
| **Web3Forms** | `https://api.web3forms.com/submit` | Pide un campo `access_key` en el cuerpo: hay que añadirlo en `body()` de `submitLead.ts`. |
| **Resend / Postmark** | **No apuntes acá directamente** | Su API pide una API key, y todo lo que lleva prefijo `VITE_` acaba visible en el bundle. Poné delante una función serverless (Vercel, Netlify, Cloudflare) que guarde la key y llame al proveedor. |
| **Endpoint propio** | La URL de tu API | Tiene que aceptar CORS desde el dominio del sitio y devolver 2xx cuando el lead se guarda. |

Lo único que se le pide al endpoint: **responder 2xx si el lead llegó.** El
módulo distingue 4xx (`rejected`), 5xx (`server`), sin respuesta (`network`) y
más de 15s (`timeout`), y nunca lanza: siempre devuelve un resultado tipado.

> ⚠ Nada con prefijo `VITE_` es secreto. Va compilado dentro del JS que descarga
> cualquiera. Ahí sólo van URLs públicas de recepción.

### Enchufarlo en la sección

El módulo ya está exportado desde `@/ui`; a `Converge` le queda cambiar su
`setTimeout` por:

```ts
const result = await submitLead({ ...values, division })

if (result.ok) {
  setStatus('sent')
} else if (result.reason !== 'aborted') {
  // Un texto distinto por motivo: "revisá tu conexión" no ayuda a nadie
  // cuando el que se cayó es nuestro servidor.
  setError(leadErrorMessage(result.reason))
  setStatus('idle')
}
```

Los cinco textos viven en `SUBMIT_FEEDBACK` de `src/content.ts`, como todo el
copy. `leadErrorMessage()` los comprueba contra el tipo `LeadFailure`: si
aparece un motivo de fallo nuevo sin su frase, **no compila**.

---

## Cómo funciona

### El scroll manda

No hay scroll hijack. Lenis aporta el suavizado y **`gsap.ticker` es el único
`requestAnimationFrame` de todo el sitio**: Lenis, ScrollTrigger, el HUD, el
cursor y la escena 3D cuelgan de ese mismo latido. Un solo reloj, nada de rAFs
sueltos compitiendo entre sí.

El progreso del scroll vive en un objeto mutable de módulo
([`src/core/scrollStore.ts`](src/core/scrollStore.ts)), **nunca en estado de
React**. Es la regla central del proyecto: si el scroll entrase por `useState`,
cada frame dispararía un render del árbol entero. React monta la página; el
scroll la anima por debajo.

Los capítulos no se fijan con GSAP sino con CSS: cada uno es una `<section>` alta
con un hijo `sticky top-0 h-screen`. Más barato y más predecible.

### El fondo

Un único `<canvas>` fijo detrás de todo el DOM
([`src/scenes/Particles.tsx`](src/scenes/Particles.tsx)). Los buffers se
construyen **una sola vez** al montar; a partir de ahí cada frame sólo escribe un
puñado de uniforms escalares y toda la morfología ocurre en el vertex shader. El
wordmark se obtiene rasterizando texto en un canvas 2D y leyendo sus píxeles de
tinta, también una única vez.

Encima va una cadena de postproceso: bloom, aberración cromática, viñeta y grano.

### Calidad adaptativa

El detalle que evita que esto vaya a tirones en una máquina modesta. En vez de
decidir la carga una vez al arrancar adivinando por el user-agent, el sitio
**mide los FPS reales** con una media móvil y, si el rendimiento cae de forma
sostenida, baja de escalón: menos partículas, menos DPR y una cadena de
postproceso más corta. Con histéresis y enfriamiento, para que no oscile.

Reducir el número de partículas es `setDrawRange`, sin reconstruir buffers. Para
que recortar por la mitad no deje media escena vacía, el orden de las partículas
se baraja al construirlas: cualquier prefijo del buffer es una muestra uniforme
del conjunto.

El render además se **pausa** cuando la pestaña está oculta o cuando una capa
opaca tapa la pantalla ([`src/core/overlayStore.ts`](src/core/overlayStore.ts)).

Para depurar, desde la consola:

```js
window.__moodQuality.force('low')   // 'high' | 'mid' | 'low'
```

El escalón activo se refleja en `<html data-quality="…">`.

### Cuando no hay WebGL

Toda la identidad visual vive dentro del `<canvas>`. Sin él, esto era una
pantalla negra con texto encima. Hay tres formas de quedarse sin escena y las
tres están cubiertas:

| Qué pasa | Cómo se detecta | Qué se hace |
| --- | --- | --- |
| El dispositivo no soporta WebGL | `hasWebGL()` antes del primer render | El `<Canvas>` no llega a montarse |
| La escena revienta (chunk que no llega, shader que no compila) | `<SceneBoundary>`, un ErrorBoundary alrededor del Canvas | Se apaga la escena, el DOM sigue vivo |
| El navegador quita el contexto | `webglcontextlost` | Se espera 6s a `webglcontextrestored` y se recupera sola |

En los tres casos entra [`SceneFallback`](src/ui/SceneFallback.tsx): degradados
radiales que leen `--world-accent` y `--world-bg`, o sea que **viajan de VOID a
Mood Agency y a Mood Creative con el scroll igual que lo haría la escena**, sin una
línea de JS por frame. Los 14 capítulos son DOM puro y se leen idénticos.

Dos cosas que parecen detalle y deciden si esto funciona:

- **`preventDefault()` en `webglcontextlost`.** Sin él el navegador nunca emite
  `webglcontextrestored` y una pérdida recuperable se vuelve permanente.
- **El Canvas no se desmonta mientras se espera la recuperación.** El evento lo
  emite ese elemento: si lo quitás del árbol, te quedás sin nadie a quien
  escuchar. Se tapa con el fallback y se espera.

El preloader, además, lleva un **watchdog de 12s**. Es una pantalla opaca que
bloquea el scroll: si su timeline no terminara nunca, el usuario no vería "una
web sin animación", vería un rectángulo negro sin salida.

Para probarlo sin romper nada, desde la consola:

```js
// Simula la pérdida de contexto
document.querySelector('canvas').getContext('webgl2')
  .getExtension('WEBGL_lose_context').loseContext()
```

### El carrusel de proyectos

Es un anillo infinito de verdad: al pasar del último proyecto **se sigue
avanzando hacia adelante** y reaparece el primero, sin rebote ni tope.

No se desplaza la pista: se reposiciona cada tarjeta con aritmética modular, de
modo que la que sale por un borde reaparece por el otro. El índice es virtual e
ilimitado, así que ir del 8 al 9 (que es el 1 de la vuelta siguiente) es seguir
restando píxeles en la misma dirección. Acepta arrastre, rueda horizontal,
teclado y autoplay.

### Rendimiento en la capa DOM

Dos reglas que conviene respetar al tocar esto:

1. **En hover sólo se animan `transform` y `opacity`.** Cualquier otra cosa
   (color, sombra, fondo) se resuelve superponiendo una capa ya pintada y
   moviéndole la opacidad. Interpolar `color` o un `text-shadow` sobre
   tipografía de 96px es medio segundo re-rasterizando texto gigante.
2. **`will-change` se enciende y se apaga.** La utilidad `.gpu` sólo va en
   elementos que animan de forma continua. En lo que anima una vez, se activa en
   el `onStart` del tween y se retira en el `onComplete`.

### Accesibilidad

Una landing premium que no se puede tabular no es premium, es rota.

- **Dos atajos de teclado** ([`SkipLink`](src/ui/SkipLink.tsx)), primer punto de
  tabulación del documento: *saltar al contenido* e *ir al formulario de
  contacto*. El segundo no es relleno de checklist: son 25 viewports sin
  navegación, y sin él llegar al formulario con el teclado es tabular a ciegas
  por catorce capítulos.
- **Un solo `<h1>`** (el wordmark del Hero). El resto de capítulos abren con
  `<h2>`; la ficha de proyecto usa `<h3>`/`<h4>` dentro de su modal.
- `<main id="contenido">` con `tabIndex={-1}`, para que el atajo mueva el **foco**
  y no sólo el scroll.
- El HUD de scroll es cromo decorativo: `aria-hidden` y sin eventos de puntero.
- El carrusel se maneja con flechas, el modal atrapa el foco y cierra con
  `Escape` devolviendo el foco a quien lo abrió.
- El cursor personalizado apaga el del sistema (`cursor: none`), así que
  `:focus-visible` lleva contorno de 2px en el acento del mundo activo. Eso no
  se negocia por estética.
- `prefers-reduced-motion` recorta el movimiento pero **no** la narrativa: las 14
  secciones se leen igual.

### Metadatos y compartir

- **JSON-LD en dos capas.** `index.html` trae una `Organization` mínima escrita a
  mano —lo que ve un rastreador sin JS— y
  [`structuredData.ts`](src/ui/structuredData.ts) la sustituye al arrancar por el
  grafo completo (las dos divisiones, sus 17 servicios, el contacto) generado
  desde `src/content.ts`. Un JSON-LD escrito a mano es una copia del catálogo
  que nadie actualiza.
- **Tarjeta social real** en `public/og.png` (1200×630), con su SVG fuente al
  lado. Cómo re-exportarla: [`public/README.md`](public/README.md).
- **Las URLs de Open Graph son absolutas.** Los rastreadores sociales no
  resuelven rutas relativas.
- Al cambiar de dominio hay que tocar `index.html` (canonical, `og:url`,
  `og:image`, `twitter:image`) **y** `SITE.url` en `src/content.ts`.

---

## Dónde tocar qué

| Quiero cambiar… | Archivo |
| --- | --- |
| Textos, servicios, proyectos, planes | [`src/content.ts`](src/content.ts) |
| Dominio, email, perfiles sociales | `SITE` en [`src/content.ts`](src/content.ts) |
| Orden y nombres de los capítulos | [`src/core/chapters.ts`](src/core/chapters.ts) |
| Escala tipográfica, colores, easings | [`src/index.css`](src/index.css) |
| Presupuestos de calidad y umbrales de FPS | [`src/core/quality.ts`](src/core/quality.ts) |
| Una sección concreta | `src/sections/` |
| Adónde se manda el formulario | `.env.local` → `VITE_LEAD_ENDPOINT` |
| Metas, canonical, tarjeta social | [`index.html`](index.html) |
| Favicon, iconos de app, `og.png` | [`public/README.md`](public/README.md) |

```
src/
  content.ts      Todo el copy en un único sitio (+ SITE: dominio y contacto)
  core/           Scroll, capítulos, calidad, overlays
  scenes/         Partículas y postproceso (Three + R3F)
  sections/       Un archivo por capítulo
  ui/             Cursor, HUD, preloader, botones, atajos de teclado,
                  fallback de WebGL, envío del formulario, JSON-LD
  shaders/        GLSL
```

---

## Stack

React 19 · TypeScript · Vite 8 · Tailwind 4 · Three.js + React Three Fiber ·
GSAP (ScrollTrigger + ticker) · Lenis · Motion

Para el detalle de las decisiones de arquitectura y sus porqués:
[`ARCHITECTURE.md`](ARCHITECTURE.md). Para el guion narrativo de los capítulos:
[`STORYBOARD.md`](STORYBOARD.md).
