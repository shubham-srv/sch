# Testing

## Layers

| Layer         | Purpose                                                                             | Location                                   | Runs in              | Backend                             |
| ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ | -------------------- | ----------------------------------- |
| Unit          | Pure logic: mappers, error handling, env validation, the API client                 | `src/**/*.test.ts`, next to the code       | Vitest, node         | none, or a stubbed `fetch` / client |
| Component     | One component's rendering and interaction                                           | `src/**/*.test.tsx`, next to the component | Vitest, jsdom        | none                                |
| Integration   | Real query function, real API client and real component together, in every UI state | `tests/integration/**/*.int.test.{ts,tsx}` | Vitest, jsdom        | **fake**, through MSW               |
| E2E           | The built app in a real browser                                                     | `e2e/tests/*.spec.ts`                      | Playwright, Chromium | **real**, and real Entra ID sign-in |
| Accessibility | WCAG 2 AA with axe and HTML_CodeSniffer                                             | `.pa11yci.js`                              | pa11y-ci, Chromium   | **real**, and real Entra ID sign-in |

Each Vitest layer is a `projects` entry in `vitest.config.mts`, with its own
environment and include pattern: `yarn test:unit`, `yarn test:component`,
`yarn test:int`, or `yarn test` for all three. The file extension decides the
environment: `.test.ts` runs in node, `.test.tsx` in jsdom.

Async Server Components are not rendered in Vitest; Playwright covers them.
Keep their logic in plain functions that Vitest can test.

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
  http.get("*/orders", () =>
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
- `tests/utils/next-headers.ts`, `tests/utils/next-server.ts` and
  `tests/utils/next-navigation.ts`: mocks for `next/headers` (`headers()`,
  `cookies()`), `next/server` (`connection()`) and `next/navigation`
  (`redirect()`, which throws a `RedirectError` carrying the URL). Use them
  with `vi.mock("next/headers", () => import("../utils/next-headers"))`.
- `vitest.config.mts` inlines `next-auth`, so those mocks also reach the
  imports inside Auth.js.
- `tests/utils/env.ts`: `stubServerEnv()` sets every server variable for tests
  that use the real config.
- Unit tests of a query stub the client with `vi.mock("@/lib/api/server", ...)`.

### Sign-in in Vitest

- `getApiClient()` needs a session. Integration tests give the request one
  with `setRequestCookies(await signedInCookies())` (`tests/utils/session.ts`),
  an Auth.js session cookie encrypted with the test `AUTH_SECRET`.
  `setRequestCookies()` with no argument is a signed-out request.
  `readSessionCookie()` decrypts a cookie the code under test set.
- `tests/mocks/handlers.ts` also fakes Microsoft Entra ID: the tenant's
  discovery document and the token endpoint (code exchange and renewal),
  which returns `entraTokenResponse()`: Microsoft's documented response
  shape with fake tokens and an ID token signed by a key generated in the
  test run. `signInAtEntra(authorizeUrl)` stands in for Microsoft's sign-in
  page: it returns the code to bring back to the callback. Override a handler
  with `server.use(...)` for errors and network failures like any backend
  handler.
- Tests of Auth.js's route handlers and the proxy build a `NextRequest`,
  which needs Node's `Request`, so their file starts with
  `// @vitest-environment node`.

## E2E

Pages fetch backend data on the Next.js server, not in the browser, so a
browser test cannot intercept those calls. The server under test must be
configured with `API_BASE_URL` pointing at a reachable backend.

| Where                             | What runs                                     | App under test                                                                            | Backend                                                 |
| --------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Your machine                      | `yarn test:e2e`                               | built and started by Playwright (`yarn build && yarn start`), or one already on port 3000 | your backend container (`API_BASE_URL` in `.env.local`) |
| PR and `main` pipeline, E2E stage | full suite                                    | the packaged `dist/app`, run on the agent                                                 | staging backend (`stagingApiBaseUrl`)                   |
| After deploy to staging           | full suite                                    | the staging slot                                                                          | staging backend                                         |
| After swap to production          | `@smoke` only                                 | production                                                                                | production backend                                      |
| Nightly                           | full suite on staging, `@smoke` on production | the deployed slots                                                                        | their backends                                          |

To test any deployed app from your machine, set `PLAYWRIGHT_BASE_URL`:
`PLAYWRIGHT_BASE_URL=https://<staging-url> yarn test:e2e`. Playwright then
starts nothing. It must be the app's `AUTH_URL` exactly: sign-in returns
there, and the cookies belong to that host.

### Signing in

Every page needs a signed-in user, and E2E signs in through the real
Microsoft sign-in, since a fake identity provider would not prove the app
works with Entra ID.

- The `setup` project (`e2e/tests/auth.setup.ts`) signs in once with the test
  account in `E2E_USERNAME` and `E2E_PASSWORD` and saves the browser state to
  `e2e/.auth/user.json` (gitignored). Every other test starts from it.
- The test account must be allowed to sign in (a member of an assigned group)
  without MFA, from wherever the tests run.
- A signed-out test opts out with
  `test.use({ storageState: { cookies: [], origins: [] } })`.
- The setup test is tagged `@smoke`, because the production smoke tests need a
  signed-in user too. Signing in changes no data.
- Microsoft's sign-in screens live in `e2e/pages/microsoft-sign-in.page.ts`.
  When Microsoft changes their wording, fix the locators there.

Rules for E2E tests, because they run against real, shared data:

- **Do not assume specific data.** When a test must check an exact value, read
  it from an environment variable (for example `E2E_EXPECTED_<NAME>`) instead
  of hard-coding what one backend returns.
- **Tag read-only tests `@smoke`.** Only those run against production.
- **Tests that write need a test-data plan:** create what the test needs and
  clean it up, or use a dedicated test account. Never write in production.

Use page objects (`e2e/pages/`) and role or label locators; never CSS selectors.

## Accessibility

`yarn a11y` checks the URLs in `.pa11yci.js` against `A11Y_BASE_URL` (default
`http://localhost:3000`, so start the app first). Any error fails the run.
Every entry in its `ignore` list needs a comment saying why. Add every new
route to `.pa11yci.js`. Signed-in pages are checked only when `E2E_USERNAME`
and `E2E_PASSWORD` are set: pa11y then signs in through Microsoft's screens
with `actions` first.

## Coverage

`yarn test:cov` writes `text`, `html`, `cobertura` and `lcov` reports to
`coverage/`, and a JUnit file to `reports/junit/vitest.xml`. `src/app`
(covered by Playwright) and `src/components/ui` (vendored) are excluded.

The thresholds are **80% lines, functions and statements; 75% branches**.
The run fails below them.

## Debugging a failed Playwright run in the pipeline

1. Open the run's **Tests** tab: failures come from
   `reports/junit/playwright.xml`, with the error message and stack.
2. Download the `<stage>-report-<attempt>` artifact, unzip it, and run
   `yarn playwright show-report <folder>`.
3. Download `<stage>-traces-<attempt>`. In CI each failing test is retried
   twice. The first retry records a trace (`trace.zip`), and every failure
   keeps a video. Open a trace with `yarn playwright show-trace trace.zip`,
   or drop it on https://trace.playwright.dev.
4. In the E2E and Accessibility stages, **Stop the app and print its log**
   shows the server's output, including errors from backend calls.
5. If a test fails only in the pipeline, check whether the backend is up and
   returning what the test expects. A real backend is part of what E2E tests.
