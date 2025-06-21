import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { URL, fileURLToPath } from 'node:url' // <-- Import this

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // This sets up an alias so you can import from 'src' using '@/'
      // e.g., import MyComponent from '@/components/MyComponent'
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})