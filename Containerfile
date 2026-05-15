# Stage 1: Build the Astro project
FROM docker.io/library/debian:12-slim AS builder

# Install build dependencies for native modules (like SQLite)
RUN apt-get update && apt-get install -y curl unzip build-essential && rm -rf /var/lib/apt/lists/*

# Install Deno
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

# Configure Deno cache directory
ENV DENO_DIR=/deno-cache
RUN mkdir -p /deno-cache

WORKDIR /app

# Copy configuration and lock files
COPY deno.json deno.lock ./

# Install dependencies and approve build scripts for native bindings
RUN deno install --allow-scripts

# Copy the rest of the application
COPY . .

# Build the Astro project
RUN deno task build

# Cache server dependencies to ensure they are available offline
RUN deno cache dist/server/entry.mjs

# Stage 2: Production runtime using distroless
FROM gcr.io/distroless/cc-debian12

# Copy the Deno binary
COPY --from=denoland/deno:bin --chown=nonroot:nonroot /deno /bin/deno

# This is the UID of the nonroot user in distroless images, ensuring we run without root privileges
USER 65532

WORKDIR /app

# Copy the Deno cache so dependencies are available offline
ENV DENO_DIR=/deno-cache
COPY --from=builder --chown=nonroot:nonroot /deno-cache /deno-cache

# Copy the built Astro output
COPY --from=builder --chown=nonroot:nonroot /app/dist ./

# Copy Deno configuration for runtime import mappings
COPY --from=builder --chown=nonroot:nonroot /app/deno.json /app/deno.lock ./

# Copy migrations for runtime execution
COPY --from=builder --chown=nonroot:nonroot /app/src/db/migrations ./src/db/migrations

# Copy node_modules for native bindings compatibility
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules

ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

# The daily advance cron is bootstrapped from src/middleware.js inside the
# Astro server process — no sidecar / shell wrapper needed (distroless/cc
# has no /bin/sh).
CMD ["/bin/deno", "run", "-A", "/app/server/entry.mjs"]