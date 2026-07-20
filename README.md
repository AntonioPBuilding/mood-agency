# Mood Agency

Landing de una agencia de eventos. Una sola página, 14 capítulos encadenados por
scroll, con un fondo de partículas WebGL que reacciona al avance de la lectura.

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

> Las fotos del portfolio todavía no están: `public/gallery/` está vacío, así que
> las tarjetas caen a un degradado de respaldo. Es el comportamiento esperado
> hasta que lleguen las imágenes reales.

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

---

## Dónde tocar qué

| Quiero cambiar… | Archivo |
| --- | --- |
| Textos, servicios, proyectos, planes | [`src/content.ts`](src/content.ts) |
| Orden y nombres de los capítulos | [`src/core/chapters.ts`](src/core/chapters.ts) |
| Escala tipográfica, colores, easings | [`src/index.css`](src/index.css) |
| Presupuestos de calidad y umbrales de FPS | [`src/core/quality.ts`](src/core/quality.ts) |
| Una sección concreta | `src/sections/` |

```
src/
  content.ts      Todo el copy en un único sitio
  core/           Scroll, capítulos, calidad, overlays
  scenes/         Partículas y postproceso (Three + R3F)
  sections/       Un archivo por capítulo
  ui/             Cursor, HUD, preloader, botones
  shaders/        GLSL
```

---

## Stack

React 19 · TypeScript · Vite 8 · Tailwind 4 · Three.js + React Three Fiber ·
GSAP (ScrollTrigger + ticker) · Lenis · Motion

Para el detalle de las decisiones de arquitectura y sus porqués:
[`ARCHITECTURE.md`](ARCHITECTURE.md). Para el guion narrativo de los capítulos:
[`STORYBOARD.md`](STORYBOARD.md).
