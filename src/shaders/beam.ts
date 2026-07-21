/**
 * ESTADO 4 · MUNDO 'control' = EVENTOS (marca Mood Agency) — haces de luz, humo y halos.
 *
 * Nada de esto es volumetría real. La volumetría real es raymarching, y el
 * raymarching a 60 fps en un móvil no existe. Lo que hace la industria —y lo
 * que hacemos acá— es falsificarla con geometría barata + blending aditivo:
 * conos para los haces, quads encarados a cámara para el humo. Si el resultado
 * es indistinguible a 60 fps, la volumetría real es una vanidad.
 */

import { GLSL_SIMPLEX_3D, GLSL_UTILS } from './noise'

/* ───────────────────────────────  LÁSERES  ─────────────────────────────── */

/**
 * Se usa sobre un InstancedMesh, por eso hay `instanceMatrix`: three la declara
 * sola en el prefijo de cualquier ShaderMaterial cuando el objeto es instanciado.
 * Un draw call para todos los haces en vez de uno por haz.
 *
 * La geometría es un cono HUECO con el ápice en el origen apuntando a -Y, así
 * que `uv.y` vale 1 en la boca del foco y 0 en el extremo lejano del haz.
 */
export const beamVertexShader = /* glsl */ `
attribute float aIntensity;
attribute vec3 aColor;

varying vec2 vUv;
varying float vIntensity;
varying vec3 vColor;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vUv = uv;
  vIntensity = aIntensity;
  vColor = aColor;

  mat4 m = modelMatrix * instanceMatrix;
  vec4 world = m * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(m) * normal);

  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const beamFragmentShader = /* glsl */ `
${GLSL_SIMPLEX_3D}

uniform float uTime;

varying vec2 vUv;
varying float vIntensity;
varying vec3 vColor;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  // El haz se apaga a lo largo: el aire dispersa la luz y a los diez metros ya
  // no queda nada. Sin este degradado el cono parece un tubo de plástico.
  float along = pow(clamp(vUv.y, 0.0, 1.0), 1.7);

  // Silueta. Es la clave de todo el truco: sobre un cono hueco con blending
  // aditivo, atenuar por |dot(normal, vista)| hace que los bordes del tubo
  // desaparezcan y quede el centro encendido. Sin esto se ve el cilindro.
  vec3 v = normalize(cameraPosition - vWorldPos);
  float soft = pow(abs(dot(normalize(vWorldNormal), v)), 1.5);

  // Grano: el humo de una sala no es homogéneo. Es el detalle que separa un
  // haz creíble de un degradado.
  float grain = 0.78 + 0.22 * snoise(vec3(vUv * 7.0, uTime * 0.55));

  float a = along * soft * grain * vIntensity;
  if (a < 0.004) discard;

  gl_FragColor = vec4(vColor * a * 1.6, a);
}
`

/* ────────────────────────────────  HUMO  ──────────────────────────────── */

/**
 * Billboard resuelto en el vertex shader, no en la CPU.
 *
 * Anular la rotación en espacio de vista (tomar el origen de la instancia y
 * desplazar en XY de vista) sale gratis y evita un `lookAt` por instancia por
 * frame. La deriva también va acá: la CPU no toca estas matrices NUNCA después
 * de montarlas.
 */
export const smokeVertexShader = /* glsl */ `
${GLSL_UTILS}

uniform float uTime;
uniform float uScale;

attribute float aSeed;

varying vec2 vUv;
varying float vSeed;

void main() {
  vUv = uv;
  vSeed = aSeed;

  vec4 origin = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);

  // Deriva perezosa: el humo de sala nunca se queda quieto.
  origin.x += sin(uTime * 0.11 + aSeed * 6.28) * 1.1;
  origin.y += cos(uTime * 0.08 + aSeed * 4.13) * 0.55;

  vec2 quad = position.xy * rot2(uTime * 0.03 + aSeed * 6.28);
  origin.xy += quad * uScale * (0.7 + aSeed * 0.8);

  gl_Position = projectionMatrix * origin;
}
`

export const smokeFragmentShader = /* glsl */ `
${GLSL_SIMPLEX_3D}

uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;

varying vec2 vUv;
varying float vSeed;

void main() {
  vec2 p = vUv - 0.5;

  // Caída radial al cuadrado: bordes invisibles. Un quad con borde duro se
  // delata al instante en cuanto se solapa con otro.
  float fall = 1.0 - clamp(dot(p, p) * 4.0, 0.0, 1.0);
  fall *= fall;

  float n = snoise(vec3(vUv * 2.6 + vSeed * 17.0, uTime * 0.07 + vSeed));
  n += 0.5 * snoise(vec3(vUv * 6.1 + vSeed * 3.0, uTime * 0.11));
  n = n * 0.5 + 0.5;

  float a = fall * n * uOpacity;
  if (a < 0.003) discard;

  gl_FragColor = vec4(uColor * a, a);
}
`

/* ────────────────  HALO / LUZ VOLUMÉTRICA (cristales, colapso)  ───────── */

export const haloVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const haloFragmentShader = /* glsl */ `
${GLSL_SIMPLEX_3D}

uniform vec3 uColor;
uniform float uTime;
uniform float uIntensity;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  float along = pow(clamp(vUv.y, 0.0, 1.0), 2.0);

  vec3 v = normalize(cameraPosition - vWorldPos);
  float soft = pow(abs(dot(normalize(vWorldNormal), v)), 1.4);

  float shimmer = 0.85 + 0.15 * snoise(vec3(vWorldPos.xz * 1.5, uTime * 0.35));

  float a = along * soft * shimmer * uIntensity;
  if (a < 0.004) discard;

  gl_FragColor = vec4(uColor * a * 1.4, a);
}
`

/**
 * Punto de luz del estado 7. Un solo quad encarado a cámara con un núcleo
 * saturado y un halo largo: cuando el bloom lo muerde, colapsa a un destello.
 */
export const sparkVertexShader = /* glsl */ `
uniform float uScale;

varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 origin = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  origin.xy += position.xy * uScale;
  gl_Position = projectionMatrix * origin;
}
`

export const sparkFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;

varying vec2 vUv;

void main() {
  vec2 p = vUv - 0.5;
  float d = length(p) * 2.0;

  float core = pow(clamp(1.0 - d, 0.0, 1.0), 8.0);
  float halo = pow(clamp(1.0 - d, 0.0, 1.0), 2.0) * 0.35;

  // Destellos en cruz: es la firma óptica de un punto muy brillante y lo que
  // hace que el ojo lo lea como LUZ y no como una bola blanca.
  float streak = pow(clamp(1.0 - abs(p.y) * 26.0, 0.0, 1.0), 2.0)
               * clamp(1.0 - abs(p.x) * 2.2, 0.0, 1.0);
  streak += pow(clamp(1.0 - abs(p.x) * 26.0, 0.0, 1.0), 2.0)
          * clamp(1.0 - abs(p.y) * 2.2, 0.0, 1.0);

  float a = (core + halo + streak * 0.5) * uIntensity;
  if (a < 0.003) discard;

  gl_FragColor = vec4(uColor * a * 2.2, a);
}
`
