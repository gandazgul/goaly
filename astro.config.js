// Polyfill for Astro's Vite CJS evaluator in Deno
globalThis.exports = globalThis.exports || {};
// @ts-expect-error needed for Vite/CJS polyfill
globalThis.module = globalThis.module || { exports: globalThis.exports };

import { defineConfig, passthroughImageService } from "astro/config";
import deno from "@deno/astro-adapter";
import unocss from "unocss/astro";

// https://astro.build/config
export default defineConfig({
  output: "server",
  server: {
    port: 8080,
    host: "0.0.0.0",
  },
  adapter: deno({
    port: 8080,
    hostname: "0.0.0.0",
  }),
  integrations: [unocss({ injectReset: true })],
  security: {
    checkOrigin: false,
  },
  image: {
    service: passthroughImageService(),
  },
  vite: {
    build: {
      rollupOptions: {
        external: ["node:sqlite"],
      },
    },
    ssr: {
      external: ["node:sqlite"],
    },
  },
});
