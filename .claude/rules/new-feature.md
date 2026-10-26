# Building a feature

This is Next.js 16 with Cache Components. Read the relevant guide in
`node_modules/next/dist/docs/` before writing Next.js code. Layout is in
`layout.md`; tests are in `testing.md`.

1. Create `src/features/<name>/` with an `index.ts` that exports only what pages need.
2. `api/mappers.ts`: a zod schema for the backend response, written from a
   real response, plus a mapper to the UI model in `types.ts`. The schema is
   the API contract; there is no generated client.
3. `api/queries.ts`: starts with `import "server-only"` and is named
   `get*`/`list*`. It calls `getApiClient()` from `@/lib/api/server` and
   returns mapped data. Failures throw `ApiError`.
4. Writes go in `api/actions.ts`: `"use server"`, named after the backend
   operation, real actions only. Validate input with zod and return
   `{ ok: true, data }` or `{ ok: false, code, message, fieldErrors? }`. Then
   call `updateTag` (shows the change at once) or `revalidateTag(tag, "max")`.
5. Components go in the feature's `components/`. Reusable pieces such as cards
   and chart wrappers go in `src/components/` and take data as props.
6. Compose the feature in a thin route under `src/app/`. Each data-backed
   section gets its own `<Suspense>` with a skeleton. Errors reach the error
   boundary (`ErrorView`); never render raw error text.
7. Filters and sorting live in URL search params, validated with zod. Client
   components only update the URL.
8. New runtime config: add it to the zod schema in `src/lib/env.server.ts` and
   to `.env.example`. Never use `NEXT_PUBLIC_*` for values that differ per environment.
9. Add tests (`testing.md`), and add the route to `.pa11yci.js`.
10. Run `pnpm verify`. Leave committing to the developer.

`pnpm dev` needs `API_BASE_URL` in `.env.local`, pointing at a running backend.
