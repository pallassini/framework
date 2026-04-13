# syntax=docker/dockerfile:1
# Stessa pipeline di `bun run build` (core/cli/build): web static + server Bun.
# Nessun bundle Electrobun / `build/desktop`.
#
# RPC browser: default `VITE_SERVER_RPC_ORIGIN=""` → fetch relative a `/_server/*` (stesso host del container).
# Override build: `docker build --build-arg VITE_SERVER_RPC_ORIGIN=https://tuo.dominio`.
# DB custom: senza `libfwdb.so` in immagine si usa solo RAM; per persistenza serve build Zig linux + `FWDB_DATA` + volume.

FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Build web: origine RPC (vuoto = same-origin quando servi SPA e API dallo stesso container)
ARG VITE_SERVER_RPC_ORIGIN=
ENV VITE_SERVER_RPC_ORIGIN=$VITE_SERVER_RPC_ORIGIN

RUN bun run build

FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SERVER_RPC_HOST=0.0.0.0
# Allineato ai pannelli tipo Coolify (Container port 3000). Override: `PORT` / `SERVER_RPC_PORT`.
ENV PORT=3000
ENV FRAMEWORK_PROJECT_ROOT=/app
# Opzionale: directory dati fwdb (catalog.json, snapshot, wal). Monta un volume su questo path.
# ENV FWDB_DATA=/data/fwdb

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/build/web ./build/web
COPY --from=builder /app/core ./core
COPY --from=builder /app/server ./server
COPY --from=builder /app/desktop ./desktop
COPY --from=builder /app/client ./client
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD ["bun", "core/cli/docker-health.ts"]

CMD ["bun", "core/server/routes/serve.ts"]
