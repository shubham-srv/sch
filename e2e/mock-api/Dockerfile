# syntax=docker/dockerfile:1
# Test fake only: the mock backend for the E2E and accessibility stack
# (docker-compose.e2e.yml). Build context is the repository root; the
# context is filtered by Dockerfile.dockerignore next to this file.
#
# It installs inside the image rather than mounting the repo, because
# node_modules installed on a Windows or macOS host holds native binaries for
# that host and does not run in a Linux container.

ARG NODE_VERSION=24.22.1
FROM node:${NODE_VERSION}-slim
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    HUSKY=0
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY tests/mocks ./tests/mocks
COPY e2e/mock-api ./e2e/mock-api

USER node
EXPOSE 4010
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --start-interval=1s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4010/greeting').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node_modules/.bin/tsx", "e2e/mock-api/server.ts"]
