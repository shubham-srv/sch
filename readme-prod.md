# Web frontend

The web frontend for our product. It is a Next.js application that renders
pages on the server, gets its data from our ASP.NET Core backend API, and runs
on Azure App Service.

Today (Version 1) it has one page: it asks the backend for a greeting and
shows it as the page heading. That page is deliberately small; its job is to
prove that the whole path works, from a developer's laptop through the tests
and the pipeline to Azure. Sign-in with Microsoft Entra ID comes in Version 2.

## How it works

```text
   Browser                    Azure Web App (Linux, Node 24)            Backend API
 ┌──────────┐   HTTPS   ┌──────────────────────────────────────┐  HTTPS  ┌──────────┐
 │  page,   │ ────────► │  Next.js server (dist/app/server.js) │ ──────► │ ASP.NET  │
 │  HTML,   │ ◄──────── │  renders the page, calls the backend │ ◄────── │ Core API │
 │  CSS, JS │           │  with API_BASE_URL                   │         │          │
 └──────────┘           └──────────────────────────────────────┘         └──────────┘
```

1. A user opens the site. The request goes to the **Next.js server** running
   on Azure App Service.
2. The server immediately sends the parts of the page that never change
   (header, layout). In the same response, it calls the backend:
   `GET {API_BASE_URL}/greeting`.
3. When the backend answers, the server checks the response has the expected
   shape and streams the heading into the page. If the backend fails, the
   user sees a friendly error with a **Try again** button, never internal details.
4. The browser never talks to the backend directly. Backend addresses (and,
   later, tokens) stay on the server.

A few more things worth knowing:

- **One build, every environment.** The same build runs everywhere. What
  differs (such as which backend to call) comes from app settings at runtime.
- **Health check.** `/api/health` answers `{"status":"ok"}` without calling
  the backend. Azure uses it to know the app is alive.
- **Accessibility.** Pages have a skip link, landmarks, a single `h1`, visible
  focus and AA colour contrast. Automated checks enforce this.

## Tech at a glance

| Area        | Choice                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------- |
| Framework   | Next.js 16 (App Router, server rendering), React 19, TypeScript                          |
| Styling     | Tailwind CSS 4, shadcn/ui components                                                     |
| Data checks | zod (validates config and every backend response)                                        |
| Tests       | Vitest + React Testing Library + MSW; Playwright for end-to-end; pa11y for accessibility |
| Delivery    | Azure DevOps Pipelines, Azure Artifacts, Azure App Service (Linux, Node 24)              |

The reasons behind each choice are in [docs/dummy-guide.md](docs/dummy-guide.md).

## Setting it up locally

You need:

- **Node.js 24.22.1.** With nvm: `nvm install 24.22.1` then `nvm use 24.22.1`.
- **pnpm**, through Corepack, which comes with Node: `corepack enable`.
- **The backend** running locally (the backend team's container), or the
  URL of a backend you can reach.

Then:

```sh
git clone <repo-url>
cd <repo-folder>
corepack enable
pnpm install
cp .env.example .env.local
```

Edit `.env.local` and set `API_BASE_URL` to your backend, for example
`http://localhost:8080`. Then start the app:

```sh
pnpm dev
```

Open http://localhost:3000. You should see the backend's greeting as the
heading. If you see "Something went wrong", the app could not reach the
backend: check that it is running and that `API_BASE_URL` is right.

### Checking your work

```sh
pnpm test        # fast tests; no backend needed
pnpm verify      # everything the pipeline checks first, plus the build
pnpm exec playwright install chromium   # once, for the browser tests
pnpm test:e2e    # end-to-end tests in a real browser, against your backend
```

## Configuration

| Variable                | Used by        | Meaning                                                         |
| ----------------------- | -------------- | --------------------------------------------------------------- |
| `API_BASE_URL`          | the app        | Backend base URL, e.g. `https://api.example.com/api`. Required. |
| `E2E_EXPECTED_GREETING` | E2E tests only | If set, the tests check the greeting's exact text.              |

Locally they go in `.env.local` (never committed). In Azure they are Web App
app settings. Secrets, once there are any, come from Azure Key Vault.

## From commit to production

```text
pull request ──► checks: format, lint, types, unit/component/integration tests,
                 build, E2E + accessibility on the built app against the staging backend
merge to main ──► same checks ──► package stored in Azure Artifacts
              ──► deployed to the staging slot ──► full E2E against staging
manual run + approval ──► staging swapped into production ──► smoke tests on production
every night ──► E2E + accessibility on staging, smoke tests on production
```

A pull request can only merge when its checks pass. Production changes only
through an approved swap, and swapping back restores the previous version.
Details are in [docs/deployment-azure.md](docs/deployment-azure.md).

## Project layout

```text
src/app/        pages and routes (kept thin)
src/features/   one folder per feature (today: greeting)
src/components/ shared UI; ui/ holds shadcn/ui components
src/lib/        configuration, backend client, utilities
tests/          fast tests' setup and fake backend
e2e/            browser tests
pipelines/      Azure DevOps pipelines
docs/           detailed documentation
```

## Learn more

- [README.md](README.md): developer reference (all scripts and commands)
- [docs/dummy-guide.md](docs/dummy-guide.md): how everything works, step by step, and why each tool was chosen
- [docs/architecture.md](docs/architecture.md): code structure and conventions
- [docs/testing.md](docs/testing.md): the test layers
- [docs/deployment-azure.md](docs/deployment-azure.md): Azure and pipeline setup
- [docs/decisions.md](docs/decisions.md): decisions and their reasons
