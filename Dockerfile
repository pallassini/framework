# syntax=docker/dockerfile:1
# Stessa pipeline di `bun run build` (core/cli/build): web static + server Bun.
# Nessun bundle Electrobun / `build/desktop`.
# Motore `core/dbCustom` (Zig): compilato in stage dedicato → `zig-out/lib/libcustom_db.so`.

FROM debian:bookworm-slim AS zigbuild
RUN apt-get update && apt-get install -y wget xz-utils ca-certificates \
	&& wget -q https://ziglang.org/download/0.15.2/zig-linux-x86_64-0.15.2.tar.xz \
	&& tar -xf zig-linux-x86_64-0.15.2.tar.xz -C /opt \
	&& mv /opt/zig-linux-x86_64-0.15.2 /opt/zig
ENV PATH="/opt/zig:${PATH}"
WORKDIR /src
COPY core/dbCustom/zig .
RUN zig build -Doptimize=ReleaseSafe

FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN rm -rf core/dbCustom/zig/zig-out core/dbCustom/zig/.zig-cache
COPY --from=zigbuild /src/zig-out ./core/dbCustom/zig/zig-out
RUN bun run build

FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SERVER_RPC_HOST=0.0.0.0
# Allineato ai pannelli tipo Coolify (Container port 3000). Override: `PORT` / `SERVER_RPC_PORT`.
ENV PORT=3000
ENV FRAMEWORK_PROJECT_ROOT=/app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/build/web ./build/web
COPY --from=builder /app/core ./core
COPY --from=builder /app/server ./server
COPY --from=builder /app/desktop ./desktop
COPY --from=builder /app/client ./client
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

CMD ["bun", "core/server/routes/serve.ts"]
