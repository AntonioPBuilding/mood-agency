/**
 * ESTADO 1 · La esfera viva.
 *
 * Displacement por simplex 3D en el vertex shader + interferencia de película
 * fina en el fragment. Es el primer plano de la landing: si esto no hipnotiza,
 * el usuario no llega al segundo scroll.
 */

import { GLSL_FBM, GLSL_SIMPLEX_3D, GLSL_UTILS } from './noise'

export const sphereVertexShader = /* glsl */ `
${GLSL_SIMPLEX_3D}
${GLSL_FBM}
${GLSL_UTILS}

uniform float uTime;
/** 0 = calma, 1 = a punto de romperse. Sube amplitud y frecuencia a la vez. */
uniform float uTension;
/** Amplitud del displacement base. Se apaga cuando la esfera estalla. */
uniform float uAmplitude;
uniform float uScale;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vCrack;
varying float vDisp;

void main() {
  vec3 p = position;

  // Respiración: pulso lento, independiente del scroll. El Núcleo está VIVO
  // aunque el usuario no toque la rueda; eso es lo que invita a seguir mirando.
  float breath = 0.5 + 0.5 * sin(uTime * 0.55);

  // Al tensarse sube la frecuencia: el ruido pasa de "orgánico" a "crispado".
  float freq = 1.35 + uTension * 2.4;
  float d = fbm3(p * freq + vec3(0.0, uTime * 0.16, uTime * 0.07));

  float amp = uAmplitude * (0.16 + breath * 0.07) + uTension * 0.34;
  vec3 displaced = p + normal * d * amp;

  // GRIETAS. Las bandas donde el ruido cruza cero son isolíneas continuas sobre
  // la superficie: perfectas para leerse como fisuras. Se abren empujando hacia
  // afuera en vez de hacia adentro para que la luz interior se escape por ellas.
  float crack = 1.0 - smoothstep(0.0, 0.16, abs(d));
  displaced += normal * crack * uTension * 0.5;

  displaced *= uScale;

  vDisp = d;
  vCrack = crack * uTension;

  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const sphereFragmentShader = /* glsl */ `
${GLSL_UTILS}

uniform vec3 uInk;
uniform vec3 uAccent;
uniform vec3 uAccent2;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uOpacity;
/** Fuerza de la iridiscencia. A 0 queda un mate elegante; a 1, jabón de burbuja. */
uniform float uFilm;
uniform float uTime;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vCrack;
varying float vDisp;

/**
 * Interferencia de película fina (thin-film).
 *
 * El desfase óptico depende del grosor recorrido, y ese grosor crece con el
 * ángulo (1/cosθ). Cada canal RGB tiene una longitud de onda distinta, así que
 * desfasamos los tres por separado: eso es literalmente por qué una pompa de
 * jabón tiene colores. Aproximamos el espectro con cosenos en vez de muestrear
 * una LUT porque una textura extra por un efecto que nadie va a medir con un
 * espectrómetro no vale el ancho de banda.
 */
vec3 thinFilm(float cosTheta, float thickness) {
  float d = thickness / max(cosTheta, 0.08);
  vec3 phase = d * vec3(1.0, 0.83, 0.70) * 6.2831853;
  return 0.5 + 0.5 * cos(phase + vec3(0.0, 2.0944, 4.1888));
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);

  // Normal geométrica REAL a partir de las derivadas de pantalla. Recalcular la
  // normal analítica del displacement costaría 3 fbm extra por vértice; esto
  // cuesta dos instrucciones y encima captura el facetado, que es justo lo que
  // hace que la iridiscencia "rompa" y no parezca un degradado pintado.
  vec3 dx = dFdx(vWorldPos);
  vec3 dy = dFdy(vWorldPos);
  vec3 nGeo = normalize(cross(dx, dy));
  nGeo *= sign(dot(nGeo, vWorldNormal));
  vec3 n = normalize(mix(vWorldNormal, nGeo, 0.8));

  float cosTheta = clamp(dot(n, viewDir), 0.0, 1.0);

  // Schlick. El exponente 4 deja el centro casi negro y el borde encendido:
  // la esfera se lee como volumen, no como círculo.
  float fresnel = pow(1.0 - cosTheta, 4.0);

  float thickness = 0.45 + vDisp * 0.35 + sin(uTime * 0.2) * 0.05;
  vec3 film = thinFilm(cosTheta, thickness);

  vec3 base = mix(uInk * 0.05, uAccent2 * 0.35, 0.5 + 0.5 * vDisp);
  vec3 col = base;
  col += film * uFilm * (0.25 + fresnel * 1.6);
  col += uInk * fresnel * 0.55;

  // Las grietas emiten: dentro del Núcleo hay energía, y se escapa por donde se
  // rompe. Sin esto la fractura del estado 2 llega sin haberse anunciado.
  col += uAccent * vCrack * 2.2;

  float alpha = uOpacity * (0.35 + fresnel * 0.9 + vCrack);

  // Atmósfera coherente con el resto de la escena (ver fogExp2 en noise.ts).
  float fogAmount = fogExp2(length(cameraPosition - vWorldPos), uFogDensity);
  col = mix(col, uFogColor, fogAmount);

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`
