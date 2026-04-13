# syntax=docker/dockerfile:1
# Web static + server Bun + **libfwdb.so** (Zig) per FFI obbligatorio.
#
# RPC: `VITE_SERVER_RPC_ORIGIN=""` di default → stesso origin.
# DB: `FWDB_LIB` punta alla .so in immagine; dati in `/app/data` (monta volume per persistenza).
# Zig: tarball ufficiale da ziglang.org (evita `ziglang/zig` su Hub, spesso assente o non pullabile).

FROM debian:bookworm-slim AS zigbuild
WORKDIR /src

ARG ZIG_VERSION=0.15.2
ARG TARGETARCH

RUN apt-get update \
&& apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
	&& rm -rf /var/lib/apt/lists/* \
	&& set -eux \
	&& case "$TARGETARCH" in \
		amd64) ZIG_ARCH=x86_64 ;; \
		arm64) ZIG_ARCH=aarch64 ;; \
		*) echo "unsupported TARGETARCH=$TARGETARCH" >&2; exit 1 ;; \
	esac \
	&& curl -fsSL "https://ziglang.org/download/${ZIG_VERSION}/zig-${ZIG_ARCH}-linux-${ZIG_VERSION}.tar.xz" -o /tmp/zig.tar.xz \
	&& tar -xJf /tmp/zig.tar.xz -C /opt \
	&& rm /tmp/zig.tar.xz \
	&& ln -sf "/opt/zig-${ZIG_ARCH}-linux-${ZIG_VERSION}/zig" /usr/local/bin/zig

COPY core/db/zig/ ./
RUN zig build -Doptimize=ReleaseSafe

FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ARG VITE_SERVER_RPC_ORIGIN=
ENV VITE_SERVER_RPC_ORIGIN=$VITE_SERVER_RPC_ORIGIN

RUN bun run build
ENV FRAMEWORK_PROJECT_ROOT=/app
RUN bun run db push

FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SERVER_RPC_HOST=0.0.0.0
ENV PORT=3000
ENV FRAMEWORK_PROJECT_ROOT=/app
ENV FWDB_LIB=/app/lib/libfwdb.so

RUN mkdir -p /app/lib

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=zigbuild /src/zig-out/bin/libfwdb.so /app/lib/libfwdb.so
COPY --from=builder /app/build/web ./build/web
COPY --from=builder /app/core ./core
COPY --from=builder /app/server ./server
COPY --from=builder /app/desktop ./desktop
COPY --from=builder /app/client ./client
COPY --from=builder /app/db ./db
COPY --from=builder /app/data ./data
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

CMD ["bun", "core/server/routes/serve.ts"]
