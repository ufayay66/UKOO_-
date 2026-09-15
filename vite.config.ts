import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';
import { handleHealthCheck, handleSplitDetect, handleTranslate, handlePanelOcrTranslate } from './src/server/apiHandlers.ts';

dotenv.config();

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        if (pathname === '/api/health' && req.method === 'GET') {
          const result = await handleHealthCheck();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }

        if ((pathname === '/api/split-detect' || pathname === '/api/translate' || pathname === '/api/panel-ocr-translate') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const json = JSON.parse(body || '{}');
              res.setHeader('Content-Type', 'application/json');

              if (pathname === '/api/split-detect') {
                const result = await handleSplitDetect(json.imageBase64);
                res.end(JSON.stringify(result));
              } else if (pathname === '/api/translate') {
                const result = await handleTranslate({
                  targetLang: json.targetLang || 'zh-CN',
                  panels: json.panels || [],
                });
                res.end(JSON.stringify(result));
              } else if (pathname === '/api/panel-ocr-translate') {
                const result = await handlePanelOcrTranslate({
                  panelId: json.panelId || 'panel-unknown',
                  index: json.index || 1,
                  totalPanels: json.totalPanels || 1,
                  imageBase64: json.imageBase64 || '',
                  targetLang: json.targetLang || 'zh-CN',
                  context: json.context,
                });
                if (result.statusCode) {
                  res.statusCode = result.statusCode;
                }
                res.end(JSON.stringify(result));
              }
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message || 'Server error' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
