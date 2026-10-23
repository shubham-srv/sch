# web

Next.js frontend (App Router, server-side rendering) shipped as a Docker
container to Azure Web App for Containers. The backend is a separate ASP.NET
Core service; this app talks to it only over HTTP, from the server.

Version 1 is a single page that renders a greeting fetched from `GET /greeting`.
Its purpose is to prove the toolchain end to end: four test layers,
accessibility checks, the production image and the Azure DevOps pipeline.

## Prerequisites

- Node.js 24.22.1 (`.nvmrc`; `nvm use` or `fnm use`)
- Corepack, which installs the pnpm version pinned in `package.json`:
  `corepack enable`
- Docker with Compose v2 and BuildKit (Docker 23+), for the image and the E2E stack
- Playwright's Chromium, for E2E and pa11y: `pnpm exec playwright install chromium`

## Quick start

```sh
corepack enable
pnpm install
cp .env.example .env.local
pnpm mock-api   # terminal 1: fake backend on http://localhost:4010
pnpm dev        # terminal 2: app on http://localhost:3000
```

Point `API_BASE_URL` in `.env.local` at a real backend to use it instead of the mock.

## Scripts

| Script                            | What it does                                                                |
| --------------------------------- | --------------------------------------------------------------------------- |
| `dev` / `build` / `start`         | Next.js dev server, production build, production server                     |
| `lint` / `lint:fix`               | ESLint, including the import-boundary rules                                 |
| `format` / `format:check`         | Prettier (with Tailwind class sorting)                                      |
| `typecheck`                       | Generates Next route types, then checks the app and `e2e/`                  |
| `test`                            | All Vitest layers: `test:unit`, `test:component`, `test:int`                |
| `test:cov`                        | All Vitest layers with coverage (`coverage/`)                               |
| `test:e2e` / `test:e2e:ui`        | Playwright (headless / UI mode)                                             |
| `a11y` / `a11y:ci`                | pa11y-ci against `A11Y_BASE_URL`; `a11y:ci` also writes `reports/a11y.json` |
| `api:types`                       | Regenerates `src/lib/api/generated/schema.d.ts` from `openapi/openapi.json` |
| `api:types:pull`                  | Fetches the contract from `OPENAPI_URL`, then regenerates the types         |
| `mock-api`                        | Runs the fake backend on port 4010                                          |
| `docker:build` / `docker:run`     | Builds `web:local`; runs it against `pnpm mock-api` on the host             |
| `e2e:stack:up` / `e2e:stack:down` | Production image plus the mock API in Docker Compose                        |
| `verify`                          | Format check, lint, typecheck, all Vitest layers, production build          |

## Structure

```text
src/app/          routes only: thin pages, error boundaries, /api/health
src/features/     one folder per feature; import it through its index.ts
src/components/   shared components; ui/ is vendored shadcn/ui
src/lib/          env config, typed API client, utilities
tests/            Vitest setup, shared MSW handlers, integration tests
e2e/              Playwright specs, page objects, the mock API server
openapi/          committed snapshot of the backend contract
pipelines/        Azure DevOps YAML
docs/             architecture, testing, deployment, decisions
```

The [architecture guide](docs/architecture.md) explains where each kind of code
goes and which imports are allowed.

## Running the tests

```sh
pnpm test             # unit + component + integration
pnpm test:unit        # pure logic, Node environment
pnpm test:component   # React components, jsdom
pnpm test:int         # query + API client + component, HTTP mocked by MSW
pnpm test:e2e         # Playwright; see below for what it runs against
pnpm a11y             # pa11y-ci against a running app
```

Without `PLAYWRIGHT_BASE_URL`, `pnpm test:e2e` builds the app and starts it and
the mock API as host processes. If they are already running (for example the
compose stack below), it reuses them. More detail is in
[docs/testing.md](docs/testing.md).

## Running the container locally

```sh
pnpm docker:build        # builds web:local
pnpm mock-api            # in another terminal
pnpm docker:run          # http://localhost:3000, backend = mock API on the host
```

To test the production image the way CI does:

```sh
pnpm docker:build
pnpm e2e:stack:up        # web:local + mock API in Docker, waits for health
pnpm test:e2e
pnpm a11y:ci
pnpm e2e:stack:down
```

Deployment is described in [docs/deployment-azure.md](docs/deployment-azure.md).
