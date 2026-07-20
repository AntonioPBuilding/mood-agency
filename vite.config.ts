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
         */
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          postfx: ['postprocessing', '@react-three/postprocessing'],
          motion: ['gsap', 'motion'],
        },
      },
    },
  },
})
