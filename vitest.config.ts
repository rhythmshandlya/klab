import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    // Webernetes ships ESM with extensionless relative imports (fine for bundlers like
    // Next). Inline it so Vite — not Node's native ESM resolver — processes it in tests.
    server: {
      deps: {
        inline: [/@ngrok[\\/]webernetes/],
      },
    },
    include: [
      "src/tests/unit/**/*.{test,spec}.{ts,tsx}",
      "src/tests/component/**/*.{test,spec}.{ts,tsx}",
      "src/tests/integration/**/*.{test,spec}.{ts,tsx}",
    ],
    testTimeout: 60000,
    css: false,
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
