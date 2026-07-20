/**
 * Punto único de entrada a GSAP para las secciones.
 *
 * `registerPlugin` es idempotente, pero registrarlo acá desacopla a las
 * secciones del orden de montaje: un capítulo puede crear su ScrollTrigger sin
 * asumir que `useSmoothScroll` ya corrió. El driver (Lenis) sigue siendo el de
 * `core/useSmoothScroll`: nosotros sólo colgamos triggers de ese mismo loop.
 */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }
