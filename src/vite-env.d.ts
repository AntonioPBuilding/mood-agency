/// <reference types="vite/client" />

/**
 * Variables de entorno del proyecto, TIPADAS.
 *
 * `ImportMetaEnv` de Vite trae un `[key: string]: any`: sin esta declaración,
 * `import.meta.env.VITE_LEAD_ENDPOINT` compila como `any` y el `strict` del
 * tsconfig deja de servir para nada justo en el punto donde más importa —el
 * envío de un lead—. Una firma explícita gana al índice y devuelve el tipo real.
 */
interface ImportMetaEnv {
  /**
   * Endpoint del formulario de contacto. Si NO está definida, `submitLead()`
   * cae al modo simulado (ver `src/ui/submitLead.ts`). Formspree, Resend, una
   * función serverless propia… cualquier cosa que acepte un POST de JSON.
   */
  readonly VITE_LEAD_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
