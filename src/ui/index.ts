/**
 * Interfaz pública de `src/ui` — la que consumen `App.tsx` y las secciones.
 * Lo que no se exporte acá es privado del dominio de UI.
 */

export { Cursor } from './Cursor'
export { MagneticButton } from './MagneticButton'
export { SplitText } from './SplitText'
export { DecodeText } from './DecodeText'
export { Preloader } from './Preloader'
export { ScrollHUD } from './ScrollHUD'

/* ─────────────────────────────  ACCESIBILIDAD  ─────────────────────────── */

export { SkipLink } from './SkipLink'

/* ──────────────────────  DEGRADACIÓN DE LA ESCENA 3D  ──────────────────── */

export { hasWebGL } from './webgl'
export { SceneBoundary } from './SceneBoundary'
export { SceneFallback } from './SceneFallback'

/* ────────────────────────────────  DATOS  ──────────────────────────────── */

/**
 * Envío del formulario de contacto. `Converge` lo enchufa en lugar de su
 * `setTimeout`: `const result = await submitLead({ ...values, division })`.
 */
export { submitLead, isLeadEndpointConfigured, leadErrorMessage } from './submitLead'
export type { LeadPayload, LeadResult, LeadFailure, LeadDivision } from './submitLead'

/** JSON-LD generado desde `@/content`. Se llama una vez, desde `main.tsx`. */
export { injectStructuredData, buildStructuredData } from './structuredData'
