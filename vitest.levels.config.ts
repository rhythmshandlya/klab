import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Focused problem-content gate. This keeps the catalog's semantic checks and
 * red-to-green simulator proofs independently runnable while retaining the same
 * browser-like environment as the main suite.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    name: "levels",
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: [
      "src/tests/unit/content.test.ts",
      "src/tests/unit/manifest-constraints.test.ts",
      "src/tests/unit/level-store.test.ts",
      "src/tests/unit/quick-command.test.ts",
      "src/tests/integration/level-solve.test.ts",
      "src/tests/integration/levels.test.ts",
      "src/tests/integration/rolling-update.test.ts",
      "src/tests/integration/scripted-engine.test.ts",
    ],
    testTimeout: 120_000,
    css: false,
    clearMocks: true,
    restoreMocks: true,
    server: {
      deps: {
        inline: [/@ngrok[\\/]webernetes/],
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
