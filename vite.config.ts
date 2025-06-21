import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { URL, fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = mode === 'production' ? '' : '/';

  return {
    base: base,
    plugins: [
      react(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        // We are keeping this alias for your project's root directory
        '@': fileURLToPath(new URL('.', import.meta.url)),

        // We are REMOVING the specific alias for '@google/genai'
      }
    },
    // This setting should be enough to handle the Google AI package
    optimizeDeps: {
      include: ['@google/genai'],
    }
  };
});