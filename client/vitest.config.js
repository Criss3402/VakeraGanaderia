import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.js"],
      include: ["src/**/*.test.{js,jsx}"],
      css: false,
      restoreMocks: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: ["src/**/*.{js,jsx}"],
        exclude: [
          "src/test/**",
          "src/**/*.test.{js,jsx}",
          "src/main.jsx",
          // Render WebGL (maplibre-gl) y landing pública: fuera de alcance (docs/test-plan.md §1.2)
          "src/views/3_dashboard/modulos/ParcelasView.jsx",
          "src/views/1_inicio_presentacion/**",
          "src/components/*.jsx",
        ],
      },
    },
  })
);

