import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = Number(env.PORT || process.env.PORT || 35001);
  const backendTarget = `http://localhost:${backendPort}`;

  return {
    plugins: [react(), tailwindcss()],
    root: '.',
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
      target: 'esnext',
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/healthz': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
