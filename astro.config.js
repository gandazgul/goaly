import { defineConfig, passthroughImageService } from 'astro/config';
import deno from '@astrojs/deno';
import unocss from 'unocss/astro';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: deno(),
  integrations: [unocss({ injectReset: true })],
  security: {
    checkOrigin: false
  },
  image: {
    service: passthroughImageService()
  }
});