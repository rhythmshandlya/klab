import next from "eslint-config-next";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".agents/**",
      ".claude/**",
      ".superpowers/**",
      // Standalone Node dev scripts (generators/scaffolders); not app code.
      "scripts/**",
      "drizzle/**",
    ],
  },
  // Next's flat config already bundles core-web-vitals + typescript rules.
  ...next,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      // Enforce the project rule: no `any` unless explicitly justified with a comment.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Tests occasionally need `any` to bridge to browser globals (e.g. window.monaco).
    files: ["src/tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
