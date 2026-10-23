# syntax=docker/dockerfile:1

# Keep in step with .nvmrc.
ARG NODE_VERSION=24.22.1

FROM node:${NODE_VERSION}-slim AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# --- deps: install from the lockfile only ---------------------------------
FROM base AS deps
# The prepare script runs husky, which must not touch git inside the image.
ENV HUSKY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- builder: no secrets and no environment-specific values -----------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- runner: standalone server only, as a non-root user ---------------------
FROM node:${NODE_VERSION}-slim AS runner
ARG BUILD_ID=local
ARG COMMIT_SHA=unknown
LABEL org.opencontainers.image.title="web" \
      org.opencontainers.image.version="${BUILD_ID}" \
      org.opencontainers.image.revision="${COMMIT_SHA}"
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# The node user owns the files because Next.js writes its caches under .next.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

# Slim images have no curl, so the probe uses Node's fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "server.js"]
