const config = {
  "*.{js,cjs,mjs,ts,tsx}": "prettier --write",
  "src/**/*.{ts,tsx}": "eslint --fix --max-warnings=0",
  "*.{css,json,jsonc,md,yaml,yml}": "prettier --write",
};

export default config;
