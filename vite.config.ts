import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        /**
         * Code splitting manual. three + drei pesan ~700kb: si viajan en el
         * bundle principal, el Hero tarda en pintar y perdemos al usuario en
         * los primeros 3 segundos, que es justo lo que NO puede pasar.
         *
         * FUNCIÓN, no objeto. La forma `{ three: ['three'], ... }` ya no la
         * acepta el Rollup que trae Vite 8: sólo admite una función que recibe
         * el id del módulo. Y esto NO lo detectaba nada durante el desarrollo,
         * porque `npm run dev` usa esbuild (borra los tipos sin comprobarlos) y
         * `tsconfig.app.json` sólo incluye `src/`. Este archivo lo cubre
         * `tsconfig.node.json`, que únicamente se ejecuta en `tsc -b`, o sea en
         * el build. Reventaba directamente en el servidor de despliegue.
         */
        manualChunks(id: string) {
          /* NORMALIZAR LAS BARRAS ES OBLIGATORIO.
             En Windows los ids llegan como `node_modules\three\build\...`, así
             que comparar contra `/three/` no encuentra NUNCA nada: la regla
             compila, no da error, y silenciosamente no hace nada. El síntoma
             era un chunk `postfx` de 966 kB con three dentro y ningún chunk
             `three`. Un config que miente es peor que no tener config. */
          const path = id.replace(/\\/g, '/')
          if (!path.includes('/node_modules/')) return

          /* `three` PRIMERO. El paquete trae `three/examples/jsm/postprocessing/*`
             dentro, así que evaluar `postprocessing` antes se llevaba parte de
             three al chunk equivocado. `/three/` no casa con `@react-three/`
             (ahí el separador previo es un guion), así que no hay ambigüedad. */
          if (path.includes('/three/')) return 'three'
          if (path.includes('postprocessing/')) return 'postfx'
          if (path.includes('/@react-three/')) return 'r3f'
          if (path.includes('/gsap/') || path.includes('/motion/')) return 'motion'
        },
      },
    },
  },
})
