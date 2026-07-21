# Assets estáticos

Todo lo que hay acá se sirve tal cual desde la raíz del sitio: `public/og.png`
se pide como `/og.png`. Vite no los procesa, no les pone hash y no los optimiza
— lo que subís es exactamente lo que se descarga.

| Archivo | Para qué | Origen |
| --- | --- | --- |
| `favicon.svg` | Icono de pestaña | fuente, a mano |
| `icon.svg` | Icono de app (PWA / iOS / Android) | fuente, a mano |
| `apple-touch-icon.png` (180×180) | Pantalla de inicio de iOS | exportado de `icon.svg` |
| `icon-192.png`, `icon-512.png` | Manifiesto web | exportado de `icon.svg` |
| `og.svg` | Tarjeta social | fuente, a mano |
| `og.png` (1200×630) | Tarjeta social publicada | exportado de `og.svg` |
| `site.webmanifest` | Nombre, colores e iconos de la app | a mano |
| `robots.txt` | Rastreadores | a mano |

**Los `.svg` son la fuente. Los `.png` son producto.** Si hay que cambiar la
marca o la tarjeta, se edita el SVG y se vuelve a exportar. Editar el PNG a mano
garantiza que la próxima exportación te lo pisa.

> ⚠ **`og.png` está desactualizado.** Los SVG ya llevan los nombres definitivos
> (Mood Control como marca madre, Mood Agency y Mood Creative como divisiones),
> pero el PNG publicado sigue siendo el export viejo y dice "MOOD AGENCY / MOOD
> CONTROL / MOOD NET". Hay que **re-exportarlo** con cualquiera de las tres vías
> de más abajo antes de publicar: es la imagen que se ve en WhatsApp, LinkedIn y
> X, o sea la primera impresión de la marca. Los iconos no llevan texto, así que
> ésos siguen siendo válidos.

---

## La marca: El Núcleo

Un disco partido en dos mitades: **violeta `#B026FF`** (Mood Agency) y **cian
`#00E5FF`** (Mood Creative), sobre **`#050505`** (VOID). Es la misma idea que el
capítulo "División" de la landing, donde el Núcleo se rompe en dos.

Reglas que no son estéticas, son técnicas:

- **Nada de degradados en el icono.** A 16px un degradado se promedia a un gris
  sucio. Dos planos de color planos y un corte visible es lo único que sobrevive
  a esa miniatura.
- **Dos fuentes, dos trabajos.** `favicon.svg` lleva esquinas redondeadas
  (`rx=14`) porque se ve dentro de una pestaña. `icon.svg` va a plena sangre y
  con el disco un punto más chico (`r=22`, no `24`) porque iOS y Android aplican
  **su propia** máscara encima: un redondeo nuestro dentro del suyo deja esquinas
  oscuras, y el formato `maskable` recorta hasta el 40% del radio.

---

## Cómo re-exportar los PNG

No hay dependencia de build para esto a propósito: son cuatro archivos que
cambian una vez cada dos años. Cualquiera de estas tres vías sirve.

### A. Con el navegador que ya tenés (cero instalación)

Chrome o Edge en modo headless saca la captura. Es como se generaron los
archivos actuales.

```bash
# 1. Una página mínima que muestre el SVG a tamaño exacto
cat > /tmp/shot.html <<'HTML'
<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=block" rel="stylesheet">
<style>html,body{margin:0;background:#050505;overflow:hidden}svg{display:block}</style>
<!-- pegá acá el contenido de og.svg (o de icon.svg) -->
HTML

# 2. La captura. `--virtual-time-budget` le da tiempo a cargar las fuentes:
#    sin él, el texto sale en la tipografía de sistema y la tarjeta se ve barata.
chrome --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --virtual-time-budget=8000 \
  --window-size=1200,630 --screenshot=public/og.png /tmp/shot.html
```

Repetí con `--window-size=180,180`, `192,192` y `512,512` sobre `icon.svg` para
`apple-touch-icon.png`, `icon-192.png` e `icon-512.png` (el `<svg>` tiene que
ocupar exactamente esas medidas: fijale `width`/`height` en el CSS).

En el icono **no hace falta** el presupuesto de tiempo: no tiene texto.

### B. Con `rsvg-convert` o Inkscape

```bash
rsvg-convert -w 1200 -h 630 public/og.svg -o public/og.png
rsvg-convert -w 180  -h 180 public/icon.svg -o public/apple-touch-icon.png
rsvg-convert -w 192  -h 192 public/icon.svg -o public/icon-192.png
rsvg-convert -w 512  -h 512 public/icon.svg -o public/icon-512.png
```

⚠ `rsvg-convert` usa las fuentes **instaladas en el sistema**. Si Archivo y
JetBrains Mono no están, `og.png` sale con la tipografía de reserva y la
composición se descuadra. Para `icon.svg` da igual: no tiene texto.

### C. Desde Figma o Illustrator

Importá el SVG, exportá a PNG con las medidas de la tabla. Vigilá que el
artboard sea exactamente 1200×630 y que **no** se añada margen.

---

## Medidas y por qué son ésas

| Archivo | Medida | Motivo |
| --- | --- | --- |
| `og.png` | **1200×630** | La proporción 1.91:1 que piden Open Graph y `summary_large_image` de X. Más grande no mejora nada; más chico y Facebook lo degrada a tarjeta pequeña. |
| `apple-touch-icon.png` | **180×180** | El tamaño que pide iOS desde el iPhone 6 Plus. Uno solo: iOS reescala hacia abajo sin problema. |
| `icon-192.png` | **192×192** | Mínimo para que Android considere la web instalable. |
| `icon-512.png` | **512×512** | Splash screen de Android y listados de PWA. Sirve además como `maskable`. |

### ¿JPG o PNG para la tarjeta social?

**PNG.** La tarjeta es tipografía y color plano sobre negro, justo donde el JPG
se ensucia: el bloque de 8×8 le mete artefactos alrededor de las letras blancas
y bandas en los degradados oscuros. Con este contenido el PNG comprime bien y se
ve limpio. En una tarjeta que fuese una fotografía, al revés.

Si por lo que sea hiciera falta JPG, exportá a calidad **85** y actualizá las
cuatro metas de `index.html` (`og:image`, `og:image:type`, `twitter:image`) —
apuntar a un archivo que no existe da una previsualización rota, que es
exactamente lo que había antes.

---

## Al cambiar de dominio

Las URLs de imagen de Open Graph son **absolutas** a propósito: los rastreadores
sociales no resuelven rutas relativas. Cuando se confirme el dominio definitivo
hay que tocarlo en tres sitios:

1. `index.html` → `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image`
2. `src/content.ts` → `SITE.url`
3. `public/robots.txt` → la línea de `Sitemap`, si alguna vez se activa

Después, forzá el re-cacheo de la previsualización en cada plataforma: las
tarjetas viejas viven meses.

- Facebook / WhatsApp — <https://developers.facebook.com/tools/debug/>
- LinkedIn — <https://www.linkedin.com/post-inspector/>
- X — se refresca solo al publicar un enlace nuevo
