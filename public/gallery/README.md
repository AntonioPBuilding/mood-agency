# Fotos del portfolio (Mood Control)

Acá van las imágenes reales de cada proyecto de la galería. Todo lo que está en
`public/` se sirve tal cual desde la raíz del sitio: `public/gallery/g1/01.jpg`
se pide como `/gallery/g1/01.jpg`. **No hace falta tocar código para subir una
foto.**

## Dónde va cada archivo

```
public/gallery/
  g1/  01.jpg  02.jpg  03.jpg     Nocturna      · Festival
  g2/  01.jpg  02.jpg  03.jpg     Blackroom     · Club series
  g3/  01.jpg  02.jpg  03.jpg     Solstice      · Open air
  g4/  01.jpg  02.jpg  03.jpg     Reactor       · Mapping
  g5/  01.jpg  02.jpg  03.jpg     Pulse         · Corporate
  g6/  01.jpg  02.jpg  03.jpg     Neón Sur      · Festival
  g7/  01.jpg  02.jpg  03.jpg     Vórtice       · Immersive
  g8/  01.jpg  02.jpg  03.jpg     Cierre        · Aftermovie
```

El `id` de la carpeta (`g1`…`g8`) y la lista de archivos salen de
`CONTROL.gallery` en `src/content.ts`. Si querés más o menos de tres fotos por
proyecto, se edita el array `images` de ese proyecto y listo.

La **primera** imagen (`01.jpg`) es la portada: es la que se ve en la tarjeta
del carrusel. Elegí la más contundente, no la más explicativa.

## Formato y tamaño

| | Portada (`01.jpg`) | Resto (`02`, `03`, …) |
|---|---|---|
| Proporción | vertical, **4:5** | libre (se muestra contenida) |
| Tamaño | **1600 × 2000 px** | lado largo **2000 px** |
| Formato | JPG calidad 80 (o WebP) | JPG calidad 80 (o WebP) |
| Peso objetivo | < 300 KB | < 300 KB |

Notas que importan:

- **Comprimí antes de subir.** Una foto de 4 MB no se ve mejor: se ve más tarde.
  Squoosh, ImageOptim o `sharp` sirven de sobra.
- Si usás **WebP**, cambiá también la extensión en el array `images` de
  `src/content.ts`. El componente no adivina extensiones.
- Las fotos se recortan con `object-fit: cover` en la tarjeta: dejá aire arriba
  y abajo y **no pongas nada importante en los bordes**.
- Fotos oscuras y contrastadas. La galería vive dentro del mundo Mood Control
  (neón sobre negro); una foto sobreexpuesta rompe el bloque visual.
- Nombres en minúscula y con dos dígitos: `01.jpg`, no `1.JPG` ni `Foto final
  (2).jpg`. El servidor distingue mayúsculas.

## Qué pasa si una foto falta

Nada se rompe. Cada `<img>` tiene un `onError` que cambia esa tarjeta (o esa
imagen de la ficha) a un placeholder de gradiente con el número y el título del
proyecto. Nunca vas a ver un icono de imagen rota ni un hueco en el layout: el
contenedor tiene la proporción fijada de antemano.

Eso también significa que **se pueden subir de a una**: las que estén se ven,
las que falten siguen mostrando el placeholder.
