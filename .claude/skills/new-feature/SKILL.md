---
name: new-feature
description: Build or extend a feature end to end - intake, a plan the user approves, implementation, tests, verification, self-review and a summary. Use whenever the user asks to build, add or extend a feature, page or data domain.
argument-hint: "[feature description]"
---

# New feature

Feature request: $ARGUMENTS

Follow these steps in order. Conventions are in `.claude/rules/`: `layout.md`
(where code goes), `testing.md` (tests) and `code-review.md` (review). This is
Next.js 16 with Cache Components: read the relevant guide in
`node_modules/next/dist/docs/` before writing Next.js code.

## 1. Intake

Before planning, make sure you have:

- What the user can do, as acceptance criteria.
- The route, and whether it uses a shared shell (route group).
- The backend endpoints, with an example response for success and for empty.
  Use a real response if the backend is ready; otherwise the example agreed
  with the backend team.
- Read-only or writes. For writes, the backend's error cases.
- Filters, sorting or pagination.
- A design reference, or shadcn defaults.
- What is out of scope.

Ask for everything missing in one message. Never invent an API contract.

## 2. Context

Read the code the feature touches, an existing feature as a reference, and the
Next.js guides the plan depends on.

## 3. Plan, then stop

Post the plan in the chat:

- Files to create and files to change.
- The zod schema and the UI model.
- Each UI state (loading, success, empty, error) and its `<Suspense>` boundary.
- Tests per layer.
- Assumptions and open questions.

Stop and wait for approval. Skip this stop only when the user says so. If the
plan has to change during implementation, say what changes before continuing.

## 4. Implement

1. Create `src/features/<name>/` with an `index.ts` that exports only what
   pages need.
2. `api/mappers.ts`: a zod schema for the backend response, written from the
   response gathered at intake, plus a mapper to the UI model in `types.ts`.
   The schema is the API contract; there is no generated client.
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
   to `.env.example`. Never use `NEXT_PUBLIC_*` for values that differ per
   environment.

## 5. Tests

Follow `testing.md`:

- Unit tests for new logic: mappers, queries, actions, helpers.
- An integration test for each UI state: success, empty, error and network
  failure. Fixtures in `tests/mocks/handlers.ts` come from the same response as
  the schema.
- An E2E spec with a page object in `e2e/pages/`.
- The new route in `.pa11yci.js`.

## 6. Verify

Ask the `verifier` agent to run the checks. It runs the steps of `yarn verify`
and returns only the failures. Where subagents aren't available, run
`yarn verify` yourself. Include `yarn test:e2e` and `yarn a11y` only when the
user asks; they need a running backend.

When a check fails, fix the code. Never skip, delete or weaken a test, or
disable a lint rule, to make a check pass. If a check still fails after two
attempts to fix it, stop and report the failure, what you tried and what you
suspect.

## 7. Self-review

Review the diff against `code-review.md`. Fix what you find, then run the
checks again as in step 6.

## 8. Summary

Report in the chat, concisely:

- **Created:** each new file, one line on what it does.
- **Changed:** each changed file, one line on what changed.
- **Tests:** what was added, and the `yarn verify` result.
- **Not verified:** E2E and accessibility unless they were run, and any schema
  or fixture written from an example rather than a real response.
- **Decisions:** assumptions made where the request was silent.
- **Follow-ups:** for example, checking the schema against the real response
  once the backend is ready.

Don't commit; the developer commits.
