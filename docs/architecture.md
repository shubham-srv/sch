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
| `src/lib/api/`           | Typed backend client: `client.ts`, `server.ts`, `errors.ts`, `generated/`.                                                                                        | yes        |
| `tests/`                 | Vitest setup, shared MSW handlers, test utilities, integration tests.                                                                                             | yes        |
| `e2e/`                   | Playwright specs, page objects, the mock API server. Never imported by app code.                                                                                  | yes        |

## Import rules

ESLint enforces these with `no-restricted-imports` (`eslint.config.mjs`):

- Inside `src/`, imports that cross folders use the `@/` alias; `../` is not allowed.
  `./` imports within a folder are fine.
- Outside a feature, import it only through `@/features/<name>`, never its internals.
  Inside a feature, its own files may use `@/features/<same-name>/...`.
- `src/components/ui/` may not import `@/features/*` or `@/lib/api`.
- `src/lib/` may not import `@/features/*` or `@/components/*`.

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

## Rendering and config

- **Cache Components** is on (the Next.js 16.4 default, and mandatory in the
  next major). Each route has a prerendered static shell. Request-time data
  streams in inside `<Suspense>`. `src/app/page.tsx` wraps the greeting in
  `<Suspense>`, and `getApiClient()` calls `connection()`, so every backend call
  happens per request and never during the build.
- **One image for every environment.** Runtime config comes from server
  environment variables, read through `getServerEnv()` in
  `src/lib/env.server.ts`. It validates with zod **on first call**, not at
  import, so `next build` works without runtime variables. Do not use
  `NEXT_PUBLIC_*` for anything that differs between environments.
- **Security headers** are set for all routes in `next.config.ts`. A
  nonce-based Content-Security-Policy is a planned follow-up.
- **Observability:** add `src/instrumentation.ts` (Next.js `register()` hook)
  when Application Insights or OpenTelemetry is introduced. Not built yet.

## API conventions

1. **Types come from the contract.** `openapi/openapi.json` is a committed
   snapshot of the backend's OpenAPI document. `pnpm api:types` generates
   `src/lib/api/generated/schema.d.ts` (committed). CI fails if regeneration
   changes it. `pnpm api:types:pull` refreshes the snapshot from `OPENAPI_URL`.
2. **Per feature, under `api/`:**
   - `queries.ts`: reads. Starts with `import "server-only"`. Named `get*` or
     `list*` (`getGreeting`). Called from Server Components.
   - `actions.ts`: writes. Starts with `"use server"`. Named after the
     backend endpoint's `operationId` (`createOrder`, `cancelOrder`). Every
     export of a `"use server"` file is a public endpoint, so only real actions
     go there.
   - `mappers.ts`: API DTO to UI model. It validates at runtime and is the one
     place to change if the backend's shape changes.
3. **The browser never calls the backend.** Reads run in Server Components,
   writes in Server Actions.
4. **Shared plumbing** in `src/lib/api/`:
   - `client.ts` builds the `openapi-fetch` client and sends
     `X-Correlation-Id`: the incoming request's id if it looks valid,
     otherwise a new UUID.
   - `server.ts` (`getApiClient()`) is what feature code calls. It reads the
     incoming request headers and the validated `API_BASE_URL`.
   - `errors.ts`: `unwrap()` turns HTTP errors (with or without an RFC 9457
     `ProblemDetails` body) and network failures into `ApiError` (`status` is
     0 when there was no response).
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

## Adding a feature

1. Create `src/features/<name>/` with `index.ts` exporting only the public surface.
2. Add the endpoints to `openapi/openapi.json` (or `pnpm api:types:pull`), then
   run `pnpm api:types`.
3. Write `api/mappers.ts` and `api/queries.ts` (and `api/actions.ts` for writes),
   following the conventions above.
4. Build components in `components/`, adding shadcn pieces to `components/ui` as needed.
5. Compose them in a thin route under `src/app/`. Wrap request-time data in `<Suspense>`.
6. Add MSW handlers to `tests/mocks/handlers.ts`, then unit, component and
   integration tests, and an E2E spec if the route is user-facing.
7. Add the route to `.pa11yci.js`.

## Client-side reads later

If a client component ever needs to fetch (polling, infinite scroll), do not
call the backend from the browser. Add a Route Handler that proxies **GET
only**, to an allow-list of backend paths, and attaches the user's token on the
server (Version 2). Writes stay as Server Actions.
