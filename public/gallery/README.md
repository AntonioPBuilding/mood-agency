# Fotos del portfolio (Mood Agency)

Acá van las imágenes reales de cada proyecto de la galería. Todo lo que está en
`public/` se sirve tal cual desde la raíz del sitio: `public/gallery/g1/01.jpg`
se pide como `/gallery/g1/01.jpg`. **No hace falta tocar código para subir una
foto.**

## ⚠ Primero: la galería está VACÍA

`GALLERY` en `src/content.ts` es un array vacío a propósito. Los ocho proyectos
que había (`Nocturna`, `Blackroom`, `Solstice`…) eran inventados, con clientes y
métricas que no existieron nunca, y se borraron enteros.

O sea que **no hay carpetas que rellenar todavía**: primero se declara el
proyecto real en `content.ts` y después se suben sus fotos acá. El orden importa,
porque el `id` que le pongas al proyecto ES el nombre de su carpeta.

Antes de añadir proyectos, leé el bloque de comentario sobre `GALLERY`: el
carrusel es un anillo infinito y necesita **un mínimo de 5 proyectos** (8 para
estar tranquilo) o aparece una costura en los extremos.

## Dónde va cada archivo

Un directorio por proyecto, con el `id` que ese proyecto tenga en `content.ts`:

```
public/gallery/
  <id-del-proyecto>/  01.jpg  02.jpg  03.jpg
```

El `id` de la carpeta y la lista de archivos salen del array `images` de cada
`GalleryProject` en `src/content.ts`. Si querés más o menos de tres fotos por
proyecto, se edita ese array y listo.

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
- Fotos oscuras y contrastadas. La galería vive dentro del mundo Mood Agency
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
