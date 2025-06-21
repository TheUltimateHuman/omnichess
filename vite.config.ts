import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
    // Load standard .env files and custom js.env
    const env = {
      ...loadEnv(mode, process.cwd(), ''),
      ...(fs.existsSync('js.env') ? dotenv.parse(fs.readFileSync('js.env')) : {})
    };

    // Configure the base path for correct asset loading
    const base = mode === 'production' ? '' : '/';

    return {
      base: base,
      plugins: [
        react(),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(process.cwd(), './src'),
        }
      },
      optimizeDeps: {
        include: ['@google/genai'],
      },
    };
});