/**
 * EL BUFFER COMPARTIDO — estados 2, 3, 4, 5 y 7.
 *
 * DECISIÓN CENTRAL DEL PROYECTO: las partículas NO se mueven desde JavaScript.
 *
 * Con hasta 120.000 partículas, interpolar posiciones en la CPU serían 360.000
 * multiplicaciones + una subida de 1,4 MB al bus por frame. Eso no entra en
 * 16,6 ms ni en broma. En vez de eso, cada partícula lleva TODOS sus destinos
 * como atributos (se suben una vez, al montar) y el vertex shader los mezcla con
 * un puñado de pesos escalares. La CPU escribe ~18 floats por frame. Eso sí
 * entra.
 *
 * Los pesos son acumulativos y en cascada: cada `mix` posterior pisa al
 * anterior, así que el orden de las mezclas ES el guion de la landing.
 */

import { GLSL_SIMPLEX_3D, GLSL_UTILS } from './noise'

export const particlesVertexShader = /* glsl */ `
${GLSL_SIMPLEX_3D}
${GLSL_UTILS}

uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;

/* ── Pesos de estado. Cada uno va 0 → 1 en su tramo del scroll. ────────── */
uniform float uOrbit;     // 1 · polvo orbitando la esfera
uniform float uExplode;   // 2 · fractura
uniform float uWord;      // 3 · wordmark MOOD
uniform float uSplit;     // 3 · el wordmark se parte en dos
uniform float uChaos;     // 4 · bola de energía
uniform float uGrid;      // 5 · retícula de la red
uniform float uReturn;    // 7 · vuelven desde ambos flancos
uniform float uCollapse;  // 7 · colapso al punto de luz

uniform float uBeat;
uniform float uSpeed;
uniform float uOpacity;

uniform vec3 uColorNeutral;
uniform vec3 uColorA;    // violeta neón — la mitad izquierda
uniform vec3 uColorB;    // cian — la mitad derecha
uniform vec3 uColorNet;

uniform vec3 uFogColor;
uniform float uFogDensity;

/* ── Destinos precalculados. Se suben UNA vez. ─────────────────────────── */
attribute vec3 aWord;    // posición dentro del wordmark (muestreo de píxeles)
attribute vec3 aGrid;    // celda exacta de la retícula 3D
attribute vec3 aChaos;   // punto aleatorio en bola — sirve de ruido barato
attribute float aSeed;   // 0..1 determinista, desfasa TODO
attribute float aSide;   // -1 izquierda / +1 derecha del wordmark

varying vec3 vColor;
varying float vAlpha;
varying float vFog;

void main() {
  vec3 pos = position; // reposo = cáscara de la esfera

  // Un solo vector de ruido reutilizado por la fractura y por el caos. Tres
  // snoise por vértice en vez de seis: la mitad del coste de vértice del frame
  // más caro de la landing, y visualmente idéntico.
  vec3 turb = vec3(
    snoise(position * 1.6 + uTime * 0.18),
    snoise(position * 1.6 + 31.4 + uTime * 0.18),
    snoise(position * 1.6 + 71.7 + uTime * 0.18)
  );

  /* 1 · POLVO EN ÓRBITA ─────────────────────────────────────────────────
     Cáscara girando alrededor de la esfera. Radio y velocidad por semilla:
     todas a la misma velocidad se leerían como un objeto sólido. */
  float ang = uTime * (0.07 + aSeed * 0.11) + aSeed * 6.2831853;
  float rad = 2.25 + aSeed * 1.5;
  vec3 orbit = vec3(cos(ang) * rad, aChaos.y * 1.5, sin(ang) * rad);
  orbit.y += sin(uTime * 0.4 + aSeed * 9.0) * 0.3;
  pos = mix(pos, orbit, uOrbit);

  /* 2 · FRACTURA ────────────────────────────────────────────────────────
     Estallido radial + turbulencia. Sin la turbulencia esto es una esfera que
     se infla, no una que se rompe: el ojo necesita ver trayectorias que NO
     compartan centro. */
  vec3 dir = normalize(position + 0.0001);
  vec3 shattered = position + dir * (1.3 + aSeed * 3.6) + aChaos * 1.2 + turb * 0.9;
  pos = mix(pos, shattered, uExplode);

  /* 3 · WORDMARK Y DIVISIÓN ─────────────────────────────────────────────
     aWord viene de muestrear los píxeles de un canvas 2D. La vibración de z
     evita que se lea como una calcomanía plana. */
  vec3 word = aWord;
  word.z += sin(uTime * 0.8 + aSeed * 6.0) * 0.05;
  word.x += aSide * uSplit * 3.6;
  word.y += (aSeed - 0.5) * uSplit * 1.1;
  word.z += (aSeed - 0.5) * uSplit * 1.4;
  pos = mix(pos, word, uWord);

  /* 4 · BOLA DE ENERGÍA ─────────────────────────────────────────────────
     Caos con latido. El beat empuja el radio: la bola "respira" al golpe. */
  vec3 chaos = aChaos * (1.35 + uBeat * 0.30) + turb * 1.35;
  chaos.xz *= rot2(uTime * 0.25 + aSeed * 0.6);
  pos = mix(pos, chaos, uChaos);

  /* 5 · RETÍCULA ────────────────────────────────────────────────────────
     Orden absoluto. Sólo una deriva mínima para que no parezca una imagen
     congelada; Mood Creative es precisa, no muerta. */
  vec3 grid = aGrid;
  grid.y += sin(uTime * 0.5 + aGrid.x * 2.0 + aGrid.z * 1.3) * 0.025;
  pos = mix(pos, grid, uGrid);

  /* 7 · CONVERGENCIA ────────────────────────────────────────────────────
     Primero se van a sus flancos (violeta a la izquierda, cian a la derecha),
     después chocan. uCollapse va al cuadrado: la caída acelera, como debe. */
  /* Los flancos caen DENTRO del encuadre. Con la cámara en z=6 y fov 45º el
     borde visible está en x ≈ ±5; mandarlas a ±7.5…±10 las sacaba del plano y
     dejaba la pantalla vacía justo antes del colapso. Una coreografía que se
     va del escenario no es una coreografía. */
  vec3 flank = vec3(aSide * (1.1 + aSeed * 3.3), aChaos.y * 1.35, aChaos.z * 1.35);
  pos = mix(pos, flank, uReturn);
  float collapse = uCollapse * uCollapse;
  pos = mix(pos, aChaos * 0.02, collapse);

  /* ── COLOR ──────────────────────────────────────────────────────────── */
  vec3 sideCol = aSide < 0.0 ? uColorA : uColorB;
  vec3 col = uColorNeutral;
  col = mix(col, sideCol, uSplit);
  col = mix(col, mix(uColorNet, uColorB, aSeed * 0.45), uGrid);
  col = mix(col, sideCol, uReturn);
  // Sobreexponer a propósito: el punto de luz tiene que quemar el bloom.
  col = mix(col, vec3(2.6), collapse);
  // El latido sólo existe en Mood Agency. La red no parpadea jamás.
  col *= 1.0 + uBeat * uChaos * (1.0 - uGrid) * 0.85;
  vColor = col;

  /* ── TAMAÑO Y ALFA ──────────────────────────────────────────────────── */
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  float size = uSize * (0.5 + aSeed * 0.95);
  size *= 1.0 + uChaos * 0.55 + collapse * 1.8 + uSpeed * 0.25;
  size *= 1.0 - uGrid * 0.5;  // la red es quirúrgica: puntos de 1px, no bolas

  /* El divisor se acota a 1.0, NO a 0.1.
     Con 0.1, cualquier partícula que pasara cerca o por detrás de la cámara se
     dibujaba a 11/0.1 = 110 VECES su tamaño: manchas gigantes y difusas que
     tapaban toda la escena (y el wordmark que se formaba detrás). El clamp
     final es el cinturón de seguridad: ningún punto puede comerse la pantalla
     por muy cerca que pase. */
  float depth = -mv.z;
  gl_PointSize = min(size * uPixelRatio * (11.0 / max(depth, 1.0)), 26.0 * uPixelRatio);

  // En el estado 1 sólo se ve una fracción: es polvo suspendido, no niebla.
  // En cuanto la esfera estalla aparecen TODAS, y ese salto de densidad es
  // justamente lo que hace que la explosión se sienta.
  float dust = mix(1.0, step(0.72, aSeed), uOrbit);
  // Lo que queda detrás del plano de cámara no se dibuja. Un punto a espaldas
  // del observador igual se rasteriza, y con blending aditivo eso es un velo
  // blanco sobre toda la escena salido de la nada.
  vAlpha = uOpacity * dust * step(0.15, depth);

  vFog = fogExp2(-mv.z, uFogDensity);
}
`

export const particlesFragmentShader = /* glsl */ `
uniform vec3 uFogColor;

varying vec3 vColor;
varying float vAlpha;
varying float vFog;

void main() {
  // Sprite circular calculado, sin textura. Una textura de punto son 4 MB de
  // VRAM y una petición de red para dibujar un disco degradado.
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;

  float a = smoothstep(0.25, 0.02, d2);
  vec3 col = mix(vColor, uFogColor, vFog);

  gl_FragColor = vec4(col, a * vAlpha);
}
`
