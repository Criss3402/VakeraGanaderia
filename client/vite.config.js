import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Reenvía las llamadas /api al backend de Node.js durante el desarrollo
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
