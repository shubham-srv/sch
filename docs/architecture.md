# Architecture

## Where code goes

| Folder                   | Contents                                                                                                                                                          | Exists yet |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `src/app/`               | Routes only. Pages compose feature components and call feature functions; no business logic. Also `error.tsx`, `global-error.tsx`, `not-found.tsx`, `api/health`. | yes        |
| `src/features/<name>/`   | Everything one feature owns: `components/`, `api/` (`queries.ts`, `actions.ts`, `mappers.ts`), `types.ts`, and `index.ts`, its public surface.                    | `greeting` |
| `src/components/ui/`     | shadcn/ui components, treated as vendored code: no business logic, no tests. Add with `pnpm dlx shadcn@latest add <name>`.                                        | `button`   |
| `src/components/`        | Shared app components used by several features or routes (`error-view.tsx`).                                                                                      | yes        |
| `src/components/layout/` | Shared layout pieces (header, footer) once the root layout outgrows inline markup.                                                                                | no         |
| `src/hooks/`             | Shared client hooks.                                                                                                                                              | no         |
| `src/lib/`               | Framework-agnostic plumbing: `env.server.ts`, `utils.ts` (`cn`).                                                                                                  | yes        |
| `src/lib/api/`           | Backend client: `client.ts`, `server.ts`, `errors.ts`.                                                                                                            | yes        |
| `tests/`                 | Vitest setup, the MSW fake backend, test utilities, integration tests.                                                                                            | yes        |
| `e2e/`                   | Playwright specs and page objects. Never imported by app code.                                                                                                    | yes        |
| `scripts/`               | Build helpers: `package-app.mjs` assembles `dist/app`.                                                                                                            | yes        |

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

- Every file that touches the backend, secrets or (from Version 2) the session
  starts with `import "server-only"`: `env.server.ts`, `lib/api/client.ts`,
  `lib/api/server.ts`, feature `queries.ts`.
- `"use client"` only where interactivity needs it, as low in the tree as
  possible. Today that is only `error.tsx` and `global-error.tsx` (error
  boundaries must be client components).
- Async server components hold no logic worth unit testing. Logic lives in
  plain functions (mappers, error handling) that Vitest covers; the async
  components are exercised by Playwright.

## Rendering, config and build output

- **Cache Components** is on (the Next.js 16.4 default, and mandatory in the
  next major). Each route has a prerendered static shell. Request-time data
  streams in inside `<Suspense>`. `src/app/page.tsx` wraps the greeting in
  `<Suspense>`, and `getApiClient()` calls `connection()`, so every backend call
  happens per request and never during the build.
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
- **Security headers** are set for all routes in `next.config.ts`. A
  nonce-based Content-Security-Policy is a planned follow-up.
- **Observability:** add `src/instrumentation.ts` (Next.js `register()` hook)
  when Application Insights or OpenTelemetry is introduced. Not built yet.

## API conventions

1. **The contract lives in zod schemas.** There is no OpenAPI document or
   generated client. Each feature's `api/mappers.ts` holds a zod schema for
   what the backend returns, and that schema is the frontend's copy of the
   contract. Responses are validated at runtime, so a backend change shows up
   as a clear "unexpected response" error. Keep schemas in step with the
   backend. E2E tests against the real backend (including the nightly run)
   catch drift that the schemas and fakes don't.
2. **Per feature, under `api/`:**
   - `queries.ts`: reads. Starts with `import "server-only"`. Named `get*` or
     `list*` (`getGreeting`). Called from Server Components.
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

### When a feature first has writes

Not built yet. Apply these the first time:

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
4. Build components in `components/`, adding shadcn pieces to `components/ui` as needed.
5. Compose them in a thin route under `src/app/`. Wrap request-time data in `<Suspense>`.
6. Add MSW handlers and fixtures to `tests/mocks/handlers.ts`. Then write
   unit and component tests, and integration tests for each UI state
   (success, empty, error).
7. Add an E2E spec for the user-facing route that works against a real
   backend; tag read-only tests `@smoke`. Add the route to `.pa11yci.js`.

## Client-side reads later

If a client component ever needs to fetch (polling, infinite scroll), do not
call the backend from the browser. Add a Route Handler that proxies **GET
only**, to an allow-list of backend paths, and attaches the user's token on the
server (Version 2). Writes stay as Server Actions.
