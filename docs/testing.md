# Testing

## Layers

| Layer         | Purpose                                                                            | Location                                   | Environment          | What is fake                                   |
| ------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ | -------------------- | ---------------------------------------------- |
| Unit          | Pure logic: mappers, error handling, env validation, queries with a stubbed client | `src/**/*.test.ts`                         | Vitest, node         | nothing, or a `vi.fn()` client                 |
| Component     | One component's rendering and interaction                                          | `src/**/*.test.tsx`, next to the component | Vitest, jsdom        | no network; server code stubbed with `vi.fn()` |
| Integration   | Real query function, real API client, real component together                      | `tests/integration/**/*.int.test.{ts,tsx}` | Vitest, jsdom        | only HTTP, through MSW                         |
| E2E           | The production build in a browser                                                  | `e2e/tests/*.spec.ts`                      | Playwright, Chromium | the backend, through the mock API server       |
| Accessibility | WCAG 2 AA with axe and HTML_CodeSniffer                                            | `.pa11yci.js`                              | pa11y-ci, Chromium   | the backend, through the mock API server       |

Each Vitest layer is a `projects` entry in `vitest.config.mts`, with its own
environment and include pattern: `pnpm test:unit`, `pnpm test:component`,
`pnpm test:int`, or `pnpm test` for all three.

Async Server Components (such as the greeting in `src/app/page.tsx`) are not
rendered in Vitest; Playwright covers them. Keep their logic in plain
functions that Vitest can test.

## Shared infrastructure

- `tests/setup/vitest.setup.ts` (component and integration layers): jest-dom
  matchers, React Testing Library cleanup, and the MSW server. It uses
  `onUnhandledFrame: "error"` (MSW 3's name for `onUnhandledRequest`), so a
  request without a handler fails instead of reaching the network.
- `tests/setup/server-only.ts`: Vitest aliases `server-only` to this empty
  module, so server files can be imported in tests.
- `tests/utils/next-headers.ts` and `tests/utils/next-server.ts`: mocks for
  `next/headers` and `next/server` (`connection()`). Use them with
  `vi.mock("next/headers", () => import("../utils/next-headers"))`.

## One fake backend

`tests/mocks/handlers.ts` is the only definition of the fake backend:

- Vitest uses it through MSW's `setupServer` (`tests/mocks/server.ts`).
  Override a handler in a single test with `server.use(...)`.
- The E2E mock API (`e2e/mock-api/server.ts`) serves the same handlers over
  HTTP using MSW's `getResponse()`, so E2E and Vitest cannot drift apart.

Add new endpoints there. Handlers use `*/path` patterns, so they match whatever
base URL and path prefix the app is configured with.

## Why E2E needs a mock API server

The greeting is fetched by the Next.js server, not the browser. Playwright's
`page.route()` only intercepts browser requests, so it cannot see or fake that
call. The app is started with `API_BASE_URL` pointing at the mock API instead.

E2E runs in one of two ways:

- **Host processes:** `pnpm test:e2e` with no `PLAYWRIGHT_BASE_URL`. Playwright
  starts `pnpm mock-api` and `pnpm build && pnpm start`, or reuses them if
  already running.
- **Production image (CI):** `pnpm e2e:stack:up` starts the image under test
  (`WEB_IMAGE`, default `web:local`) and the mock API in Docker Compose. Then
  run `PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm test:e2e`.

Tests tagged `@smoke` are read-only and assume nothing mock-specific. The
pipeline runs them against staging with `--grep @smoke`. The greeting text
comes from `SMOKE_EXPECTED_GREETING` (default `hello world`).

Use page objects (`e2e/pages/`) and role or label locators; never CSS selectors.

## Coverage

`pnpm test:cov` writes `text`, `html`, `cobertura` and `lcov` reports to
`coverage/`, and a JUnit file to `reports/junit/vitest.xml`. `src/app`
(covered by Playwright), `src/components/ui` (vendored) and generated types
are excluded.

The thresholds are placeholders to raise as the codebase grows: **80% lines,
functions and statements; 75% branches**. The run fails below them.

## Debugging a failed Playwright run in the pipeline

1. Open the run's **Tests** tab: failures come from
   `reports/junit/playwright.xml`, with the error message and stack.
2. Download the `playwright-report-<attempt>` artifact, unzip it, and run
   `pnpm exec playwright show-report <folder>`.
3. Download `playwright-traces-<attempt>`. In CI each failing test is retried
   twice. The first retry records a trace (`trace.zip`), and every failure
   keeps a video. Open a trace with `pnpm exec playwright show-trace trace.zip`,
   or drop it on https://trace.playwright.dev.
4. The **Stack logs and teardown** step prints the app and mock API container
   logs; server-side errors from the app appear there.
5. Reproduce locally against the same image: `docker pull` it, then run
   `WEB_IMAGE=<acr>.azurecr.io/web:<buildId> pnpm e2e:stack:up` and
   `pnpm test:e2e --ui`.
