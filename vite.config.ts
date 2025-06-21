// vite.config.ts

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// The new import needed to correctly handle file paths in a modern Node.js environment
import { URL, fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  // Your logic for loading environment variables and setting the base path is preserved
  const env = loadEnv(mode, process.cwd(), '');
  const base = mode === 'production' ? '/OMNICHESS/' : '/';

  return {
    base: base,
    plugins: [
      react(),
    ],
    optimizeDeps: {
      include: ['@google/generative-ai'],
    },
    define: {
      // Cleaned up to use the single, correct key that your application code expects
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        // FIX #1: Replaces the old `path.resolve(__dirname, ...)` which causes errors
        '@': fileURLToPath(new URL('.', import.meta.url)),
        
        // FIX #2: Explicitly tells the builder where to find the Google AI package
        '@google/generative-ai': '@google/generative-ai/dist/index.mjs',
      }
    }
  };
});