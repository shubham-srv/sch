# Decisions

Choices made where the spec (`docs/spec.md`) was silent, or where the tools
current at scaffold time (October 2026) differed from what the spec assumed.

## Installed versions

| Tool / package                                                  | Version                                                                                                                                                      | Note                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Node.js                                                         | 24.22.1                                                                                                                                                      | Active LTS ("Krypton"); `.nvmrc`, `engines: >=24.22.1 <25` |
| pnpm                                                            | 12.15.0                                                                                                                                                      | via Corepack, `packageManager`                             |
| next, eslint-config-next                                        | 16.4.2                                                                                                                                                       |                                                            |
| react, react-dom                                                | 19.3.0                                                                                                                                                       |                                                            |
| typescript                                                      | 5.9.3                                                                                                                                                        | not 7.x, see below                                         |
| tailwindcss, @tailwindcss/turbopack                             | 4.3.3                                                                                                                                                        |                                                            |
| shadcn (CLI)                                                    | 4.22.1                                                                                                                                                       | style `base-nova`, base colour `neutral`                   |
| @base-ui/react / class-variance-authority / cn / tw-animate-css | 1.9.0 / 0.7.1 / 0.5.0 / 1.4.0                                                                                                                                | added by shadcn                                            |
| zod                                                             | 4.6.7                                                                                                                                                        |                                                            |
| openapi-typescript / openapi-fetch                              | 7.13.0 / 0.17.0                                                                                                                                              |                                                            |
| vitest, @vitest/coverage-v8                                     | 5.0.5                                                                                                                                                        | Vite 8.3.5                                                 |
| @vitejs/plugin-react                                            | 6.1.2                                                                                                                                                        |                                                            |
| @testing-library/react / dom / user-event / jest-dom            | 16.3.3 / 10.4.2 / 14.6.8 / 7.0.1                                                                                                                             |                                                            |
| jsdom                                                           | 30.1.3                                                                                                                                                       |                                                            |
| msw                                                             | 3.0.3                                                                                                                                                        |                                                            |
| @playwright/test                                                | 1.64.1                                                                                                                                                       | Chromium 156                                               |
| pa11y-ci                                                        | 5.0.0                                                                                                                                                        | pa11y 10.0.0, puppeteer 25.15.0                            |
| eslint                                                          | 9.39.5                                                                                                                                                       | not 10.x, see below                                        |
| eslint-plugin-testing-library                                   | 7.16.2                                                                                                                                                       |                                                            |
| prettier / prettier-plugin-tailwindcss                          | 3.9.10 / 0.8.1                                                                                                                                               |                                                            |
| husky / lint-staged                                             | 9.1.7 / 17.6.0                                                                                                                                               |                                                            |
| tsx                                                             | 4.23.15                                                                                                                                                      | runs the mock API                                          |
| Docker base image                                               | node:24.22.1-slim                                                                                                                                            | glibc, for prebuilt sharp/swc binaries                     |
| Pipeline tasks                                                  | UseNode@1, Cache@2, Docker@2, PublishTestResults@2, PublishCodeCoverageResults@2, PublishPipelineArtifact@1, AzureWebAppContainer@1, AzureAppServiceManage@0 | checked against Microsoft Learn                            |

## Repository and tooling

- **Repo root is the working folder.** The spec is kept as `docs/spec.md`
  (excluded from Prettier).
- **TypeScript 5.9, not 7.0.** TypeScript 7 (the native port) is the latest
  release, but the Next 16.4.2 template pins `^5` and openapi-typescript's
  peer range is `^5.x`.
- **ESLint 9, not 10.** ESLint 9 is deprecated upstream, but
  `eslint-plugin-react`, `jsx-a11y` and `import` (inside eslint-config-next)
  only support up to 9.
- **pnpm 12 configuration lives in `pnpm-workspace.yaml`.** pnpm 11+ reads only
  auth and registry settings from `.npmrc`, so `engineStrict: true` is set
  there. `.npmrc` keeps `engine-strict=true` for npm users, as the spec asks.
- **`shellEmulator: true`** (pnpm) so scripts such as
  `A11Y_REPORT_FILE=… pa11y-ci` work on Windows as well as Linux.
- **Dependency build scripts are all denied** (`allowBuilds`). esbuild, sharp
  and unrs-resolver work from their prebuilt optional packages. puppeteer's
  script would download Chrome. Instead, **pa11y uses Playwright's Chromium**
  through `chromeLaunchConfig.executablePath`. That keeps a single browser
  download, and none at all in the Docker install stage.
- **pnpm's `minimumReleaseAge` default (24 h)** is kept as supply-chain protection.
- **`typecheck` runs `next typegen` first.** Route types such as `LayoutProps`
  are generated into `.next/types`.
- **`lint` uses `--max-warnings=0`.** An `any` needs an
  `eslint-disable-next-line ... -- reason` comment.
- **Import boundaries without a plugin.** `no-restricted-imports` regex
  patterns, with `../` banned inside `src/` so every cross-folder import goes
  through `@/` and can be checked. Per-feature overrides are generated from
  `src/features/*`.
- **`vitest.config.mts`, not `.ts`.** The config is ESM and the package has no
  `"type": "module"`. The Next.js Vitest guide uses `.mts` too.
- **Vite 8's `resolve.tsconfigPaths`** replaces the `vite-tsconfig-paths` plugin.
- **`api:types:pull`** is `scripts/pull-openapi.mjs`. It reads `.env.local`,
  writes the snapshot, then formats it so `format:check` stays green.
- **Husky's hook is installed by `prepare`.** `HUSKY=0` skips it in Docker and CI.

## Next.js

- **Cache Components and Partial Prefetching stay on** (the create-next-app
  16.4 defaults; both become mandatory in the next major). The greeting
  therefore renders inside `<Suspense>`.
- **`getApiClient()` calls `connection()`.** With Partial Prefetching,
  `headers()` can resolve during an App Shell prerender, and generating the
  correlation id there (`crypto.randomUUID()`) is rejected by Next.
  `connection()` keeps all backend calls to real requests.
- **`error.tsx` calls `retry`, not `reset`** (spec V1.1). Since 16.3, `retry()`
  re-fetches the segment, while `reset()` only re-renders it, so a failed
  backend call would not be retried. `ErrorView` takes
  `onRetry` and the caught `error`, and shows only its `digest` as a reference.
- **Tailwind loads through the `@tailwindcss/turbopack` loader**, as in the
  current template, so there is no `postcss.config.mjs` (the spec's layout
  lists one).
- **`AGENTS.md` is kept.** `next dev` writes it and recreates it if removed.
- **Document titles.** The layout's `"%s | Web"` template only applies to child
  segments, so the home page title is `Hello world`.
  TODO(owner): product name in place of "Web".
- **`/api/health` calls `connection()` and sends `Cache-Control: no-store`.**
  Under Cache Components a constant GET handler would otherwise be
  prerendered at build time.
- **Fonts: `next/font/google` (Geist).** Font files are downloaded at build
  time and served by the app; browsers never contact Google. The build needs
  outbound access to Google Fonts. Switch to `next/font/local` if agents lack it.
- **Security headers:** `nosniff`, `strict-origin-when-cross-origin`,
  a `Permissions-Policy` disabling camera, microphone, geolocation and topics,
  `X-Frame-Options: DENY` plus `frame-ancestors 'none'`, and HSTS for two years
  with `includeSubDomains`, without `preload`.
- **`public/robots.txt`** is the one public file. The Definition of done needs
  `public/` served. TODO(owner): per-environment indexing policy.

## API layer

- **`API_BASE_URL` is validated with `z.url({ protocol: /^https?$/ })`.**
  `z.httpUrl()` requires a dotted domain and rejected `localhost`,
  `127.0.0.1` and the compose host `mock-api`.
- **`ApiError.status` is 0 when no response was received.** A network
  failure or an unparseable success body has no HTTP status.
- **Mappers validate with zod at runtime.** The schema uses `satisfies` against
  the generated type so the two cannot drift silently.
- **An incoming `X-Correlation-Id` is forwarded only if it matches
  `[\w.:-]{1,128}`**; otherwise a new UUID is generated.

## Tests

- **`@mswjs/http-middleware` was dropped.** Version 0.10.3 calls
  `handleRequest`, which MSW 3 no longer exports, even though its peer range
  (`msw >=2`) allows it. The mock API is a small `node:http` server that
  resolves requests with MSW's public `getResponse(handlers, request)`, so the
  handlers remain the single source of truth.
- **`onUnhandledFrame: "error"`** is MSW 3's name for
  `onUnhandledRequest`.
- **RTL cleanup is called manually** because Vitest globals are off. The
  `testing-library/no-manual-cleanup` lint rule is disabled on that line.
- **`next/server` is mocked** (`tests/utils/next-server.ts`) as well as
  `next/headers`, because `getApiClient()` calls `connection()`.
- **Coverage thresholds:** 80% lines, functions and statements; 75% branches.

## Docker

- **All stages use `node:24.22.1-slim` (glibc).** The prebuilt sharp and
  Next SWC binaries for glibc are the most common path.
- **Test files are excluded from the build context** (`.dockerignore`),
  because `next build` type-checks every file in `tsconfig.json`'s include
  and the jest-dom matcher types live in `tests/`.
- **The runtime files are owned by the `node` user**, because Next.js writes
  caches under `.next`.
- **The mock API image installs its own dependencies**
  (`e2e/mock-api/Dockerfile`, filtered by `Dockerfile.dockerignore`) instead of
  mounting the repo. `node_modules` installed on a Windows or macOS host holds
  native binaries for that host. It is a full frozen install, slow on a cold
  cache.
- **Compose host ports and project name are configurable**
  (`WEB_HOST_PORT`, `MOCK_API_HOST_PORT`, `COMPOSE_PROJECT_NAME`) so the
  parallel E2E and Accessibility jobs can share a self-hosted agent host.
- **Image optimisation was checked in the built image.** A 400×300 PNG served
  through `/_next/image?w=64` returns `image/webp` (sharp 0.35.5, libvips
  8.18.7).

## Pipeline

- **Self-hosted Linux pool** (owner's choice). Its name is the pipeline
  parameter `agentPool`, because pools are resolved at compile time.
- **Service connection names are YAML variables, not variable-group values.**
  Azure DevOps authorizes resources before variable groups are available.
  Everything else (ACR, app and slot names, URLs) is in the `web-frontend`
  variable group.
- **`UseNode@1` replaces `NodeTool@0`** (the current major), reading `.nvmrc`.
- **Docker@2 `build` and `push` are separate steps.** `buildAndPush` ignores
  `arguments`, and the OCI labels need `--build-arg`.
- **One Web App with a deployment slot.** `<webapp-prod>` is the app,
  `<webapp-staging>` is the slot name, and production is reached by swap
  (spec A7/A8).
- **The smoke-test URL comes from the deploy task's
  `AppServiceApplicationUrl` output.** It is not built from the app name,
  since newer apps get unique default host names.
- **Pipeline variables `CI=true`** (Playwright `forbidOnly` and retries)
  **and `HUSKY=0`.**
- **The PR template is `.azuredevops/pull_request_template.md`.**

## Process

- **No commits were made** (owner's choice). The Definition of done's
  clean-checkout run was done in a temporary copy with its own git history.
