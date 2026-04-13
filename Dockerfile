# syntax=docker/dockerfile:1
# Stessa pipeline di `bun run build` (core/cli/build): web static + server Bun.
# Nessun bundle Electrobun / `build/desktop`.

FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SERVER_RPC_HOST=0.0.0.0
ENV SERVER_RPC_PORT=8787
ENV FRAMEWORK_PROJECT_ROOT=/app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/build/web ./build/web
COPY --from=builder /app/core ./core
COPY --from=builder /app/server ./server
COPY --from=builder /app/desktop ./desktop
COPY --from=builder /app/client ./client
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 8787

CMD ["bun", "core/server/routes/serve.ts"]
