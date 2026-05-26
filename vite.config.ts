import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production1';
  
  const backendUrl = env.VITE_API_BASE_URL || 'http://localhost:3001';
  
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.VITE_DEV_PORT) || 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            // Chỉ log trong môi trường development
            if (!isProduction) {
              proxy.on('error', (err, _req, _res) => {
                console.log('🚨 Proxy error:', err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                console.log('📤 Sending Request:', req.method, req.url, '→', backendUrl + req.url);
              });
              proxy.on('proxyRes', (proxyRes, req, _res) => {
                console.log('📥 Received Response:', proxyRes.statusCode, req.method, req.url);
              });
            }
          },
        },
      },
      watch: {
        ignored: [
          '**/node_modules/**',
          '**/dist/**',
          '**/static/instructions/**',
          '**/static/subcategories.json',
          '**/server.js',
          '**/JobManager.js',
          '**/InstructionsManager.js',
          '**/*.log'
        ]
      }
    },
    publicDir: "./static",
    base: "./",
    define: {
      __API_BASE_URL__: JSON.stringify(backendUrl),
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          // Loại bỏ tất cả console.* trong production
          drop_console: isProduction,
        },
      },
    },
  };
});