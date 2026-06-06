import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

function readJsonBody(req: import('http').IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'local-ai-analysis-api',
        configureServer(server) {
          server.middlewares.use('/api/ai-analysis', async (req, res) => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');

            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            if (!env.GEMINI_API_KEY) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not set in .env' }));
              return;
            }

            try {
              const { prompt } = await readJsonBody(req);
              if (typeof prompt !== 'string' || !prompt.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing prompt' }));
                return;
              }

              const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
              const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
              let lastError: unknown = null;

              for (const model of models) {
                try {
                  const response = await ai.models.generateContent({ model, contents: prompt });
                  res.end(JSON.stringify({ text: response.text || '無法取得分析結果。', model }));
                  return;
                } catch (err) {
                  lastError = err;
                  const msg = err instanceof Error ? err.message : String(err);
                  const shouldTryNextModel =
                    msg.includes('404') ||
                    msg.includes('503') ||
                    msg.includes('429') ||
                    msg.includes('NOT_FOUND') ||
                    msg.includes('UNAVAILABLE') ||
                    msg.includes('RESOURCE_EXHAUSTED');

                  if (!shouldTryNextModel) break;
                }
              }

              res.statusCode = 502;
              res.end(JSON.stringify({
                error: lastError instanceof Error ? lastError.message : String(lastError),
              }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
            }
          });
        },
      },
    ],
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
          "connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.supabase.co wss://*.supabase.co ws://localhost:*",
          "img-src 'self' data: https:",
        ].join('; '),
      },
    },
  };
});
