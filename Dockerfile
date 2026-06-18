ARG BUN_VERSION=1.3.14
ARG S6_OVERLAY_VERSION=3.2.2.0
ARG POCKETBASE_VERSION=0.39.4
ARG CADDY_VERSION=2.11.4

# ── Build stage ──
FROM oven/bun:${BUN_VERSION}-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile
COPY . .
RUN bun run build

# ── Production stage ──
FROM oven/bun:${BUN_VERSION}-alpine AS production

ARG S6_OVERLAY_VERSION
ARG POCKETBASE_VERSION
ARG CADDY_VERSION
ARG TARGETARCH

# Install runtime dependencies
RUN apk add --no-cache ca-certificates curl xz unzip

# Install s6-overlay (uses x86_64/aarch64 naming, not amd64/arm64)
RUN S6_ARCH=$(case "${TARGETARCH:-amd64}" in amd64) echo "x86_64" ;; arm64) echo "aarch64" ;; esac) && \
    curl -L -o /tmp/s6-overlay-noarch.tar.xz "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" && \
    curl -L -o /tmp/s6-overlay-arch.tar.xz "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz" && \
    tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-arch.tar.xz && \
    rm -f /tmp/s6-overlay-*.tar.xz

# Install PocketBase
RUN curl -L "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH:-amd64}.zip" \
    -o /tmp/pocketbase.zip && \
    mkdir -p /app/pocketbase && \
    unzip /tmp/pocketbase.zip -d /app/pocketbase && \
    chmod +x /app/pocketbase/pocketbase && \
    rm -f /tmp/pocketbase.zip

# Install Caddy
RUN mkdir -p /etc/caddy && \
    curl -L "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_${TARGETARCH:-amd64}.tar.gz" \
    -o /tmp/caddy.tar.gz && \
    tar -xzf /tmp/caddy.tar.gz -C /usr/bin caddy && \
    chmod +x /usr/bin/caddy && \
    rm -f /tmp/caddy.tar.gz

# Copy built application from builder
RUN mkdir -p /app/server /app/static /app/pb_migrations
COPY --from=builder /app/output/server/serve /app/server/serve
COPY --from=builder /app/output/static /app/static
COPY --from=builder /app/output/pb_migrations /app/pb_migrations
COPY --from=builder /app/output/Caddyfile /etc/caddy/Caddyfile

# Copy s6-overlay service definitions
COPY s6/setup-dirs/type /etc/s6-overlay/s6-rc.d/setup-dirs/type
COPY s6/setup-dirs/up /etc/s6-overlay/s6-rc.d/setup-dirs/up
COPY s6/pocketbase/type /etc/s6-overlay/s6-rc.d/pocketbase/type
COPY s6/pocketbase/run /etc/s6-overlay/s6-rc.d/pocketbase/run
COPY s6/api-server/type /etc/s6-overlay/s6-rc.d/api-server/type
COPY s6/api-server/run /etc/s6-overlay/s6-rc.d/api-server/run
COPY s6/caddy/type /etc/s6-overlay/s6-rc.d/caddy/type
COPY s6/caddy/run /etc/s6-overlay/s6-rc.d/caddy/run

# Copy dependency files
COPY s6/setup-dirs/dependencies.d/base /etc/s6-overlay/s6-rc.d/setup-dirs/dependencies.d/base
COPY s6/pocketbase/dependencies.d/base /etc/s6-overlay/s6-rc.d/pocketbase/dependencies.d/base
COPY s6/pocketbase/dependencies.d/setup-dirs /etc/s6-overlay/s6-rc.d/pocketbase/dependencies.d/setup-dirs
COPY s6/api-server/dependencies.d/base /etc/s6-overlay/s6-rc.d/api-server/dependencies.d/base
COPY s6/api-server/dependencies.d/pocketbase /etc/s6-overlay/s6-rc.d/api-server/dependencies.d/pocketbase
COPY s6/caddy/dependencies.d/base /etc/s6-overlay/s6-rc.d/caddy/dependencies.d/base
COPY s6/caddy/dependencies.d/pocketbase /etc/s6-overlay/s6-rc.d/caddy/dependencies.d/pocketbase
COPY s6/caddy/dependencies.d/api-server /etc/s6-overlay/s6-rc.d/caddy/dependencies.d/api-server

# Register services in user bundle
COPY s6/user/contents.d/setup-dirs /etc/s6-overlay/s6-rc.d/user/contents.d/setup-dirs
COPY s6/user/contents.d/pocketbase /etc/s6-overlay/s6-rc.d/user/contents.d/pocketbase
COPY s6/user/contents.d/api-server /etc/s6-overlay/s6-rc.d/user/contents.d/api-server
COPY s6/user/contents.d/caddy /etc/s6-overlay/s6-rc.d/user/contents.d/caddy

# Make service scripts executable
RUN chmod +x /etc/s6-overlay/s6-rc.d/pocketbase/run \
              /etc/s6-overlay/s6-rc.d/api-server/run \
              /etc/s6-overlay/s6-rc.d/caddy/run \
              /etc/s6-overlay/s6-rc.d/setup-dirs/up

# Persistent data volume
VOLUME /data

# Environment defaults (overridden at runtime)
# Inside Docker, all services share the same network namespace
# so 127.0.0.1 works for both listening and reverse proxy targets
ENV SERVER_HOSTNAME=127.0.0.1
ENV SERVER_PORT=5173
ENV POCKETBASE_HOSTNAME=127.0.0.1
ENV POCKETBASE_PORT=8090
ENV PUBLIC_DOMAIN=ski-tripper.localhost
ENV PUBLIC_POCKETBASE_DOMAIN=pb.ski-tripper.localhost

EXPOSE 80 443

ENTRYPOINT ["/init"]