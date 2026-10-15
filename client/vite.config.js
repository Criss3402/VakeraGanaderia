import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
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
