/**
 * Los 14 capítulos, en el orden en que se leen.
 *
 * `App` importa de acá y sólo de acá. El orden de este archivo es el orden de la
 * narrativa y coincide con `CHAPTERS` en `@/core/chapters`: si un día se
 * reordena un capítulo, se reordena en los dos sitios o el DOM y el Núcleo
 * dejan de contar la misma historia.
 */

export { Hero } from './Hero'
export { Manifesto } from './Manifesto'
export { Division } from './Division'
export { ControlIntro } from './ControlIntro'
export { ControlServices } from './ControlServices'
/* Ocupa el capítulo `gallery`, que ya NO es una galería de proyectos sino las
   cartas coleccionables del roster. El `ChapterId` se queda como está —está
   cableado en la coreografía 3D y en `CHAPTER_MAP`—; el componente se llama por
   lo que hace. */
export { Roster } from './Roster'
export { Blackout } from './Blackout'
export { NetIntro } from './NetIntro'
export { NetServices } from './NetServices'
export { Plans } from './Plans'
export { Stack } from './Stack'
export { Clients } from './Clients'
export { Converge } from './Converge'
export { Footer } from './Footer'
