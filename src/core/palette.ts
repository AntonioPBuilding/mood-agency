/**
 * Los tres mundos.
 *
 * La paleta no es decoración: es el estado de ánimo. Cuando el Núcleo cambia de
 * mundo, cambia TODO —fondo, niebla, bloom, temperatura de luz— y se interpola,
 * nunca se corta de golpe (salvo el blackout, que es un corte a propósito).
 */

import { Color } from 'three'
import type { WorldId } from './chapters'
import { smoothstep } from './chapters'

export interface World {
  id: WorldId
  /** Fondo de escena y de página. */
  bg: string
  /** Tinta principal para tipografía sobre `bg`. */
  ink: string
  /** Acento primario. */
  accent: string
  /** Acento secundario. */
  accent2: string
  /** Acento terciario, para picos de energía. */
  accent3: string
  /** Intensidad de bloom del post-processing. */
  bloom: number
  /** Densidad de niebla exponencial. */
  fog: number
  /** Fuerza de aberración cromática. */
  chroma: number
}

export const WORLDS: Record<WorldId, World> = {
  /** VOID — potencial puro. Silencio, aire, nada definido todavía. */
  void: {
    id: 'void',
    bg: '#050505',
    ink: '#F2F0EB',
    accent: '#F2F0EB',
    accent2: '#8A7CFF',
    accent3: '#FF7A59',
    bloom: 0.35,
    fog: 0.035,
    chroma: 0.0006,
  },
  /** MOOD CONTROL — el show. Neón, humo, lasers, todo al beat. */
  control: {
    id: 'control',
    bg: '#0A0208',
    ink: '#FFFFFF',
    accent: '#B026FF',
    accent2: '#00A3FF',
    accent3: '#FF2D55',
    bloom: 1.15,
    fog: 0.075,
    chroma: 0.0028,
  },
  /** MOOD NET — la precisión. Luz de sala, líneas de 1px, cero ruido. */
  net: {
    id: 'net',
    bg: '#0B0D0F',
    ink: '#FAFAFA',
    accent: '#00E5FF',
    accent2: '#2E6BFF',
    accent3: '#8B95A5',
    bloom: 0.28,
    fog: 0.02,
    chroma: 0.0002,
  },
}

/**
 * Puntos de transición entre mundos, en progreso global.
 * `blackout` es el apagón de sala: el corte más importante de la landing.
 */
const TRANSITIONS = {
  voidToControl: [0.225, 0.255] as const,
  controlToNet: [0.505, 0.565] as const,
}

/** Mezcla de mundos según el scroll. Devuelve un World interpolado. */
const _a = new Color()
const _b = new Color()
const _out = new Color()

function mixHex(from: string, to: string, t: number): string {
  _a.set(from)
  _b.set(to)
  return `#${_out.copy(_a).lerp(_b, t).getHexString()}`
}

export interface BlendedWorld extends Omit<World, 'id'> {
  from: WorldId
  to: WorldId
  t: number
}

export function blendWorld(progress: number): BlendedWorld {
  let from: WorldId = 'void'
  let to: WorldId = 'void'
  let t = 0

  if (progress < TRANSITIONS.voidToControl[1]) {
    from = 'void'
    to = 'control'
    t = smoothstep(TRANSITIONS.voidToControl[0], TRANSITIONS.voidToControl[1], progress)
  } else if (progress < TRANSITIONS.controlToNet[1]) {
    from = 'control'
    to = 'net'
    t = smoothstep(TRANSITIONS.controlToNet[0], TRANSITIONS.controlToNet[1], progress)
  } else {
    from = 'net'
    to = 'net'
    t = 1
  }

  const A = WORLDS[from]
  const B = WORLDS[to]
  const l = (x: number, y: number) => x + (y - x) * t

  return {
    from,
    to,
    t,
    bg: mixHex(A.bg, B.bg, t),
    ink: mixHex(A.ink, B.ink, t),
    accent: mixHex(A.accent, B.accent, t),
    accent2: mixHex(A.accent2, B.accent2, t),
    accent3: mixHex(A.accent3, B.accent3, t),
    bloom: l(A.bloom, B.bloom),
    fog: l(A.fog, B.fog),
    chroma: l(A.chroma, B.chroma),
  }
}

/**
 * EL APAGÓN DE SALA. 0 = escena visible, 1 = negro absoluto.
 * Se apaga rápido (como cuando cortan la corriente) y se enciende lento
 * (como los fluorescentes de un pabellón). Esa asimetría es todo el efecto.
 */
export function blackoutAmount(progress: number): number {
  const off = smoothstep(0.5, 0.522, progress) // caída seca
  const on = smoothstep(0.53, 0.575, progress) // encendido perezoso
  return Math.max(0, off - on)
}
