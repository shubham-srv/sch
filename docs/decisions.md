# Decisions

Choices made where the spec (`docs/spec.md`) was silent, where the owner
changed it, or where the tools current at scaffold time (October 2026)
differed from what the spec assumed. `docs/spec.md` itself is kept as written.

## Owner changes to the spec

- **No OpenAPI.** `openapi/`, the generated types, `openapi-typescript`,
  `openapi-fetch`, the `api:types` scripts and the CI drift check are gone. A
  small `fetch` client (`src/lib/api/client.ts`) replaces the typed client.
  Each feature's zod schema in `api/mappers.ts` is the frontend's copy of the
  contract, validated at runtime.
- **No Docker or ACR; code deployment to Azure Web Apps.** The build output
  (`dist/app`) is stored in **Azure Artifacts** as a Universal Package and
  zip-deployed to a Linux Web App on the built-in Node 24 runtime. The
  Dockerfile, compose file and Docker scripts are gone.
- **E2E runs against real backends**: locally against the developer's backend
  container, in the pipeline against the staging backend, then against the
  deployed staging and production apps. There is no mock API server.
  MSW stays for Vitest, where it covers every UI state. A **nightly pipeline**
  re-tests staging and production. Note for Version 2: the spec plans a fake
  Entra ID provider under `e2e/mock-api/`, because real Microsoft sign-in
  cannot be automated. That is a fake identity provider, not a fake backend,
  so it needs a fresh decision when Version 2 starts.
- **Two READMEs.** `readme-prod.md` gives the overview, setup and how the app
  works; `README.md` is the developer reference. `docs/dummy-guide.md` explains
  every tool and the testing approach for newcomers.
- **Yarn 4.14.1 instead of pnpm**, to match the client's other application.
  Yarn comes from Corepack (`packageManager`) and is configured in
  `.yarnrc.yml` (see Repository and tooling). The spec's `.npmrc`
  (`engine-strict=true`) is gone: Yarn reads neither `.npmrc` nor the
  `engines` field, so nothing checks the Node version at install time. `.nvmrc`
  (nvm locally, `UseNode@1` in the pipeline) and App Service's `NODE|24-lts`
  set it instead.
- **Node 22 is allowed for local development** (`engines: ^22.22.2 || ^24.22.1`),
  for machines that have Node 22. The pipeline (`.nvmrc`) and App Service stay
  on 24, so what is tested and deployed doesn't change. 22.22.2 is the floor
  because jsdom and lint-staged require it. Checked on 22.23.2: immutable
  install, `yarn verify`, and `yarn start` rendering a page from a backend.
  The types stay `@types/node` 24, so an API that only Node 24 has would
  type-check but fail on 22. Node 22 is supported upstream until 30 April 2027.

## Installed versions

| Tool / package                                                  | Version                                                                                                                                                        | Note                                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Node.js                                                         | 24.22.1                                                                                                                                                        | Active LTS ("Krypton"); `.nvmrc`, `engines: ^22.22.2 \|\| ^24.22.1`; App Service `NODE\|24-lts` |
| Yarn                                                            | 4.14.1                                                                                                                                                         | via Corepack, `packageManager`                                                                  |
| next, eslint-config-next                                        | 16.4.2                                                                                                                                                         |                                                                                                 |
| react, react-dom                                                | 19.3.0                                                                                                                                                         |                                                                                                 |
| typescript                                                      | 5.9.3                                                                                                                                                          | not 7.x, see below                                                                              |
| tailwindcss, @tailwindcss/turbopack                             | 4.3.3                                                                                                                                                          |                                                                                                 |
| shadcn (CLI)                                                    | 4.22.1                                                                                                                                                         | style `base-nova`, base colour `neutral`                                                        |
| @base-ui/react / class-variance-authority / cn / tw-animate-css | 1.9.0 / 0.7.1 / 0.5.0 / 1.4.0                                                                                                                                  | added by shadcn                                                                                 |
| zod                                                             | 4.6.7                                                                                                                                                          |                                                                                                 |
| vitest, @vitest/coverage-v8                                     | 5.0.5                                                                                                                                                          |                                                                                                 |
| vite                                                            | 8.3.5                                                                                                                                                          | peer of Vitest, `@vitejs/plugin-react` and MSW                                                  |
| @vitejs/plugin-react                                            | 6.1.2                                                                                                                                                          |                                                                                                 |
| @testing-library/react / dom / user-event / jest-dom            | 16.3.3 / 10.4.2 / 14.6.8 / 7.0.1                                                                                                                               |                                                                                                 |
| jsdom                                                           | 30.1.3                                                                                                                                                         |                                                                                                 |
| msw                                                             | 3.0.3                                                                                                                                                          |                                                                                                 |
| @playwright/test                                                | 1.64.1                                                                                                                                                         | Chromium 156                                                                                    |
| pa11y-ci                                                        | 5.0.0                                                                                                                                                          | pa11y 10.0.0, puppeteer 25.16.0                                                                 |
| eslint                                                          | 9.39.5                                                                                                                                                         | not 10.x, see below                                                                             |
| eslint-plugin-testing-library                                   | 7.16.2                                                                                                                                                         |                                                                                                 |
| prettier / prettier-plugin-tailwindcss                          | 3.9.10 / 0.8.1                                                                                                                                                 |                                                                                                 |
| husky / lint-staged                                             | 9.1.7 / 17.6.0                                                                                                                                                 |                                                                                                 |
| Pipeline tasks                                                  | UseNode@1, Cache@2, PublishTestResults@2, PublishCodeCoverageResults@2, PublishPipelineArtifact@1, UniversalPackages@0, AzureWebApp@1, AzureAppServiceManage@0 | checked against Microsoft Learn                                                                 |

## Repository and tooling

- **Repo root is the working folder.** The spec is kept as `docs/spec.md`
  (excluded from Prettier).
- **TypeScript 5.9, not 7.0.** TypeScript 7 (the native port) is the latest
  release, but the Next 16.4.2 template pins `^5`.
- **ESLint 9, not 10.** ESLint 9 is deprecated upstream, but
  `eslint-plugin-react`, `jsx-a11y` and `import` (inside eslint-config-next)
  only support up to 9.
- **Yarn's settings live in `.yarnrc.yml`.** Yarn itself comes from Corepack
  (`packageManager: yarn@4.14.1`), so there is no `.yarn/releases` binary.
- **`nodeLinker: node-modules`** gives a flat `node_modules` of real folders.
  Yarn's default, Plug'n'Play, has no `node_modules`, and Turbopack does not
  support it ("not planned" in the Next.js docs). Next's standalone output
  copies `node_modules`, and a zip deployment to App Service does not reliably
  keep symlinks. **`import/no-extraneous-dependencies`** (ESLint) restores the
  strictness this gives up: every import must be declared in `package.json`,
  and app code may not use devDependencies.
- **Yarn runs scripts through its own cross-platform shell**, so scripts such
  as `A11Y_REPORT_FILE=… pa11y-ci` work on Windows as well as Linux.
- **Dependency install scripts are all denied** (`enableScripts: false`, also
  Yarn's default since 4.14). The two packages that have one are marked
  `built: false` under `dependenciesMeta` in `package.json`, which turns Yarn's
  warning into a notice. unrs-resolver works from its prebuilt optional
  package. puppeteer's script would download Chrome. Instead, **pa11y uses
  Playwright's Chromium** through `chromeLaunchConfig.executablePath`, so only
  one browser is downloaded.
- **`npmMinimalAgeGate: 1d`**: versions published less than a day ago are not
  installed, as supply-chain protection. It is set explicitly because Yarn made
  it the default only in 4.15.
- **Peer dependencies are declared, not auto-installed.** Yarn does not
  install missing peers, so `vite` (a peer of Vitest, `@vitejs/plugin-react`
  and MSW) is a devDependency. `@types/set-cookie-parser` (from MSW) accepts
  any `@types/node`, which would add a second, newer copy; a `resolutions`
  entry keeps one, matching Node 24. Yarn still warns about two peers inside
  eslint-config-next and eslint-plugin-testing-library; the root install
  provides both, so they are harmless.
- **Telemetry is off** (`enableTelemetry: false`).
- **`typecheck` runs `next typegen` first.** Route types such as `LayoutProps`
  are generated into `.next/types`.
- **`lint` uses `--max-warnings=0`.** An `any` needs an
  `eslint-disable-next-line ... -- reason` comment. The lint-staged command
  adds `--no-warn-ignored`, since lint-staged passes ignored files by name.
- **Import boundaries without a plugin.** `no-restricted-imports` regex
  patterns, with `../` banned inside `src/` so every cross-folder import goes
  through `@/` and can be checked. Per-feature overrides are generated from
  `src/features/*`.
- **`vitest.config.mts`, not `.ts`.** The config is ESM and the package has no
  `"type": "module"`. The Next.js Vitest guide uses `.mts` too.
- **Vite 8's `resolve.tsconfigPaths`** replaces the `vite-tsconfig-paths` plugin.
- **Husky's hook is installed by `postinstall`**, because Yarn does not run
  `prepare`. `HUSKY=0` skips it in CI.

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
- **`public/robots.txt`** is the one public file. TODO(owner): per-environment
  indexing policy.

## API layer

- **The client is a small `fetch` wrapper** (`createApiClient`), not a library.
  It joins the base URL and path (trimming trailing slashes), sends
  `X-Correlation-Id` and `Accept: application/json`, and parses JSON. It falls
  back to plain text so an HTML error page from a proxy still becomes an
  `ApiError`. Responses are `unknown` until a mapper validates them.
- **`API_BASE_URL` is validated with `z.url({ protocol: /^https?$/ })`.**
  `z.httpUrl()` requires a dotted domain and rejected `localhost` and
  `127.0.0.1`.
- **`ApiError.status` is 0 when no response was received** (network failure).
- **An incoming `X-Correlation-Id` is forwarded only if it matches
  `[\w.:-]{1,128}`**; otherwise a new UUID is generated.

## Tests

- **MSW only in Vitest.** `tests/mocks/handlers.ts` is the happy path, and tests
  override handlers with `server.use(...)` for other UI states.
- **`onUnhandledFrame: "error"`** is MSW 3's name for `onUnhandledRequest`.
- **RTL cleanup is called manually** because Vitest globals are off. The
  `testing-library/no-manual-cleanup` lint rule is disabled on that line.
- **`next/server` is mocked** (`tests/utils/next-server.ts`) as well as
  `next/headers`, because `getApiClient()` calls `connection()`.
- **`playwright.config.ts` loads `.env.local`** with `process.loadEnvFile`
  and fails at once with a clear message when there is neither
  `API_BASE_URL` nor `PLAYWRIGHT_BASE_URL`.
- **`E2E_EXPECTED_GREETING`** (renamed from the spec's
  `SMOKE_EXPECTED_GREETING`, since it now applies to every E2E run) is
  optional. Without it, the test checks the heading is not empty. Either way
  it asserts the error page is not showing, which was verified by running with
  the backend stopped.
- **Coverage thresholds:** 80% lines, functions and statements; 75% branches.

## Build and deploy

- **`yarn build` = `next build` + `scripts/package-app.mjs`**, which copies the
  standalone server, `.next/static` and `public/` into `dist/app` (no
  symlinks; about 24 MB on Windows, 41 MB on Linux with sharp's image library). **`yarn start` runs `dist/app/server.js`** with
  `node --env-file-if-exists=.env.local`; `next start` is not used with
  standalone output. Playwright's local server uses the same two commands, so
  local E2E tests the same artifact that is deployed.
- **Build on Linux only for deployment.** `dist/app` contains the building
  machine's native binaries (sharp). The pipeline builds on the Linux agents,
  which matches App Service on Linux. A Linux build from a clean copy was
  checked: immutable install, `yarn verify`, no symlinks, and `/_next/image`
  returns WebP. On Windows, Next's file tracing leaves out sharp's DLLs, so a
  locally built `yarn start` serves images unoptimised. That affects local
  runs only.
- **Zip deploy, not run-from-package.** `AzureWebApp@1` on `webAppLinux` uses
  zip deploy. Run-from-package would make `wwwroot` read-only, and Next.js
  writes caches under `.next`.
- **App settings set by the pipeline:** `HOSTNAME=0.0.0.0` (the standalone
  server binds to `HOSTNAME`) and `SCM_DO_BUILD_DURING_DEPLOYMENT=false` (the
  package is already built). The startup command is `node server.js`. `PORT`
  comes from App Service.
- **Universal Package `web`, version `0.1.<BuildId>`, published only from
  `main`.** PR runs test the pipeline artifact. Deploys download the package
  from Azure Artifacts, so what is deployed is what is stored.

## Pipeline

- **Self-hosted Linux pool** (owner's choice). Its name is the pipeline
  parameter `agentPool`, because pools are resolved at compile time.
- **The service connection name is a YAML variable, not a variable-group value.**
  Azure DevOps authorizes resources before variable groups are available.
  Everything else (feed, app and slot names, URLs) is in the `web-frontend`
  variable group.
- **`UseNode@1` replaces `NodeTool@0`** (the current major), reading `.nvmrc`.
- **The packaged app runs on the agent for the E2E and Accessibility stages**
  (`templates/serve-app.yml`), against `stagingApiBaseUrl`, on ports 3000 and
  3001 so both stages can share an agent host.
- **Staging gets the full E2E suite; production gets `@smoke` only**, after
  the swap.
- **`expectedGreeting` has an empty YAML default** before the variable group,
  so an unset key does not reach the tests as the literal `$(expectedGreeting)`.
- **One Web App with a deployment slot.** `<webapp-prod>` is the app,
  `<webapp-staging>` is the slot name, and production is reached by swap
  (spec A7/A8).
- **The staging URL comes from the deploy task's `AppServiceApplicationUrl`
  output** in the main pipeline. The nightly pipeline, which deploys nothing,
  uses the `stagingUrl` variable.
- **Nightly is a separate pipeline** (`pipelines/nightly-e2e.yml`,
  `trigger: none`, `pr: none`, cron `0 2 * * *` UTC, `always: true`). It runs
  even without code changes, to catch backend drift.
- **Pipeline variables `CI=true`** (Playwright `forbidOnly` and retries)
  **and `HUSKY=0`.**
- **The PR template is `.azuredevops/pull_request_template.md`.**

## Process

- **Claude does not commit.** The owner commits.
