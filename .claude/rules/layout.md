# Layout

Where code goes and what may import what. Details: `docs/architecture.md`.

| Path                   | Holds                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`             | Routes only: thin pages that compose features. Pages sharing a shell (sidebar, topbar) sit in a route group, e.g. `src/app/(dashboard)/` with its own `layout.tsx`.    |
| `src/features/<name>/` | One data domain: `api/queries.ts` (reads), `api/actions.ts` (writes), `api/mappers.ts` (zod schema + mapping), `components/`, `types.ts`, `index.ts` (public surface). |
| `src/components/`      | Shared components; data comes in as props, never fetched. `layout/` holds the app shell.                                                                               |
| `src/components/ui/`   | shadcn/ui, vendored: add with `yarn dlx shadcn@latest add <name>`; no logic, no tests.                                                                                 |
| `src/hooks/`           | Shared client hooks.                                                                                                                                                   |
| `src/lib/`             | Plumbing: `env.server.ts` (runtime config), `api/` (backend client, `ApiError`), `utils.ts`.                                                                           |
| `tests/`               | Vitest setup, MSW handlers, test utilities, integration tests.                                                                                                         |
| `e2e/`                 | Playwright specs and page objects.                                                                                                                                     |

Never edit generated output: `.next/`, `dist/`, `coverage/`, `reports/`,
`playwright-report/`, `test-results/`.

## Imports (ESLint enforces these)

- Cross-folder imports use `@/`; `../` is not allowed in `src/`.
- Use a feature only through `@/features/<name>`. Inside a feature,
  `@/features/<same-name>/...` is fine.
- `src/components/ui/` never imports `@/features/*` or `@/lib/api`.
- `src/lib/` never imports `@/features/*` or `@/components/*`.
- Every imported package is declared in `package.json`; app code never imports devDependencies.

## Server and client

- Files that touch the backend, secrets or the session start with `import "server-only"`.
- `"use client"` only where interactivity needs it, as low in the tree as possible.
- Group features by data domain, not by page; a page composes several features.
