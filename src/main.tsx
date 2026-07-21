import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { injectStructuredData } from '@/ui'
import './index.css'
import App from './App.tsx'

/**
 * El JSON-LD del `<head>` es el mínimo indispensable, escrito a mano para quien
 * no ejecuta JavaScript. Acá lo sustituimos por el grafo completo generado
 * desde `@/content`: las dos divisiones, sus servicios y el contacto, sin
 * duplicar ni una palabra del copy.
 *
 * Va ANTES de montar React y fuera de todo componente: es un efecto sobre el
 * documento, no sobre la interfaz. Meterlo en un `useEffect` sólo serviría para
 * hacerlo depender del ciclo de vida de un árbol con el que no tiene nada que ver.
 */
injectStructuredData()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
