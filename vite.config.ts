/// <reference types="node" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load .env files from the project root.
    // The third argument '' ensures all env variables are loaded, not just those prefixed with VITE_.
    const env = loadEnv(mode, process.cwd(), '');

    // IMPORTANT: Configure the base path for GitHub Pages deployment.
    // Replace '<your-repository-name>' with the actual name of your GitHub repository.
    // For example, if your repository URL is https://github.com/username/my-chess-app,
    // then the base path should be '/my-chess-app/'.
    // If deploying to the root of a custom domain (e.g., https://www.yourdomain.com),
    // then base can be '/'. For local development, it defaults to '/'.
    const base = mode === 'production' ? '/OMNICHESS/' : '/';

    return {
      base: base, // Configure the base path for correct asset loading
      plugins: [
        react(), // Enable React plugin for JSX/TSX compilation
      ],
      optimizeDeps: {
        include: ['@google/generative-ai'],
      },
      define: {
        // Make environment variables available in the client-side code.
        // Ensure your .env file (e.g., .env.production or .env) contains GEMINI_API_KEY
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY) // This is redundant if API_KEY is set, but harmless
      },
      resolve: {
        alias: {
          // This alias maps '@/' to your project root.
          // Your current imports use relative paths, so this might not be actively used,
          // but it's preserved from your original config.
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});