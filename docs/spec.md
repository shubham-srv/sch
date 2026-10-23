# Frontend Starter Codebase: Scaffolding Spec

**Audience:** an AI coding agent that will create the initial frontend codebase from scratch.
**Convention:** **MUST** means the owner has decided and it is not negotiable. Where this spec is silent, choose the simplest option consistent with it and record the choice in `docs/decisions.md`.

---

## 0. How to use this document

**Scope: frontend only.** Create the frontend repository and nothing else. Do **not** create a backend, database code, or infrastructure-as-code. The ASP.NET Core backend is a separate repository owned by someone else. The mock API under `e2e/` is a **test fake**: app code must never import it, and it must never ship in the production image.

**Structure of this document**

| Part | What it is |
|---|---|
| **Part A: Shared foundation** | Stack, architecture rules, testing approach, Docker, pipeline. Applies to both versions. |
| **Version 1: Hello world** | A single page that shows a greeting fetched from the backend. All four test layers, Docker, and a pipeline that deploys to Azure and smoke-tests it. Its purpose is to prove the whole toolchain works together, locally and in the cloud. |
| **Version 2: Entra ID sign-in** | Builds on Version 1. Adds a login page, Microsoft Entra ID authentication, and server-side token handling. |

**Implement Version 1 only**, and stop, unless the owner explicitly asks for Version 2 (or both). Version 2 is described here so that Version 1's structure does not need rework, but do not build any of its code, dependencies, or routes in Version 1.

**How to work**

1. Read the whole document before writing code.
2. **Do not rely on version numbers from memory.** Install the latest stable release of every dependency at scaffold time. Read the current docs for Next.js 16.x, Tailwind CSS v4, the shadcn/ui CLI, Vitest, Playwright, pa11y-ci, and the Azure DevOps tasks you use. Record installed versions in `docs/decisions.md`.
3. Follow the build order of the version you are implementing. After each step, run the checks that apply. Never leave the repo in a non-building state.
4. If something is ambiguous, pick the simplest reading, note it in `docs/decisions.md`, and continue. Stop only for things that would contradict this spec.
5. Actually run the commands in the Definition of done. If your environment lacks Docker or browsers, say precisely what you could not verify.
6. Install only the dependencies you use. Do not create empty placeholder folders; `docs/architecture.md` lists where each kind of code goes.
7. Anything written like `<this>` is a placeholder the owner fills in later. Never invent real values. Leave a `TODO(owner)` comment where one is needed.

### Placeholders

| Placeholder | Meaning | Default |
|---|---|---|
| `<project-name>` | npm package name and image name | `web` |
| `<acr-name>` | Azure Container Registry | TODO(owner) |
| `<acr-service-connection>` | Azure DevOps service connection to ACR | TODO(owner) |
| `<arm-service-connection>` | Azure DevOps service connection to the Azure subscription | TODO(owner) |
| `<webapp-staging>` / `<webapp-prod>` | Azure Web App names | TODO(owner) |
| `<resource-group>` | Azure resource group | TODO(owner) |
| `<tenant-id>`, `<entra-client-id>`, `<entra-api-scope>`, `<keyvault-name>` | Version 2 only | TODO(owner) |

---

# Part A: Shared foundation

## A1. Context

- A Next.js (App Router) frontend with **server-side rendering**, shipped as a **Docker container** to **Azure Web App for Containers**.
- Source and pipelines live in **Azure DevOps** (Azure Repos Git + YAML pipelines), in a repo separate from the backend.
- **The Next.js server talks to exactly two things:** the backend API at `API_BASE_URL`, and (Version 2 only) Microsoft Entra ID for sign-in. No database access, no other services.
- The backend is ASP.NET Core and is outside this task. The frontend knows it only through an HTTP contract (OpenAPI). Whatever pattern the backend uses internally (including CQRS) is not reflected in the frontend's structure.
- Required test layers: **unit, component, integration, end-to-end (Playwright)**, plus **accessibility checks with pa11y**.

## A2. Stack (MUST)

| Concern | Choice |
|---|---|
| Framework | Next.js 16.x, App Router, TypeScript (strict) |
| Styling / UI | Tailwind CSS v4 (CSS-first config) + shadcn/ui |
| Package manager | pnpm (Corepack, `packageManager` field set) |
| Node | Current Active LTS, pinned in `.nvmrc` and `engines` |
| Env validation | zod |
| API types / client | `openapi-typescript` (types) + `openapi-fetch` (typed client) |
| Unit / component / integration | Vitest + React Testing Library + `@testing-library/user-event` + `@testing-library/jest-dom` |
| Network mocking | MSW |
| E2E | Playwright (`@playwright/test`) |
| Accessibility | **pa11y-ci** (required gate) |
| Lint / format | ESLint (flat config, run via the ESLint CLI because `next lint` is deprecated), Prettier with the Tailwind plugin |
| CI/CD | Azure DevOps YAML pipelines |
| Runtime | Docker, Next.js `output: 'standalone'` |

Version 2 adds `openid-client` and `jose` (see Version 2).

## A3. Architecture rules

1. **`src/app` is thin.** Route files compose feature components and call feature functions. No business logic in route files.
2. **Features own their code** under `src/features/<name>/`. A feature exposes only what its `index.ts` exports. Other code imports through that file, never its internals.
3. **Import boundaries, enforced by ESLint** (`no-restricted-imports` overrides, no extra plugin unless clearly cleaner):
   - `components/ui` may not import from `features/*` or `lib/api`.
   - `lib/*` may not import from `features/*` or `components/*`.
   - A feature may not import another feature's internals.
4. **Server/client boundary.**
   - Files that touch the backend, secrets, or the session start with `import "server-only"`.
   - Use `"use client"` only where interactivity requires it, as low in the tree as possible.
   - In Vitest, alias `server-only` to an empty module so those files can be tested.
5. **Keep server components thin.** Push logic into plain functions that can be unit tested. Async server components are exercised by Playwright, not by Vitest.
6. **Environment and runtime config.**
   - Build **one image, deploy it to every environment**. Do not use `NEXT_PUBLIC_*` for anything that differs between environments.
   - Read config from server env at runtime through `src/lib/env.server.ts` (zod-validated).
   - **Validate lazily, on first access.** Eager validation at import time crashes `next build` inside Docker, where runtime vars are absent. Skipping validation when `process.env.NEXT_PHASE === 'phase-production-build'` is also acceptable.
   - Server code that reads runtime env during **static prerender** is evaluated at build time. Pages that depend on runtime env must be dynamic (read cookies/headers, call `connection()`, or mark the route dynamic). The greeting page must be dynamic because it fetches from the backend on every request.
7. **Baseline security.** In `next.config.ts`: `poweredByHeader: false`, `output: 'standalone'`, and security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors` via CSP or `X-Frame-Options`, HSTS). A full nonce-based CSP is a follow-up, not part of this task.

## A4. API layer conventions

The frontend consumes the backend through its HTTP contract. Next.js has no official naming convention for data code, so use these:

1. **Types come from the contract.** `openapi/openapi.json` is a committed snapshot of the backend contract. `pnpm api:types` runs `openapi-typescript` into `src/lib/api/generated/schema.d.ts` (also committed). `pnpm api:types:pull` fetches the document from `OPENAPI_URL` into the snapshot for when the real backend is reachable. CI fails if `pnpm api:types` leaves a git diff (contract drift check).
2. **File and function naming, per feature, under `api/`:**
   - `queries.ts`: reads. Starts with `import "server-only"`. Functions named `get*` / `list*` (for example `getGreeting`). Called from Server Components.
   - `actions.ts`: writes. Starts with `"use server"`. Functions are imperative verbs matching the backend endpoint's `operationId` (for example `createOrder`, `cancelOrder`), so a frontend function traces directly to a backend endpoint.
   - `mappers.ts`: API DTO to UI model.
   - **Every exported function in a `"use server"` file becomes a publicly callable endpoint.** Put only real actions in `actions.ts`; keep helpers in other files.
3. **The browser never calls the backend.** Reads run in Server Components, writes run through Server Actions.
4. **Shared client plumbing** in `src/lib/api/`:
   - `client.ts`: builds the typed client for `API_BASE_URL` and adds middleware that sends `X-Correlation-Id` (forwarded from the incoming request, or generated).
   - `server.ts`: server-only entry point that feature queries use.
   - `errors.ts`: turns HTTP failures and RFC 9457 `ProblemDetails` bodies into a typed `ApiError`.
5. **Conventions to apply when a feature first has writes** (not needed in Versions 1 and 2, so do not build them yet): validate input with zod; return an `ActionResult<T>` discriminated union (`ok: true, data` or `ok: false, code, message, fieldErrors?`); send an `Idempotency-Key` header on POSTs if the backend supports it; invalidate cache tags afterwards (Next.js 16 has `updateTag` for immediate invalidation in Server Actions and `revalidateTag` for stale-while-revalidate; pick deliberately from the installed version's docs). If the backend turns out to update its read side asynchronously, do not assume read-your-writes. Document this in `docs/architecture.md`.

## A5. Testing approach (MUST)

### Layers

| Layer | Tooling | Location / naming | Mocks |
|---|---|---|---|
| Unit | Vitest, **node** env | `src/**/*.test.ts` | nothing (pure logic) |
| Component | Vitest + RTL, **jsdom** | `src/**/*.test.tsx`, colocated | no network; server code stubbed with `vi.fn()` |
| Integration | Vitest + RTL, jsdom | `tests/integration/**/*.int.test.{ts,tsx}` | only the HTTP boundary via **MSW**; real query function, real API client, real components |
| E2E | Playwright | `e2e/tests/*.spec.ts` | the **production Docker image** talking to the mock API |

Use **Vitest `projects`** (one per layer) so each has its own environment and include globs. Scripts: `test:unit`, `test:component`, `test:int`, and `test` (all three).

### Shared infrastructure

- `tests/setup/vitest.setup.ts`: jest-dom matchers, RTL cleanup, MSW server lifecycle with `onUnhandledRequest: 'error'`.
- `tests/utils/`: helpers such as `renderWithProviders` and mocks for `next/navigation`, `next/headers`, `next/cache`. Add only what tests actually use.
- `tests/mocks/handlers.ts`: **single source of truth** for backend fakes. Vitest layers use it through MSW. The E2E mock API (`e2e/mock-api/server.ts`) **reuses the same handlers** (for example through `@mswjs/http-middleware`) so there is one fake backend. If that proves unworkable, share fixtures instead and explain why in `docs/decisions.md`.
- Coverage: v8 provider, reporters `text`, `html`, `cobertura`, `lcov`, plus a `junit` test reporter for Azure DevOps. Modest placeholder thresholds, stated in `docs/testing.md`.

### Playwright

- `baseURL` from `PLAYWRIGHT_BASE_URL` (default `http://localhost:3000`). If it is unset locally, `webServer` builds and starts the production server and the mock API as host processes.
- CI: `forbidOnly`, 2 retries, limited workers. Reporters `list`, `html`, **`junit`**. `trace: 'on-first-retry'`, `video: 'retain-on-failure'`.
- Use page objects and role/label locators, never CSS selectors.
- Tag a small subset `@smoke`. Smoke tests must be safe to run against a deployed environment (read-only, no mock-only assumptions).
- **Why E2E needs a mock API server:** server-side fetches run inside the Next.js server process, so Playwright's `page.route` cannot intercept them. The Next server must be pointed at a fake through `API_BASE_URL`.

## A6. Accessibility: pa11y-ci (MUST)

- `pa11y-ci` as a devDependency, configured in `.pa11yci.js` (JS so it can read the base URL from env).
- `defaults`: standard `WCAG2AA`, runners `axe` and `htmlcs`, a sensible `timeout`, `chromeLaunchConfig.args: ['--no-sandbox']` for CI.
- Scripts: `a11y` (against `A11Y_BASE_URL`, default `http://localhost:3000`) and `a11y:ci` (JSON report to `reports/a11y.json`). Any error **fails the build**. Every ignore-list entry requires a comment explaining why.
- **pnpm gotcha:** recent pnpm versions block dependency lifecycle scripts by default, which stops Puppeteer from downloading Chrome. Either allowlist the needed packages through `pnpm.onlyBuiltDependencies` (puppeteer, sharp, esbuild, and so on) or point pa11y at the Playwright Chromium via `chromeLaunchConfig.executablePath`. Pick one and document it.
- **Accessibility baseline in the UI:** `<html lang>`, a skip-to-content link, landmark regions (`header`, `main`), one `h1` per page, visible `:focus-visible` styles, WCAG AA colour contrast.

## A7. Docker and Azure Web App

### Dockerfile (multi-stage)

1. `deps`: Corepack-enabled pnpm, `pnpm install --frozen-lockfile`. Set `HUSKY=0` so the `prepare` script cannot break the build.
2. `builder`: copy source, `pnpm build`. No secrets and no environment-specific values at build time.
3. `runner`: slim or alpine Node LTS, **non-root user**. Copy exactly three things: `.next/standalone`, `.next/static` into `.next/static`, and `public`. Set `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `NEXT_TELEMETRY_DISABLED=1`. `EXPOSE 3000`. `CMD ["node", "server.js"]`. Add a `HEALTHCHECK` hitting `/api/health` using `node -e` (no curl in slim images).

Also: `.dockerignore` (node_modules, .next, e2e, tests, docs, .git, reports), OCI labels with build id and commit SHA, and confirm image optimisation (`sharp`) works in the final image.

### Azure Web App for Containers (document in `docs/deployment-azure.md`)

- App settings: `WEBSITES_PORT=3000`, `WEBSITES_ENABLE_APP_SERVICE_STORAGE=false`, Always On, HTTPS Only, ARR affinity **off** (the app is stateless).
- Health check path: `/api/health`. It must not call the backend.
- Runtime env vars come from `.env.example`. Secrets use **Key Vault references**.
- Scale-out note: Next.js caches are per-instance by default. Describe, do not build, a shared cache handler.
- Deploy to a staging slot, then swap to production.

### Compose for E2E and a11y (`docker-compose.e2e.yml`)

- `web`: the **image under test**, passed as `WEB_IMAGE`, with `API_BASE_URL=http://mock-api:<port>`.
- `mock-api`: runs `e2e/mock-api/server.ts` (for example a Node image that mounts the repo and runs it with `tsx`).
- Healthchecks on both so `docker compose up --wait` blocks until ready.
- Acceptable alternative if simpler and robust: run the mock API as a host process and start `web` with `--add-host=host.docker.internal:host-gateway`. In both cases the container under test **must be the production image**.

## A8. Azure DevOps pipeline

Files: `pipelines/azure-pipelines.yml` plus step templates in `pipelines/templates/`. Verify each task's current version and inputs against the Microsoft docs. Likely tasks: `NodeTool@0`, `Cache@2`, `Docker@2`, `PublishTestResults@2`, `PublishCodeCoverageResults@2`, `PublishPipelineArtifact@1`, `AzureWebAppContainer@1`, `AzureAppServiceManage@0`.

**Important:** the repo is in **Azure Repos Git**, where the YAML `pr:` trigger is ignored. PR validation is a **branch policy (Build validation)** on `main`. Use `trigger:` for CI on `main`, and make deploy stages conditional on `ne(variables['Build.Reason'], 'PullRequest')`. Document the branch policy setup in `docs/deployment-azure.md`.

| Stage | Runs on | What it does | Outputs |
|---|---|---|---|
| **Validate** | PR + main | Node setup, pnpm install (cached by lockfile hash), format check, ESLint, `tsc`, `api:types` drift check, unit + component + integration with coverage | JUnit results, Cobertura coverage |
| **Build** | PR + main | `docker build`, push to ACR tagged `$(Build.BuildId)` and commit SHA | image in ACR |
| **E2E** | after Build | `playwright install --with-deps chromium`, start the compose stack with the built image, run Playwright, tear down (always) | JUnit, `playwright-report` and traces as pipeline artifacts (always, even on failure) |
| **Accessibility** | after Build, parallel to E2E | start the same stack, run `a11y:ci` | `a11y.json` artifact |
| **Deploy_Staging** | main only | `AzureWebAppContainer@1` to the staging slot or app, wait for health, run the `@smoke` Playwright subset against the staging URL | smoke report |
| **Deploy_Production** | main only, after staging, gated by pipeline parameter `deployToProduction` (default `false`) | Azure DevOps **environment with approval check**, slot swap | |

Use `deployment` jobs tied to Azure DevOps **environments**. Parameterise service connections and app names with the placeholders, and keep them in variable groups. Never hard-code a secret. Add `.azuredevops/pull_request_template.md` with a short checklist (tests added, accessibility considered, docs updated).

## A9. Tooling and quality

- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, path alias `@/*` to `src/*`. `e2e/tsconfig.json` extends the root. The `typecheck` script covers both.
- **ESLint:** flat config with `eslint-config-next` (includes the jsx-a11y rules), `eslint-plugin-testing-library`, and the import-boundary rules from A3. No `any` without a justifying comment.
- **Prettier** with the Tailwind class-sorting plugin.
- **Git hygiene:** `.gitattributes` (`* text=auto eol=lf`), `.editorconfig`, `.npmrc` (`engine-strict=true`), Husky pre-commit running `lint-staged` (the `prepare` script must tolerate `HUSKY=0`).
- **`.env.example`** lists every variable with a comment and a safe local value.
- **Fonts** via `next/font` (self-hosted, no runtime requests to Google).
- **shadcn/ui:** initialise with the current CLI (`src` directory, CSS variables, neutral base colour). Components go in `src/components/ui` and are treated as vendored code: no business logic inside, no tests for them. Install only what is used.

### Scripts (`package.json`)

`dev`, `build`, `start`, `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `test:unit`, `test:component`, `test:int`, `test:cov`, `test:e2e`, `test:e2e:ui`, `a11y`, `a11y:ci`, `api:types`, `api:types:pull`, `mock-api`, `docker:build`, `docker:run`, `e2e:stack:up`, `e2e:stack:down`, `verify` (format check, lint, typecheck, all tests, build).

## A10. Documentation and non-goals

**Docs to produce** (keep each short and accurate to what was built):

- `README.md`: prerequisites, quick start, scripts, structure overview, how to run each test layer, how to run the container locally.
- `docs/architecture.md`: layering and import rules, where each kind of code goes (including folders not created yet, such as `src/hooks` or `src/components/layout`), the server/client boundary, the API conventions from A4, how to add a feature (short checklist), how to add client-side reads later (a GET-only allow-listed proxy route that attaches the token server-side, with writes staying as Server Actions).
- `docs/testing.md`: what each layer is for, where tests live, how the shared mock handlers work, why E2E needs a mock API server, how to debug a failed Playwright run from pipeline artifacts.
- `docs/deployment-azure.md`: Web App settings, Key Vault references, health check, slot swap, branch policy, service connections and variable groups.
- `docs/decisions.md`: every choice made where this spec was silent, plus installed versions.

**Non-goals (do not build):** i18n, Storybook, dark mode, forms and form libraries, TanStack Query or a client-side fetching layer, any backend or database code, infrastructure-as-code, Application Insights or OpenTelemetry (a documented `instrumentation.ts` hook point at most), a nonce-based CSP, React Compiler.

---

# Version 1: Hello world

**Purpose:** prove that the file structure, tooling, all four test layers, the Docker image, and the Azure DevOps pipeline work together, locally and on Azure, with the smallest possible feature.

## V1.1 Behaviour

- Route `/` is a **Server Component** page. On every request it fetches `GET {API_BASE_URL}/greeting` and renders the returned message inside an **`<h1>`**. With the mock API the text is exactly `hello world` (lowercase, no CSS text transform).
- If the backend call fails, `error.tsx` renders an accessible error state (`role="alert"`, plain-language message, a retry button that calls `reset`). Do not leak internal error details to the page.
- `/api/health` returns `200 {"status":"ok"}` and makes no backend call.
- No authentication in this version. The page and the `/greeting` call are public.

**Contract (assumption to confirm with the backend owner):** `GET /greeting` returns `200 {"message": "<string>"}`. `API_BASE_URL` may include any path prefix (for example `https://host/api`), and the client appends `/greeting`. `mappers.ts` is the single place to change if the real response shape differs. Hand-write this contract into `openapi/openapi.json`.

## V1.2 Repository layout

```text
<project-name>/
├─ .azuredevops/pull_request_template.md
├─ pipelines/
│  ├─ azure-pipelines.yml
│  └─ templates/                    # setup-node-pnpm.yml, e2e-stack.yml, deploy-webapp.yml
├─ docs/                            # architecture.md, testing.md, deployment-azure.md, decisions.md
├─ e2e/                             # Playwright, outside src/, own tsconfig
│  ├─ pages/hello.page.ts
│  ├─ tests/hello.spec.ts           # includes @smoke
│  ├─ tests/health.spec.ts          # @smoke
│  ├─ mock-api/server.ts            # test fake only
│  └─ tsconfig.json
├─ openapi/openapi.json             # hand-written: GET /greeting
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                 # html lang, font, skip link, <main id="main">
│  │  ├─ page.tsx                   # hello world page (thin)
│  │  ├─ error.tsx  global-error.tsx  not-found.tsx
│  │  ├─ globals.css
│  │  └─ api/health/route.ts
│  ├─ features/greeting/
│  │  ├─ components/
│  │  │  ├─ greeting-heading.tsx    # renders the <h1>
│  │  │  └─ greeting-heading.test.tsx
│  │  ├─ api/
│  │  │  ├─ queries.ts              # getGreeting() (server-only)
│  │  │  ├─ queries.test.ts         # unit: mapping + failures with a stubbed client
│  │  │  └─ mappers.ts (+ mappers.test.ts)
│  │  ├─ types.ts
│  │  └─ index.ts
│  ├─ components/ui/                # shadcn: only what is used (button)
│  ├─ components/error-view.tsx (+ test)   # shared by error.tsx
│  └─ lib/
│     ├─ api/
│     │  ├─ generated/schema.d.ts
│     │  ├─ client.ts
│     │  ├─ server.ts
│     │  └─ errors.ts (+ errors.test.ts)
│     ├─ env.server.ts (+ test)
│     └─ utils.ts                   # shadcn cn()
├─ tests/
│  ├─ setup/vitest.setup.ts
│  ├─ mocks/handlers.ts             # GET /greeting
│  ├─ mocks/server.ts
│  └─ integration/greeting.int.test.tsx
├─ .env.example  .editorconfig  .gitattributes  .gitignore  .npmrc  .nvmrc  .prettierrc
├─ .pa11yci.js
├─ components.json
├─ docker-compose.e2e.yml
├─ Dockerfile  .dockerignore
├─ eslint.config.mjs  next.config.ts  playwright.config.ts  postcss.config.mjs
├─ tsconfig.json  vitest.config.ts
├─ package.json  pnpm-lock.yaml
└─ README.md
```

`.env.example` for Version 1 contains `API_BASE_URL` and `OPENAPI_URL`.

## V1.3 Tests to write

| Layer | Tests |
|---|---|
| **Unit** | `mappers`: valid payload maps to the UI model; missing or non-string `message` throws a clear error. `errors`: a `ProblemDetails` body and a bare HTTP status both become an `ApiError` with status and title; network failure becomes an `ApiError` too. `env.server`: throws a clear message on first access when `API_BASE_URL` is missing or not a URL, and importing the module alone does not throw. `queries`: with a stubbed client, success maps and failure throws `ApiError`. |
| **Component** | `GreetingHeading`: renders a heading of level 1 whose accessible name is the message. `ErrorView`: has `role="alert"`, shows the generic message, never shows the raw error, and clicking retry calls the supplied `reset` once. |
| **Integration** | `greeting.int.test.tsx` with MSW: (1) `200 {message:"hello world"}` then `getGreeting()` then render `GreetingHeading`, expect `h1` "hello world". (2) The request goes to `${API_BASE_URL}/greeting` and carries an `X-Correlation-Id`. (3) `500 application/problem+json` makes `getGreeting()` reject with an `ApiError`. (4) A network error makes it reject with an `ApiError`. |
| **E2E** | `hello.spec.ts`: open `/`, expect a level-1 heading named `hello world`, a correct document title, and no console errors. Tag `@smoke`. `health.spec.ts`: `/api/health` is 200 with the expected body, and security headers are present. Tag `@smoke`. |
| **Accessibility** | `.pa11yci.js` checks `/`. |

The `@smoke` greeting assertion reads its expected text from `SMOKE_EXPECTED_GREETING` (default `hello world`) so it still works against a real backend that returns different text.

## V1.4 Pipeline behaviour for Version 1

Use the stages from A8. For Version 1:

- E2E and Accessibility run against the built image plus the mock API.
- **Deploy_Staging** sets `API_BASE_URL` on the Web App to a reachable backend that implements `GET /greeting` (the owner supplies the URL), then runs the `@smoke` tests against the staging URL. A green smoke run is what proves the whole chain works on Azure.
- `deployToProduction` stays `false` by default.

## V1.5 Build order

1. Scaffold the Next.js app (pnpm, TypeScript strict, Tailwind v4). Add ESLint, Prettier, and the root config files.
2. Initialise shadcn, add `button`. Root layout with the accessibility baseline.
3. `env.server.ts`, security headers, `/api/health`.
4. OpenAPI snapshot, generated types, `client.ts`, `server.ts`, `errors.ts`.
5. `features/greeting` and the page, `error.tsx`, `global-error.tsx`, `not-found.tsx`.
6. Vitest projects, shared test infrastructure, all unit, component, and integration tests. Get `pnpm test` green.
7. Mock API reusing the MSW handlers, Playwright config, page object, specs.
8. pa11y-ci config.
9. Dockerfile, `.dockerignore`, `docker-compose.e2e.yml`. Verify the image runs and E2E plus a11y pass against it.
10. Azure DevOps pipeline, templates, PR template.
11. Documentation. Run the Definition of done one last time.

## V1.6 Definition of done

The agent verifies, from a clean checkout after `pnpm install --frozen-lockfile`:

- [ ] `pnpm verify` passes (format check, lint, typecheck, unit, component, integration, production build)
- [ ] `pnpm api:types` produces no git diff
- [ ] `docker build` succeeds; the container starts with only runtime env vars; `/api/health` returns 200; static assets and `public/` files are served; the process is non-root
- [ ] `pnpm e2e:stack:up`, `pnpm test:e2e`, and `pnpm a11y:ci` pass against the production image and the mock API
- [ ] Pipeline YAML is syntactically valid, uses current task versions, and every placeholder is documented
- [ ] All five docs exist and match what was built
- [ ] The final message lists what was built, what could not be verified, every `TODO(owner)`, and the key entries from `docs/decisions.md`

The **owner** verifies after the first real pipeline run (the agent cannot run Azure DevOps):

- [ ] All stages through **Deploy_Staging** are green
- [ ] The staging URL shows an `h1` with the greeting from the real backend
- [ ] The Web App health check reports healthy

---

# Version 2: Entra ID sign-in

**Build only when asked.** Version 2 starts from a working Version 1.

**Purpose:** a minimal login page and Microsoft Entra ID authentication. After signing in, the user lands on the hello world page. Tokens stay on the server, and the backend call now carries the user's access token.

## V2.1 Behaviour

- **`/login`** (public): an `<h1>` with the text `login` and a button whose accessible name is `Login`. Pressing it starts the Microsoft sign-in. If the URL has `?error=...`, show a generic `role="alert"` message. Map the error to fixed text and never echo raw query text. If the user is already signed in, redirect to `/`.
- **`/`** (protected): the hello world page from Version 1, now only for signed-in users. The header shows the signed-in user's name and a `Sign out` button. Signing out clears the session and goes to `/login`.
- **Unauthenticated access** to any page other than `/login`, `/api/auth/callback`, and `/api/health` redirects to `/login`.
- **After sign-in** the user lands on `/` (or the originally requested path, if it passes validation).
- `getGreeting()` now sends `Authorization: Bearer <access token>` to the backend.

## V2.2 Authentication design (MUST)

The Next.js app is a **confidential client**: the browser flow uses the **authorization code flow with PKCE**, and the server exchanges the code using a **client secret**. The server is the only party that ever holds tokens.

1. **Library:** `openid-client` (maintained, OIDC-certified) for discovery, authorization URL, code exchange, and refresh, plus `jose` for the encrypted session cookie. Reason: tokens are stored in this app's own session cookie so the app stays stateless behind Web App scale-out, and MSAL Node keeps tokens in its own cache that needs a persistence plugin for that. You may choose a different standards-based library, but record the reason in `docs/decisions.md`. Only `src/lib/auth/oidc.ts` may talk to Entra ID.
2. **Authority:** `https://login.microsoftonline.com/<tenant-id>/v2.0` (single-tenant). Scopes: `openid profile offline_access <entra-api-scope>`.
3. **Redirect URI:** `${APP_BASE_URL}/api/auth/callback`. **Build it from `APP_BASE_URL`**, never from request headers (the app sits behind the Azure front end).
4. **Login:** the `Login` button submits a Server Action (`features/auth/actions.ts`, `signIn`). It generates `state`, `nonce`, and a PKCE verifier, stores them with the validated `next` path in a short-lived (10 minute) encrypted HttpOnly cookie, and redirects to Entra. That cookie must be `SameSite=Lax`, not `Strict`, because the callback arrives as a cross-site top-level redirect.
5. **Callback:** Route Handler `src/app/api/auth/callback/route.ts`. It validates `state`, exchanges the code (client secret and PKCE verifier), validates the ID token (issuer, audience, nonce, signature, through the library), creates the session, clears the transaction cookie, and redirects. On any failure or on an `error` parameter from Entra, redirect to `/login?error=<fixed code>`.
6. **Session:** an encrypted cookie (JWE via `jose`) holding the access token, refresh token, expiry, and minimal user claims (`oid`, `name`, `preferred_username`). Do not store the ID token. Key from `SESSION_SECRET` (at least 32 bytes). Flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` **when `APP_BASE_URL` is https** (use the `__Host-` name prefix when secure). Absolute session lifetime of 8 hours, as a constant in config.
7. **Cookie size:** Entra tokens plus JWE overhead can exceed the 4 KB cookie limit. `session.ts` must **split the session across numbered cookies** when needed and reassemble them on read. Cover this with a unit test, and log a warning when the total approaches the browser limit.
8. **Cookie writes are only possible in Server Actions, Route Handlers, and `proxy.ts`, never in Server Components.** So `src/proxy.ts` (Next 16's replacement for `middleware.ts`):
   - redirects unauthenticated users to `/login`, with a validated `next` stored for after sign-in (same-origin relative paths only, to prevent open redirects);
   - **refreshes the access token** with the refresh token when it is about to expire, and sets the updated cookie on both the forwarded request and the response so the same render sees it;
   - clears the session and redirects to `/login` if refresh fails.
   Its matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `/api/health`, and `/api/auth/callback`. Note the rotating-refresh-token race (concurrent requests) as a known limitation in `docs/architecture.md`.
9. **Sign out:** a Server Action that clears the session cookies and redirects to `/login`. Redirecting to Entra's `end_session_endpoint` is a follow-up, not required.
10. **API calls:** `lib/api/server.ts` reads the session and passes the bearer token to the client middleware. A 401 from the backend that the proxy refresh did not prevent clears the session and redirects to `/login`.
11. **Secrets:** `ENTRA_CLIENT_SECRET` and `SESSION_SECRET` come from Key Vault references in Azure. Secrets expire; note in `docs/entra-setup.md` that a certificate or federated credential is the better long-term option.

## V2.3 Changes to the repository

Add (Version 1 files stay as they are unless noted):

```text
src/
├─ app/
│  ├─ login/page.tsx                  # h1 "login" + Login button (thin)
│  ├─ api/auth/callback/route.ts
│  └─ page.tsx                        # modified: header with user name + Sign out
├─ features/auth/
│  ├─ components/
│  │  ├─ login-form.tsx (+ test)      # the button; shows error alert
│  │  └─ user-menu.tsx (+ test)       # name + Sign out
│  ├─ actions.ts                      # "use server": signIn, signOut
│  └─ index.ts
├─ lib/auth/
│  ├─ oidc.ts (+ test)                # the only code that talks to Entra
│  ├─ session.ts (+ test)             # encrypt, chunk, read, write, expiry
│  ├─ safe-redirect.ts (+ test)       # validates `next`
│  └─ types.ts
└─ proxy.ts (+ test)
e2e/
├─ mock-api/oidc.ts                   # fake Entra (see V2.5)
├─ setup/auth.setup.ts                # signs in through the UI, saves storageState
├─ pages/login.page.ts
└─ tests/auth.spec.ts
docs/entra-setup.md
```

Modify: `lib/api/server.ts` (bearer token), `tests/mocks/handlers.ts` (stub the Entra token endpoint for integration tests, and a `/greeting` variant that requires a bearer token), `.env.example`, `docker-compose.e2e.yml`, `.pa11yci.js`, pipeline files.

New dependencies: `openid-client`, `jose`. shadcn: nothing new required.

## V2.4 Environment variables

| Variable | Purpose |
|---|---|
| `APP_BASE_URL` | Public origin of the app, used for the redirect URI and the cookie `Secure` decision |
| `ENTRA_TENANT_ID` | Tenant (used to build the authority) |
| `ENTRA_CLIENT_ID` | App registration client id |
| `ENTRA_CLIENT_SECRET` | Client secret (Key Vault reference in Azure) |
| `ENTRA_API_SCOPE` | Scope of the backend API |
| `SESSION_SECRET` | At least 32 bytes (Key Vault reference in Azure) |
| `ENTRA_AUTHORITY` | Optional override of the authority, **for tests only** (points at the mock IdP) |
| `AUTH_ALLOW_INSECURE_AUTHORITY` | `true` allows an `http` authority, **for tests only** |

**Guard:** `ENTRA_AUTHORITY` and `AUTH_ALLOW_INSECURE_AUTHORITY` are explicit opt-ins. The app logs a loud warning at startup when either is set. The deploy pipeline must never set them. Say so in `docs/deployment-azure.md`.

`docs/entra-setup.md` (short, step by step): register a single-tenant web app; add redirect URIs for local, staging, and production (`.../api/auth/callback`); create a client secret and store it in Key Vault; expose or consume the backend API scope and grant consent; make sure tokens are v2 (`accessTokenAcceptedVersion`); and record the values for the variables above.

## V2.5 Testing authentication

Real Microsoft sign-in cannot run in CI. Do **not** bypass the auth code with a fake provider object. Instead run the **real redirect, callback, and cookie code against a fake Entra**:

- `e2e/mock-api/oidc.ts` implements a minimal OIDC provider under a mock tenant path, using `jose` to sign tokens with an RS256 key generated at startup: discovery document, JWKS, `/authorize` (auto-approves with no UI and redirects back with `code` and `state`, remembering the nonce and PKCE challenge), and `/token` (verifies client secret and PKCE, returns access, refresh, and ID tokens; also supports the refresh grant). Token lifetime is configurable by env so refresh can be exercised.
- With `MOCK_REQUIRE_AUTH=true`, the mock `/greeting` returns `401 ProblemDetails` unless the bearer token was issued by this mock IdP. This proves the token is forwarded.
- The app is started with `ENTRA_AUTHORITY` pointing at the mock and `AUTH_ALLOW_INSECURE_AUTHORITY=true`.
- **Browser reachability gotcha:** inside compose the issuer host is `mock-api`, which the host-side browser cannot resolve. Publish the mock port and map the name in the browser: `--host-resolver-rules=MAP mock-api 127.0.0.1` in Playwright `launchOptions.args` and in pa11y's `chromeLaunchConfig.args`. (An `/etc/hosts` entry on the pipeline agent is an acceptable alternative.) For the local host-process run, use `localhost` and none of this is needed.
- `APP_BASE_URL=http://localhost:3000` in these runs, so cookies are not `Secure`.

| Layer | Tests |
|---|---|
| **Unit** | `session`: encrypt and decrypt round trip, tampered cookie rejected, wrong key rejected, chunking and reassembly, expiry logic (fake timers). `safe-redirect`: accepts relative paths, rejects absolute URLs, `//host`, and backslash tricks. `oidc`: builds the authorization URL with PKCE, state, nonce, and the right scopes and redirect URI. `proxy` decisions: public path, no session, valid session, near-expiry triggers refresh, failed refresh clears the session. |
| **Component** | `LoginForm`: the `Login` button is present, and the error alert renders for a known error code with fixed text only (never the raw query value). `UserMenu`: shows the name, `Sign out` calls the action. |
| **Integration** | With MSW: authorization code exchange produces a session; refresh with a valid refresh token updates it; refresh failure clears it; `getGreeting()` sends the bearer token; a backend 401 clears the session. |
| **E2E** | `auth.setup.ts` signs in through the UI. `auth.spec.ts`: unauthenticated `/` redirects to `/login`; `/login` shows an `h1` named `login` and a `Login` button; clicking it ends on `/` with an `h1` `hello world` and the user name in the header; `Sign out` returns to `/login` and `/` redirects again; a request with a tampered `next` does not leave the origin. |
| **Accessibility** | pa11y checks `/login`, and `/` reached by pressing the `Login` button through pa11y `actions` (click, then wait for the `h1`). |

**Cloud smoke for Version 2:** interactive Entra sign-in cannot be automated in the pipeline. The `@smoke` set on staging checks that `/login` renders `h1` `login`, that `/` redirects to `/login` when unauthenticated, and that `/api/health` is 200. The owner signs in manually once per environment after deploy.

## V2.6 Pipeline changes

- Compose file: add `mock-api` port publishing, `MOCK_REQUIRE_AUTH=true`, and the test-only auth variables on `web`.
- Deploy stages: add the Entra variables as app settings, secrets as Key Vault references. Smoke tests use the Version 2 set above.
- Add an optional pipeline check that fails if the staging or production app settings contain `ENTRA_AUTHORITY` or `AUTH_ALLOW_INSECURE_AUTHORITY`.

## V2.7 Build order

1. Add dependencies, env schema additions, `safe-redirect`, `session` (with chunking) and their unit tests.
2. `oidc.ts`, `signIn` and `signOut` actions, the callback route handler.
3. `proxy.ts` with refresh, then update `lib/api/server.ts` to send the bearer token.
4. Login page, `LoginForm`, `UserMenu`, and the modified home page header.
5. Component and integration tests. Get `pnpm test` green.
6. Mock IdP, `MOCK_REQUIRE_AUTH`, compose changes, Playwright auth setup and specs.
7. pa11y updates.
8. Pipeline and docs (`docs/entra-setup.md`, updates to the other docs). Run the Definition of done.

## V2.8 Definition of done

The agent verifies:

- [ ] Everything in V1.6 still passes
- [ ] The full sign-in flow works locally against the mock IdP: `/` redirects to `/login`, `Login` leads to `/` showing `hello world` and the user name, `Sign out` returns to `/login`
- [ ] The backend request carries the bearer token (the mock `/greeting` with `MOCK_REQUIRE_AUTH=true` returns 200 only then)
- [ ] The session is chunked correctly for oversized token sets (unit test) and the session cookies are `HttpOnly`
- [ ] No tokens or the client secret appear in HTML, client bundles, logs, or any response body
- [ ] Image builds and runs with the real-Entra env vars only (no test-only auth variables set)
- [ ] The final message lists what could not be verified (notably a real Entra sign-in) and every `TODO(owner)`

The **owner** verifies after the first pipeline run: configure the Entra app registration per `docs/entra-setup.md`, then sign in manually on staging and confirm the greeting from the real backend appears.
