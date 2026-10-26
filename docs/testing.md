# Testing

New to testing? [dummy-guide.md](dummy-guide.md) explains the ideas and
walks through each test in this repo. This page is the reference.

## Layers

| Layer         | Purpose                                                                             | Location                                   | Runs in              | Backend                             |
| ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ | -------------------- | ----------------------------------- |
| Unit          | Pure logic: mappers, error handling, env validation, the API client                 | `src/**/*.test.ts`                         | Vitest, node         | none, or a stubbed `fetch` / client |
| Component     | One component's rendering and interaction                                           | `src/**/*.test.tsx`, next to the component | Vitest, jsdom        | none                                |
| Integration   | Real query function, real API client and real component together, in every UI state | `tests/integration/**/*.int.test.{ts,tsx}` | Vitest, jsdom        | **fake**, through MSW               |
| E2E           | The built app in a real browser                                                     | `e2e/tests/*.spec.ts`                      | Playwright, Chromium | **real**                            |
| Accessibility | WCAG 2 AA with axe and HTML_CodeSniffer                                             | `.pa11yci.js`                              | pa11y-ci, Chromium   | **real**                            |

Each Vitest layer is a `projects` entry in `vitest.config.mts`, with its own
environment and include pattern: `pnpm test:unit`, `pnpm test:component`,
`pnpm test:int`, or `pnpm test` for all three.

Async Server Components (such as the greeting in `src/app/page.tsx`) are not
rendered in Vitest; Playwright covers them. Keep their logic in plain
functions that Vitest can test.

## Fake backend for Vitest, real backend for E2E

- **Vitest uses a fake backend** (`tests/mocks/handlers.ts`, served by MSW).
  It is fast and predictable, and it can put the UI into states a real backend
  can't produce on demand: errors, empty lists, slow responses. Integration
  tests are where every UI state gets covered.
- **E2E and pa11y use a real backend**, so they prove the frontend and backend
  actually fit together. There is no fake backend for E2E.

### Adding a UI state with MSW

The default handlers return the happy path. To test another state, override a
handler for one test with `server.use(...)`; it is reset after each test.

```ts
server.use(
  http.get("*/greeting", () =>
    HttpResponse.json(
      { title: "Internal Server Error", status: 500 },
      { status: 500 },
    ),
  ),
);
```

Use `HttpResponse.error()` for a network failure and `delay()` from `msw` for a
slow response. Copy fixtures (sample JSON) from real backend responses, and
refresh them when the backend changes, so the fake does not drift.

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

## E2E

The greeting is fetched by the Next.js server, not the browser, so a browser
test cannot intercept that call. The server under test must be configured
with `API_BASE_URL` pointing at a reachable backend.

| Where                             | What runs                                     | App under test                                                                            | Backend                                                 |
| --------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Your machine                      | `pnpm test:e2e`                               | built and started by Playwright (`pnpm build && pnpm start`), or one already on port 3000 | your backend container (`API_BASE_URL` in `.env.local`) |
| PR and `main` pipeline, E2E stage | full suite                                    | the packaged `dist/app`, run on the agent                                                 | staging backend (`stagingApiBaseUrl`)                   |
| After deploy to staging           | full suite                                    | the staging slot                                                                          | staging backend                                         |
| After swap to production          | `@smoke` only                                 | production                                                                                | production backend                                      |
| Nightly                           | full suite on staging, `@smoke` on production | the deployed slots                                                                        | their backends                                          |

To test any deployed app from your machine, set `PLAYWRIGHT_BASE_URL`:
`PLAYWRIGHT_BASE_URL=https://<staging-url> pnpm test:e2e`. Playwright then
starts nothing.

Rules for E2E tests, because they run against real, shared data:

- **Do not assume specific data.** The greeting's exact text is only checked
  when `E2E_EXPECTED_GREETING` is set.
- **Tag read-only tests `@smoke`.** Only those run against production.
- **Writes (from later features) need a test-data plan:** create what the test
  needs and clean it up, or use a dedicated test account. Never write in
  production.

Use page objects (`e2e/pages/`) and role or label locators; never CSS selectors.

## Accessibility

`pnpm a11y` checks the URLs in `.pa11yci.js` against `A11Y_BASE_URL` (default
`http://localhost:3000`, so start the app first). Any error fails the run.
Every entry in its `ignore` list needs a comment saying why.

## Coverage

`pnpm test:cov` writes `text`, `html`, `cobertura` and `lcov` reports to
`coverage/`, and a JUnit file to `reports/junit/vitest.xml`. `src/app`
(covered by Playwright) and `src/components/ui` (vendored) are excluded.

The thresholds are placeholders to raise as the codebase grows: **80% lines,
functions and statements; 75% branches**. The run fails below them.

## Debugging a failed Playwright run in the pipeline

1. Open the run's **Tests** tab: failures come from
   `reports/junit/playwright.xml`, with the error message and stack.
2. Download the `<stage>-report-<attempt>` artifact, unzip it, and run
   `pnpm exec playwright show-report <folder>`.
3. Download `<stage>-traces-<attempt>`. In CI each failing test is retried
   twice. The first retry records a trace (`trace.zip`), and every failure
   keeps a video. Open a trace with `pnpm exec playwright show-trace trace.zip`,
   or drop it on https://trace.playwright.dev.
4. In the E2E and Accessibility stages, **Stop the app and print its log**
   shows the server's output, including errors from backend calls.
5. If a test fails only in the pipeline, check whether the backend is up and
   returning what the test expects. A real backend is part of what E2E tests.
