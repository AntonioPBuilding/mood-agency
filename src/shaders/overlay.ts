/**
 * EL APAGÓN DE SALA.
 *
 * Un quad a pantalla completa que se dibuja ANTES del post-processing, no
 * después. Es la diferencia entre "apagaron las luces" y "alguien puso un
 * filtro negro encima": si el negro entrase después del bloom, los láseres
 * seguirían sangrando su halo por detrás del velo. Cortando antes, no queda
 * nada que florecer. Que es justo lo que pasa cuando se corta la corriente.
 */

/**
 * El vertex shader escribe coordenadas de dispositivo directamente: ignora
 * modelo, vista y proyección. Así el velo cubre la pantalla esté donde esté la
 * cámara, sin tener que emparentarlo a ella ni recalcular su tamaño con el fov.
 * Se usa con una PlaneGeometry(1, 1), cuyos vértices van de -0.5 a 0.5.
 */
export const overlayVertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`

export const overlayFragmentShader = /* glsl */ `
uniform float uAmount;
uniform vec3 uColor;

void main() {
  if (uAmount < 0.002) discard;
  gl_FragColor = vec4(uColor, uAmount);
}
`
