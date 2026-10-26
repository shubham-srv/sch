# Architecture

## Where code goes

| Folder                   | Contents                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`               | Routes only. Pages compose feature components and call feature functions; no business logic. Pages that share an app shell (sidebar, topbar) sit in a route group such as `(dashboard)/`, which has its own `layout.tsx` and adds nothing to the URL. Also `error.tsx`, `global-error.tsx`, `not-found.tsx` and route handlers such as `api/health`. |
| `src/features/<name>/`   | Everything one data domain owns: `components/`, `api/` (`queries.ts`, `actions.ts`, `mappers.ts`), `types.ts`, and `index.ts`, its public surface. Group features by data domain, not by page; a page composes several features, and several pages can reuse one.                                                                                    |
| `src/components/ui/`     | shadcn/ui components, treated as vendored code: no business logic, no tests. Add with `pnpm dlx shadcn@latest add <name>`.                                                                                                                                                                                                                           |
| `src/components/`        | Shared components used by several features or routes, such as cards and chart wrappers. They take data as props and never fetch.                                                                                                                                                                                                                     |
| `src/components/layout/` | App-shell pieces: sidebar, topbar, footer.                                                                                                                                                                                                                                                                                                           |
| `src/hooks/`             | Shared client hooks.                                                                                                                                                                                                                                                                                                                                 |
| `src/lib/`               | Framework-agnostic plumbing: `env.server.ts` (runtime config), `utils.ts` (`cn`).                                                                                                                                                                                                                                                                    |
| `src/lib/api/`           | Backend client: `client.ts`, `server.ts`, `errors.ts`.                                                                                                                                                                                                                                                                                               |
| `tests/`                 | Vitest setup, the MSW fake backend, test utilities, integration tests.                                                                                                                                                                                                                                                                               |
| `e2e/`                   | Playwright specs and page objects. Never imported by app code.                                                                                                                                                                                                                                                                                       |
| `scripts/`               | Build helpers: `package-app.mjs` assembles `dist/app`.                                                                                                                                                                                                                                                                                               |

## Import rules

ESLint enforces these (`eslint.config.mjs`):

- Inside `src/`, imports that cross folders use the `@/` alias; `../` is not allowed.
  `./` imports within a folder are fine.
- Outside a feature, import it only through `@/features/<name>`, never its internals.
  Inside a feature, its own files may use `@/features/<same-name>/...`.
- `src/components/ui/` may not import `@/features/*` or `@/lib/api`.
- `src/lib/` may not import `@/features/*` or `@/components/*`.
- Every package you import must be listed in `package.json`
  (`import/no-extraneous-dependencies`), and app code may not import
  devDependencies. `node_modules` is flat, so without this rule a package
  installed only as someone else's dependency would still import.

The per-feature rules are generated from the folders in `src/features/`, so a
new feature is covered automatically.

## Server and client

- Every file that touches the backend, secrets or the user session starts with
  `import "server-only"`: `env.server.ts`, `lib/api/client.ts`,
  `lib/api/server.ts`, each feature's `queries.ts`.
- `"use client"` only where interactivity needs it, as low in the tree as
  possible. Error boundaries (`error.tsx`, `global-error.tsx`) must be client
  components.
- Async server components hold no logic worth unit testing. Logic lives in
  plain functions (mappers, error handling) that Vitest covers; the async
  components are exercised by Playwright.

## Rendering, config and build output

- **Cache Components** is on. Each route has a prerendered static shell.
  Request-time data streams in inside `<Suspense>`. Give each data-backed
  section of a page its own `<Suspense>` with a skeleton fallback, so sections
  appear independently and a slow endpoint doesn't hold up the rest.
  `getApiClient()` calls `connection()`, so every backend call happens per
  request and never during the build.
- **One build for every environment.** Runtime config comes from server
  environment variables (Web App app settings), read through `getServerEnv()`
  in `src/lib/env.server.ts`. It validates with zod **on first call**, not at
  import, so `next build` works without runtime variables. Do not use
  `NEXT_PUBLIC_*` for anything that differs between environments.
- **Build output.** `pnpm build` runs `next build` (with `output: "standalone"`)
  and then `scripts/package-app.mjs`. That script copies the standalone server,
  `.next/static` and `public/` into `dist/app`. `dist/app` is self-contained:
  `node dist/app/server.js` runs it with no install. This folder is what gets
  tested, stored in Azure Artifacts and deployed. `pnpm start` runs it locally.
- **Security headers** are set for all routes in `next.config.ts`.
- **Observability** (Application Insights, OpenTelemetry) hooks into
  `src/instrumentation.ts`, the Next.js `register()` hook.

## API conventions

1. **The contract lives in zod schemas.** There is no generated client. Each
   feature's `api/mappers.ts` holds a zod schema for what the backend returns,
   and that schema is the frontend's copy of the contract. Responses are
   validated at runtime, so a backend change shows up as a clear "unexpected
   response" error. Keep schemas in step with the backend; E2E tests against
   the real backend (including the nightly run) catch drift.
2. **Per feature, under `api/`:**
   - `queries.ts`: reads. Starts with `import "server-only"`. Named `get*` or
     `list*`. Called from Server Components.
   - `actions.ts`: writes. Starts with `"use server"`. Named after what the
     backend endpoint does (`createOrder`, `cancelOrder`), so a function traces
     to an endpoint. Every export of a `"use server"` file is a public
     endpoint, so only real actions go there.
   - `mappers.ts`: the response schema and the DTO-to-UI-model mapping. The
     one place to change if the backend's shape changes.
3. **The browser never calls the backend.** Reads run in Server Components,
   writes in Server Actions.
4. **Shared plumbing** in `src/lib/api/`:
   - `client.ts`: a small `fetch` wrapper. It joins `API_BASE_URL` (which may
     include a path prefix) with the request path, and sends
     `X-Correlation-Id`: the incoming request's id if it looks valid,
     otherwise a new UUID. It parses JSON and turns failures into `ApiError`.
     Responses come back as `unknown` until a mapper validates them.
   - `server.ts` (`getApiClient()`) is what feature code calls. It reads the
     incoming request headers and the validated `API_BASE_URL`.
   - `errors.ts`: `ApiError` for HTTP errors (with or without an RFC 9457
     `ProblemDetails` body) and network failures (`status` is 0 when there
     was no response).
5. **Errors on the page.** A failed query throws. `src/app/error.tsx` shows
   `ErrorView`, a `role="alert"` message with no internal details and a
   "Try again" button that calls Next's `retry()`. `retry()` re-fetches;
   `reset()` would only re-render.
6. **Filters and sorting** live in URL search params, validated with zod
   inside the feature. Client components only update the URL; the server
   re-fetches. Filtered views can then be bookmarked and shared, and the back
   button works.

### Writes

- Validate input with zod inside the action.
- Return `ActionResult<T>`: `{ ok: true, data }` or
  `{ ok: false, code, message, fieldErrors? }`. Do not throw for expected failures.
- Send an `Idempotency-Key` header on POSTs if the backend supports it.
- Invalidate cached reads afterwards. In a Server Action, `updateTag(tag)`
  expires the data immediately, so the user sees their own write.
  `revalidateTag(tag, "max")` serves stale data while refreshing; use it where
  a short delay is fine, and in Route Handlers, where `updateTag` is not allowed.
- If the backend updates its read side asynchronously (CQRS projections), even
  `updateTag` cannot guarantee read-your-writes. Show the result returned by
  the action instead of re-reading immediately.
- E2E tests that write need a test-data plan (see `docs/testing.md`).

## Adding a feature

1. Create `src/features/<name>/` with `index.ts` exporting only the public surface.
2. Write `api/mappers.ts`, a zod schema for the backend response plus the
   mapping to a UI model. Copy a real response from the backend to check the
   schema against it.
3. Write `api/queries.ts` (and `api/actions.ts` for writes), following the
   conventions above.
4. Build components in `components/`. Put reusable, data-free pieces in
   `src/components/`, and add shadcn pieces to `components/ui` as needed.
5. Compose them in a thin route under `src/app/`, with each data-backed
   section in its own `<Suspense>`.
6. Add MSW handlers and fixtures to `tests/mocks/handlers.ts`. Then write
   unit and component tests, and integration tests for each UI state
   (success, empty, error).
7. Add an E2E spec for the user-facing route that works against a real
   backend; tag read-only tests `@smoke`. Add the route to `.pa11yci.js`.

## Client-side reads

If a client component needs to fetch (polling, infinite scroll), do not call
the backend from the browser. Add a Route Handler that proxies **GET only**,
to an allow-list of backend paths, and attaches the user's token on the
server. Writes stay as Server Actions.
