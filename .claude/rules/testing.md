# Testing

Details: `docs/testing.md`.

| Layer         | Files                                      | Runs in       | Backend                               |
| ------------- | ------------------------------------------ | ------------- | ------------------------------------- |
| Unit          | `src/**/*.test.ts`, next to the code       | Vitest, node  | none; stub with `vi.fn()` / `vi.mock` |
| Component     | `src/**/*.test.tsx`, next to the component | Vitest, jsdom | none                                  |
| Integration   | `tests/integration/**/*.int.test.{ts,tsx}` | Vitest, jsdom | MSW fake                              |
| E2E           | `e2e/tests/*.spec.ts`                      | Playwright    | real                                  |
| Accessibility | URLs in `.pa11yci.js`                      | pa11y-ci      | real                                  |

The file extension picks the environment: `.test.ts` runs in node, `.test.tsx` in jsdom.

## Vitest

- Import `describe`, `it`, `expect` and `vi` from `vitest`; globals are off.
- Find elements by role or label (`getByRole`) and interact with `userEvent`.
  Don't use CSS selectors.
- The fake backend's happy-path handlers and fixtures live in
  `tests/mocks/handlers.ts`; copy fixtures from real responses.
- Cover every UI state with `server.use(...)` inside the test: success, empty,
  error, and network failure (`HttpResponse.error()`). Unhandled requests fail.
- A query's unit test stubs the client with `vi.mock("@/lib/api/server")`.
  Integration tests mock `next/headers` and `next/server` with the helpers in
  `tests/utils/`.
- Async server components aren't rendered in Vitest. Unit-test their logic as
  plain functions; E2E covers the component.

## Playwright

- Always runs against a real backend. Either set `API_BASE_URL` in
  `.env.local` (Playwright builds and starts the app), or set
  `PLAYWRIGHT_BASE_URL` to test a deployed site.
- Never assume backend data; read exact expected values from environment variables.
- Use page objects in `e2e/pages/` with role or label locators.
- Tag read-only tests `@smoke`; only those run against production. Tests that
  write create and clean up their own data.

## Commands

```sh
pnpm test                                         # all Vitest layers
pnpm test <file-filter>                           # matching files only
pnpm exec vitest run <file> -t "<test name>"      # one test
pnpm exec vitest                                  # watch mode
pnpm test:cov                                     # coverage: 80% lines/functions/statements, 75% branches
pnpm test:e2e
pnpm exec playwright test <file> -g "<test name>"
pnpm a11y
```
