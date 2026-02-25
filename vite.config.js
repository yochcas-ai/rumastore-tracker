import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/tracker/',   // <- Cambia si el subdirectorio es diferente
})