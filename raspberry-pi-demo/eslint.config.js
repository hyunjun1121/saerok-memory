import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist/**",
    "node_modules/**",
    "runtime/**",
    "tools/**/.venv/**",
    "tools/**/.work/**",
    "tools/**/models/**",
    "tools/**/source/**",
    "tools/tts-comparison/**",
  ]),
  {
    files: ["src/**/*.{ts,tsx}", "tools/**/*.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["playwright.config.ts", "e2e/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
]);
