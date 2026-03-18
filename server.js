// @ts-ignore
import { handle } from './dist/server/entry.mjs';
import { serveDir } from 'jsr:@std/http/file-server';

Deno.serve({ port: 8000 }, async (req) => {
  // Only try serving static files for GET and HEAD requests
  if (req.method === 'GET' || req.method === 'HEAD') {
    const res = await serveDir(req, {
      fsRoot: './dist/client',
      quiet: true,
    });

    if (res.status !== 404 && res.status !== 405) {
      return res;
    }
  }

  // Fallback to Astro SSR handle
  // @ts-ignore
  return handle(req);
});