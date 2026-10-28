# Code review

Use this for every review: a PR, a diff, or your own work before finishing.
Report findings as `file:line`, most severe first. Don't comment on anything
Prettier or ESLint already enforce.

Gate: `yarn verify` passes (format, lint, typecheck, Vitest, build).

Check:

- **Layout:** files are where `layout.md` puts them; route files stay thin; no
  feature internals are imported from outside; shared components don't fetch.
- **Server boundary:** the browser never calls the backend. Backend calls
  happen only in `queries.ts` (`server-only`) and `actions.ts` (`"use server"`,
  real actions only). No secrets, and no `NEXT_PUBLIC_*` values that differ
  per environment.
- **Data:** every backend response goes through a zod schema in `mappers.ts`.
  Actions validate input and return a result object instead of throwing for
  expected failures.
- **Rendering:** request-time data sits inside `<Suspense>`; errors reach the
  error boundary; no raw error text or internal details on the page;
  `"use client"` is minimal and low in the tree.
- **Config and dependencies:** new env vars are in `src/lib/env.server.ts` and
  `.env.example`; new packages are declared and justified; `components/ui`
  changes only through the shadcn CLI.
- **Accessibility:** one `h1` per page, semantic elements, labelled controls,
  visible focus; new routes are in `.pa11yci.js`.
- **Tests (`testing.md`):** new logic has unit tests; each UI state has an
  integration test; E2E assumes no backend data; `@smoke` is only on read-only tests.
- **Docs:** `docs/` is updated when a convention changes.
