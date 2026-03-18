import { defineConfig } from 'astro/config';
import deno from '@astrojs/deno';
import unocss from 'unocss/astro';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: deno({ start: false }),
  integrations: [unocss({ injectReset: true })],
  security: {
    checkOrigin: false
  }
});