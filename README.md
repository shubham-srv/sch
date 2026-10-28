# web — developer reference

Commands, scripts and conventions for working on the frontend. For what the
app is, how to set it up and how it works, start with
[readme-prod.md](readme-prod.md). New to the tools or to testing? Read
[docs/dummy-guide.md](docs/dummy-guide.md).

## Prerequisites

- Node.js 24.22.1 (`.nvmrc`; `nvm use`). Node 22.22.2 or later also works
  locally; the pipeline and Azure run 24.
- Corepack, which installs the Yarn version pinned in `package.json`:
  `corepack enable`
- A running backend. Locally, that's your backend container; set
  `API_BASE_URL` in `.env.local`.
- Playwright's Chromium, for E2E and pa11y: `yarn playwright install chromium`

## Everyday commands

```sh
yarn install
cp .env.example .env.local   # then point API_BASE_URL at your backend
yarn dev                     # http://localhost:3000, with hot reload
yarn test                    # unit + component + integration (no backend needed)
yarn verify                  # what the pipeline's Validate stage checks, plus the build
```

## Scripts

| Script                     | What it does                                                                |
| -------------------------- | --------------------------------------------------------------------------- |
| `dev`                      | Next.js dev server with hot reload                                          |
| `build`                    | `next build`, then packages the deployable app into `dist/app`              |
| `start`                    | Runs `dist/app/server.js` (the production server), reading `.env.local`     |
| `lint` / `lint:fix`        | ESLint, including import-boundary and declared-dependency rules             |
| `format` / `format:check`  | Prettier (with Tailwind class sorting)                                      |
| `typecheck`                | Generates Next route types, then checks the app and `e2e/`                  |
| `test`                     | All Vitest layers: `test:unit`, `test:component`, `test:int`                |
| `test:cov`                 | All Vitest layers with coverage (`coverage/`)                               |
| `test:e2e` / `test:e2e:ui` | Playwright against a real backend (headless / UI mode)                      |
| `a11y` / `a11y:ci`         | pa11y-ci against `A11Y_BASE_URL`; `a11y:ci` also writes `reports/a11y.json` |
| `verify`                   | Format check, lint, typecheck, all Vitest layers, build                     |

## Structure

```text
src/app/          routes only: thin pages, error boundaries, /api/health
src/features/     one folder per feature; import it through its index.ts
src/components/   shared components; ui/ is vendored shadcn/ui
src/lib/          env config, backend client, utilities
tests/            Vitest setup, MSW fake backend, integration tests
e2e/              Playwright specs and page objects
scripts/          build helpers (package-app.mjs)
pipelines/        Azure DevOps YAML (main pipeline, nightly E2E, templates)
docs/             architecture, testing, deployment, decisions, guide
```

The [architecture guide](docs/architecture.md) explains where each kind of code
goes and which imports are allowed.

## Tests

```sh
yarn test             # unit + component + integration; uses the MSW fake backend
yarn test:unit        # pure logic, Node environment
yarn test:component   # React components, jsdom
yarn test:int         # query + API client + component, HTTP faked by MSW
yarn vitest           # watch mode: re-runs tests as you save
yarn test:e2e         # Playwright; needs a real backend (see below)
yarn a11y             # pa11y-ci against a running app
```

E2E always uses a real backend:

- `yarn test:e2e` builds the app, starts it with `API_BASE_URL` from
  `.env.local` (your backend container) and runs the tests. If an app is
  already running on port 3000, it is reused.
- `PLAYWRIGHT_BASE_URL=https://<deployed-url> yarn test:e2e` tests a deployed
  environment instead, and starts nothing.
- Set `E2E_EXPECTED_GREETING` to check the greeting's exact text.

More detail is in [docs/testing.md](docs/testing.md).

## Running the production build locally

```sh
yarn build    # creates dist/app
yarn start    # http://localhost:3000, API_BASE_URL from .env.local
```

On Windows, stop `yarn start` before rebuilding: a running server locks `dist/app`.

## Docs

- [readme-prod.md](readme-prod.md): overview, setup, how it works
- [docs/dummy-guide.md](docs/dummy-guide.md): detailed guide to every tool and the testing approach
- [docs/architecture.md](docs/architecture.md): layering, import rules, API conventions
- [docs/testing.md](docs/testing.md): test layers and where they run
- [docs/deployment-azure.md](docs/deployment-azure.md): Azure and pipeline setup
- [docs/decisions.md](docs/decisions.md): choices made and why
