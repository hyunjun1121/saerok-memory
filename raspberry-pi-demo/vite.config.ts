import { fileURLToPath, URL } from "node:url";
import { readFile } from "node:fs/promises";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "haru-market-html-language",
      transformIndexHtml(html) {
        const language = process.env.VITE_HARU_MARKET === "jp" ? "ja" : "ko";
        return html.replace('<html lang="ko">', `<html lang="${language}">`);
      },
      configureServer(server) {
        const runtimeConfigPath = fileURLToPath(new URL("./config/runtime.json", import.meta.url));
        server.middlewares.use(async (request, response, next) => {
          if (request.url?.split("?", 1)[0] !== "/config/runtime.json") {
            next();
            return;
          }
          try {
            const body = await readFile(runtimeConfigPath, "utf8");
            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(body);
          } catch {
            next();
          }
        });
      },
    },
    react(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: process.env.HARU_OUT_DIR ?? "dist/dev",
    emptyOutDir: true,
    sourcemap: false,
  },
});
