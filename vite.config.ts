import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // import.meta.dirname instead of __dirname: it works with Vite's
        // native config loader, which does not define __dirname.
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR runs on its own WebSocket port. The website's Vite server (port
      // 3002) uses a different one - if both defaulted to Vite's built-in
      // 24678 they would collide and live reload would break. Pass a boolean
      // here and Vite cannot pick a port, which is what caused the flood of
      // "WebSocket connection to ws://localhost:3003/ failed" errors.
      hmr: process.env.DISABLE_HMR === 'true'
        ? false
        : {
            port: Number(process.env.GFC_HMR_PORT || 24678),
            clientPort: Number(process.env.GFC_HMR_PORT || 24678),
          },
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      port: 3003,
      // The admin URL, the /api proxy target and the QR/upload links are all
      // built around 3003. Letting Vite fall forward to 3004+ silently breaks
      // every one of them, so fail loudly instead of moving.
      strictPort: true,
      host: true,
      // The admin client calls "/api" (same origin). In dev the API runs as a
      // separate process on PORT, so forward /api there. In production one
      // server serves both, so no proxy is involved.
      proxy: {
        '/api': {
          target: process.env.GFC_API_TARGET || `http://localhost:${process.env.PORT || 4000}`,
          changeOrigin: true,
          // Server-sent events must not be buffered.
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
                proxyRes.headers['cache-control'] = 'no-cache, no-transform';
              }
            });
          },
        },
      },
    },
  };
});
