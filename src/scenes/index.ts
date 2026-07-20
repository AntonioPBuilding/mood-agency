/**
 * Interfaz pública de `src/scenes`, tal y como la fija ARCHITECTURE.md.
 *
 * `Scene` es el punto de entrada del Canvas (App lo importa como default desde
 * './Scene'). El resto de componentes —Particles, Lasers, Net, Crystals— son
 * internos del Núcleo y no se montan por separado: montar dos veces el mismo
 * buffer de partículas duplicaría el objeto más caro de la escena.
 */

export { Nucleus } from './Nucleus'
export { Atmosphere } from './Atmosphere'
export { Scene, default } from './Scene'
