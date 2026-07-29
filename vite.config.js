import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relative : la page tient sous n'importe quel sous-chemin de gh-pages,
// et le dépôt en porte un très long.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5176, strictPort: true },
})
