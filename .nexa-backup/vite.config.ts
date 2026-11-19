import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'inject-gemini-key',
        transformIndexHtml(html) {
          return html.replace(
            '<head>',
            `<head>\n    <script>window.__GEMINI_API_KEY__ = ${JSON.stringify(apiKey)};</script>`
          );
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    preview: {
      host: '0.0.0.0',
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      allowedHosts: true,
    },
  };
});
