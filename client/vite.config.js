import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-maps": ["maplibre-gl"],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    proxy: {
      // Reenvía WebSockets /ws al servidor ASGI (Daphne / Django Channels)
      "/ws": {
        target: "http://localhost:8000",
        ws: true,
        changeOrigin: true,
      },
      // Reenvía llamadas analíticas /api/py al backend de Python (Django)
      "/api/py": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      // Reenvía las llamadas operativas /api al backend de Node.js (Express)
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
