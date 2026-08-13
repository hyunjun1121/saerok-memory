import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tools/**/*.test.ts"],
    environment: "jsdom",
    globals: true,
    setupFiles: [fileURLToPath(new URL("./src/setupTests.ts", import.meta.url))],
    css: true,
  },
});
