import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { URL, fileURLToPath } from 'node:url'; // <-- ADD this import

export default defineConfig(({ mode }) => {
  // Load .env files from the project root.
  const env = loadEnv(mode, process.cwd(), '');

  // Configure the base path for GitHub Pages deployment.
  const base = mode === 'production' ? '/OMNICHESS/' : '/';

  return {
    base: base,
    plugins: [
      react(),
    ],
    define: {
      // Makes your API key available in your app's code
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        // FIX: Replaces the old `__dirname` with the modern equivalent
        '@': fileURLToPath(new URL('.', import.meta.url)),
      }
    },
    // ADD: Helps Vite correctly bundle the Google AI SDK for the browser
    optimizeDeps: {
      include: ['@google/generative-ai'],
    }
  };
});