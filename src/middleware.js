import { startAdvanceCron } from "./server/advance.js";

// Boot the daily advancement cron once when the server module is first
// loaded. This replaces a sidecar process — keeping it in-process avoids
// needing a shell wrapper in the (shell-less) distroless runtime image.
startAdvanceCron();

/** @type {import('astro').MiddlewareHandler} */
export const onRequest = (_context, next) => next();
