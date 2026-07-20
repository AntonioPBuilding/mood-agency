/**
 * GLSL compartido — el ladrillo de todo lo demás.
 *
 * Se exporta como template literal de TypeScript a propósito: `vite-plugin-glsl`
 * NO está instalado, y meterlo sólo para esto añadiría un paso de build y una
 * dependencia por comodidad de sintaxis. Un string es un string.
 *
 * El prefijo /* glsl *\/ es lo que hace que los editores coloreen el bloque.
 */

/**
 * Simplex noise 3D (Ashima / Stefan Gustavson, dominio público).
 *
 * ¿Por qué simplex y no value/perlin? Porque escala en O(n²) en vez de O(2ⁿ)
 * con las dimensiones y —lo importante acá— no tiene artefactos alineados a los
 * ejes. Un perlin clásico en una esfera te dibuja una rejilla que se VE.
 *
 * Se compila una sola vez por material. Reutilizalo, no lo dupliques.
 */
export const GLSL_SIMPLEX_3D = /* glsl */ `
vec3 mood_mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mood_mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mood_permute(vec4 x) { return mood_mod289(((x * 34.0) + 1.0) * x); }
vec4 mood_taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mood_mod289(i);
  vec4 p = mood_permute(mood_permute(mood_permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = mood_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

/**
 * fBm de 3 octavas. Tres es el número: con dos no hay detalle, con cinco pagás
 * cinco simplex por vértice y no se nota la diferencia a esta escala.
 */
export const GLSL_FBM = /* glsl */ `
float fbm3(vec3 p) {
  float f = snoise(p);
  f += 0.5   * snoise(p * 2.03);
  f += 0.25  * snoise(p * 4.07);
  return f / 1.75;
}
`

/** Utilidades geométricas que aparecen en casi todos los shaders del proyecto. */
export const GLSL_UTILS = /* glsl */ `
mat2 rot2(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

/** Hash barato y determinista. Sirve para desfasar cosas sin subir atributos. */
float hash11(float n) {
  return fract(sin(n * 78.233) * 43758.5453123);
}

/**
 * Niebla exponencial cuadrada, la misma fórmula que FogExp2 de three.
 * La replicamos porque un ShaderMaterial crudo NO recibe la niebla de la escena:
 * si no la escribimos a mano, las partículas flotan en un mundo sin atmósfera
 * mientras las líneas y los cristales sí se difuminan. El desfase se ve.
 */
float fogExp2(float depth, float density) {
  float d = depth * density;
  return 1.0 - clamp(exp(-d * d), 0.0, 1.0);
}
`
