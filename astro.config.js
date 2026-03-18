import { defineConfig, passthroughImageService } from "astro/config";
import deno from "@astrojs/deno";
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
