# Mood Control — Dirección artística y storyboard

## El concepto: EL NÚCLEO

La mayoría de las landings con Three.js hacen esto: sección con esfera → scroll →
sección con partículas → scroll → sección con cubos. Escenas sueltas. Se ve lindo
y se olvida en diez segundos.

Acá hay **una sola entidad 3D** que vive desde el preloader hasta el footer y
nunca desaparece. Muta. Se fractura. Se reorganiza. Cambia de material, de luz,
de temperatura.

El usuario no sigue scrolleando porque quiera leer los servicios. Sigue
scrolleando porque **quiere ver en qué se convierte esa cosa**.

`MOOD` = estado de ánimo. La landing es literalmente un viaje de estados de
ánimo. El Núcleo es quien los siente.

## Los tres mundos

| | **VOID** | **MOOD AGENCY** (id `control`) | **MOOD CREATIVE** (id `net`) |
|---|---|---|---|
| Rol | Potencial puro | El show | La precisión |
| Fondo | `#050505` | `#0A0208` | `#0B0D0F` |
| Tinta | `#F2F0EB` | `#FFFFFF` | `#FAFAFA` |
| Acentos | iridiscente `#8A7CFF` | `#B026FF` `#00A3FF` `#FF2D55` | `#00E5FF` `#2E6BFF` `#8B95A5` |
| Bloom | 0.35 | **1.15** | 0.28 |
| Niebla | 0.035 | 0.075 | 0.02 |
| Aberración | mínima | fuerte | casi nula |
| Ritmo | lento, respirando | rápido, al beat, sucio | quirúrgico, lineal |

Definidos en [`src/core/palette.ts`](src/core/palette.ts). Ningún componente
hardcodea un hex.

## El apagón de sala

El momento que la gente va a recordar. Cuando termina Mood Agency **no hay un
fade**: pasa lo mismo que cuando se termina un show de verdad. Los neones se
apagan uno a uno, el humo se disipa, negro total, un segundo de silencio... y se
encienden las luces de sala. Blanco. Frío. Real.

La clave es la **asimetría**: se apaga seco (22 milésimas de progreso) y se
enciende perezoso (45). Está en `blackoutAmount()`.

## Tipografía

**Archivo** variable en los ejes `wght` + `wdth`. La elección no es estética: al
ser variable en ancho, **las letras se estiran y se comprimen con el scroll**.
Eso resuelve el "cambios de peso" del brief sin coste de rendimiento.

**JetBrains Mono** para datos, labels y el decode-text de Mood Creative.

Títulos hasta `22rem`. La tipografía ES la imagen, no un adorno.

## El recorrido

Scroll global normalizado 0 → 1. Un solo timeline. Rangos en
[`src/core/chapters.ts`](src/core/chapters.ts).

| Progreso | Capítulo | DOM | El Núcleo |
|---|---|---|---|
| — | **Preloader** | contador 0→100, `MOOD` se ensambla, "ENTER THE MOOD" | — |
| `.00–.08` | **Hero** | `MOOD CONTROL` en mask-reveal, centro despejado | Esfera de noise respirando, iridiscente, partículas en órbita, parallax de mouse |
| `.08–.16` | **Manifiesto** | "No hacemos webs / No hacemos eventos / Creamos ESTADOS DE ÁNIMO" palabra a palabra | La cámara entra hacia el núcleo |
| `.16–.24` | **División** | split 50/50 que se separa desde el centro | Fractura → partículas → wordmark `MOOD` → se parte en dos, violeta ← → cian |
| `.24–.30` | **Agency · intro** | `MOOD AGENCY` con glitch y aberración | Blackout, un beat, se encienden las luces de escenario. Humo |
| `.30–.40` | **Control · servicios** | 9 servicios tipo créditos de festival, hover neón | Lasers barriendo, luces rotando, flicker al beat |
| `.40–.48` | **Artistas** | 4 cartas coleccionables: inclinación 3D, holografía y arte generativo por nombre | Pantallas LED, máxima energía |
| `.48–.54` | **Apagón** | una línea en el negro | **EL APAGÓN**: neones off uno a uno, humo se disipa, luz de sala |
| `.54–.60` | **Creative · intro** | `MOOD CREATIVE` con decode-text, grid técnica | Partículas en retícula perfecta, nodos que se conectan |
| `.60–.68` | **Net · servicios** | 8 servicios como nodos; hover ilumina sus aristas | La red completa, líneas de 1px |
| `.68–.80` | **Planes** | 3 paneles escalando en elaboración, sin cifras | **3 cristales**: cubo mate → prisma con refracción → cristal iridiscente con partículas propias |
| `.80–.86` | **Stack** | marquee de tecnologías + método en 4 pasos | La red de fondo, quieta |
| `.86–.90` | **Clientes** | muro de wordmarks con reveal | — |
| `.90–.98` | **Convergencia** | "¿En qué mood estás?" + formulario | Partículas violetas y cian chocan en el centro y colapsan en un punto de luz |
| `.98–1.0` | **Footer** | legal y links | El punto de luz, quieto |

## Los tres cristales

La jerarquía de precio se comunica **visualmente**, sin mostrar una sola cifra:

- **Básico** — cubo simple, material mate. Limpio, honesto, sin adornos.
- **Pro** — prisma con refracción real (`MeshTransmissionMaterial`), luz interna,
  algunas partículas.
- **Premium** — cristal complejo iridiscente, distorsión, partículas propias
  orbitando, luz volumétrica. Levita más alto y rota más.

El salto de complejidad entre uno y otro ES el argumento de venta.

## Por qué un solo Canvas

1. **Narrativa** — es lo único que permite que el Núcleo sea *el mismo objeto*
   transformándose. Montando y desmontando canvases se rompe la ilusión, y el
   usuario lo siente aunque no sepa explicarlo.
2. **Rendimiento** — un contexto WebGL, un render loop, buffers de partículas
   reutilizados. Es la diferencia entre 60fps sólidos y un tirón cada vez que
   entra una sección.

## Rendimiento

`getQuality()` detecta el músculo del dispositivo una vez y reparte el
presupuesto. No es una "versión mobile": es la misma historia con menos
polígonos.

| | low | mid | high |
|---|---|---|---|
| Partículas | 18k | 26k | 45k |
| Detalle de esfera | 64 | 128 | 192 |
| Presupuesto de píxeles | 1,1M | 1,8M | 2,4M |
| Post-processing | bloom + tone | sin aberración ni grano | cadena completa |
| Pasos volumétricos | 0 | 12 | 20 |

El DPR **no se fija**: se deriva del presupuesto de píxeles (`dpr = √(presupuesto
/ área)`). El post-proceso cuesta por píxel y escala con el cuadrado del DPR, así
que fijarlo en 2 funde una GPU en 1440p y desaprovecha una pantalla pequeña.

Y la calidad además se **mide en vivo**: si los FPS caen de forma sostenida, el
tier baja solo. Nunca sube: una oscilación de calidad se nota mucho más que una
calidad estable un escalón por debajo.

Con `prefers-reduced-motion` se recorta el movimiento pero **no la narrativa**:
las 14 secciones se leen igual.

---

Las reglas de implementación están en [ARCHITECTURE.md](ARCHITECTURE.md).
