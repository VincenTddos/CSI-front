import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      middlewareMode: false,
      headers: {
        // 允許 Google Identity Services (GIS) 所需的 eval 與 iframe
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
          "font-src 'self' https://fonts.gstatic.com",
          "frame-src https://accounts.google.com",
          "connect-src 'self' https://accounts.google.com https://*.googleapis.com ws://localhost:*",
          "img-src 'self' data: https:",
        ].join('; '),
      },
    },
  };
});
