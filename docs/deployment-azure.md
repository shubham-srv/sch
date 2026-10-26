# Deploying to Azure

The app is built **once** per pipeline run into `dist/app`: the Next.js
standalone server (`server.js` plus the `node_modules` it needs) and its static
files. That folder is:

1. tested on the build agent against the real staging backend (E2E and accessibility),
2. stored in **Azure Artifacts** as a Universal Package (`web`, version `0.1.<BuildId>`),
3. downloaded from Azure Artifacts and **zip-deployed** to the staging slot of
   a **Linux Web App** using the built-in Node 24 runtime, then E2E-tested there,
4. on request and after approval, **swapped** into production and smoke-tested.

No containers are involved. Every environment runs the same package; only app
settings differ. A separate nightly pipeline re-tests staging and production
(see [Nightly checks](#nightly-checks)).

## Placeholders

| Placeholder                | Meaning                                                                      | Where it is set                                                                          |
| -------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `<agent-pool>`             | Self-hosted Linux agent pool                                                 | `agentPool` parameter in both pipeline files                                             |
| `<arm-service-connection>` | Azure Resource Manager service connection                                    | `armServiceConnection` variable in `pipelines/azure-pipelines.yml`                       |
| `<artifacts-feed>`         | Azure Artifacts feed, as `project/feed` (or `feed` for an organization feed) | variable group `web-frontend`: `artifactsFeed`                                           |
| `<resource-group>`         | Resource group of the Web App                                                | `web-frontend`: `resourceGroup`                                                          |
| `<webapp-prod>`            | The Web App (its production slot serves users)                               | `web-frontend`: `webAppName`                                                             |
| `<webapp-staging>`         | The Web App's staging deployment slot, e.g. `staging`                        | `web-frontend`: `stagingSlot`                                                            |
| staging backend            | Backend URL used by staging **and** by the pre-deploy E2E run                | `web-frontend`: `stagingApiBaseUrl`                                                      |
| staging URL                | Public URL of the staging slot, for the nightly run                          | `web-frontend`: `stagingUrl`                                                             |
| production URL             | Public URL of production (custom domain if you have one)                     | `web-frontend`: `productionUrl`                                                          |
| expected greeting          | Exact text the backend returns, checked by E2E (optional)                    | `web-frontend`: `expectedGreeting`; when unset, E2E only checks the heading is not empty |

The service connection name is a YAML variable rather than a variable-group
value. Azure DevOps authorizes service connections before a run starts, and
variable groups aren't read until later. The environment names `web-staging`
and `web-production` are in the YAML for the same reason.

## One-time Azure setup

1. **Web App on Linux** `<webapp-prod>` in `<resource-group>`. Choose a
   **code** publish (not container), runtime stack **Node 24 LTS**
   (`NODE|24-lts`), on a Standard or higher plan (deployment slots need it).
   Add a deployment slot `<webapp-staging>`.
2. **Settings for both the app and the slot:**

   | Setting                          | Value                                                                                                                                                                      |
   | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Startup command                  | `node server.js` (the pipeline also sets it)                                                                                                                               |
   | `API_BASE_URL`                   | Backend base URL for that slot. Mark it as a **deployment slot setting** so it stays with the slot on swap. The pipeline sets the staging value; set production's by hand. |
   | `HOSTNAME`                       | `0.0.0.0` (the pipeline also sets it)                                                                                                                                      |
   | `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false`: the package is already built (the pipeline also sets it)                                                                                                          |
   | Always On                        | On                                                                                                                                                                         |
   | HTTPS Only                       | On                                                                                                                                                                         |
   | ARR affinity                     | Off (the app is stateless)                                                                                                                                                 |
   | Health check path                | `/api/health`                                                                                                                                                              |

   Do not set `PORT`: App Service sets it, and `server.js` reads it.
   `server.js` sets `NODE_ENV=production` itself. Every app variable is listed
   in `.env.example`.

3. **Network.** The staging backend must be reachable from the build agents
   (the pre-deploy E2E run calls it) and from the Web App.

The package contains native binaries for the machine that built it (sharp,
for image optimisation). It is built on the Linux agents, which matches App
Service on Linux. **Never deploy a `dist/app` built on Windows or macOS.**

## Azure Artifacts

1. Create a feed `<artifacts-feed>` (project-scoped is simplest).
2. In the feed's **Feed settings > Permissions**, give the project's
   **Build Service** identity the **Feed Publisher (Contributor)** role, so
   the pipeline can publish and download.
3. Set a **retention policy** on the feed, since every `main` build publishes a
   version. PR builds are not published.

Each version's description holds the commit SHA, and with "Publish pipeline
metadata" on, the version links back to the pipeline run that built it. To
redeploy an older version, re-run that run's **Deploy_Staging** stage, or swap
production back if the previous version is still in the staging slot.

## Health check

`/api/health` returns `200 {"status":"ok"}`. It never calls the backend, so a
backend outage does not get instances recycled. App Service pings it on every
instance and takes an instance out of rotation after repeated failures (useful
with two or more instances). The pipeline also polls it after each deploy and
after the swap.

## Secrets: Key Vault references

Version 1 has no secrets. When one is added (Version 2: `ENTRA_CLIENT_SECRET`,
`SESSION_SECRET`), store it in Key Vault `<keyvault-name>` and set the app
setting to a reference instead of the value:

```text
@Microsoft.KeyVault(SecretUri=https://<keyvault-name>.vault.azure.net/secrets/<secret-name>/)
```

Give the app's and the slot's system-assigned managed identities the
**Key Vault Secrets User** role on the vault. Never put secret values in
pipeline YAML, or in a variable group without the secret flag.

## Slot swap

`Deploy_Production` swaps `<webapp-staging>` into production with
`AzureAppServiceManage@0`. App Service warms up the staging instances before
switching traffic. The production slot stays online throughout, and if the
release is bad, swapping again restores the previous version. Settings marked
as deployment slot settings (`API_BASE_URL`) do not move with the swap.

After a swap, the **staging slot holds the previous production version** until
the next deploy. The nightly run tests whatever is in staging at the time.

## Scaling out

The app keeps no state, so instances need no affinity. Next.js caches (`'use
cache'` entries, the incremental cache and the image optimizer cache) are
per instance, in memory and on local disk. Version 1 caches nothing from the
backend, so this does not matter yet. Once the app caches backend data and runs
on more than one instance, a `updateTag`/`revalidateTag` on one instance will
not reach the others. Then configure a shared store, such as Azure Managed
Redis, through Next.js `cacheHandlers` (for `'use cache'`) and `cacheHandler`
(incremental cache). Not built.

## Azure DevOps setup

1. **Service connection.** An Azure Resource Manager connection (workload
   identity federation) scoped to `<resource-group>`. Put its name in
   `armServiceConnection` in `pipelines/azure-pipelines.yml`.
2. **Variable group** `web-frontend` (Pipelines > Library) with the keys in the
   table above. Authorize both pipelines to use it.
3. **Environments** (Pipelines > Environments): `web-staging` with no checks,
   and `web-production` with an **Approvals** check.
4. **Agent pool.** Self-hosted Linux agents need:
   - git, curl and bash.
   - Passwordless sudo for `playwright install --with-deps`, or Chromium's
     system packages preinstalled (then drop `--with-deps` in
     `templates/setup-node-pnpm.yml`).
   - Outbound access to nodejs.org, registry.npmjs.org, the Playwright browser
     CDN, Google Fonts (`next/font` downloads at build time), Azure Artifacts,
     the staging backend, and the staging and production app URLs.

   The E2E (port 3000) and Accessibility (port 3001) stages can share an
   agent host. Two pipeline runs on the same host at once could still collide.

5. **Pipelines.** Create two pipelines, one from `pipelines/azure-pipelines.yml`
   and one from `pipelines/nightly-e2e.yml`.
6. **Branch policy (PR validation).** Azure Repos Git ignores the YAML `pr:`
   trigger. On `main`, go to Branch policies > Build validation > add the main
   pipeline: trigger _Automatic_, policy requirement _Required_, build
   expiration _Immediately when main is updated_. PR runs then execute
   Validate, Build, E2E and Accessibility. Nothing is published to Azure
   Artifacts or deployed when `Build.Reason` is `PullRequest`.

## Releasing

- Every push to `main` builds, tests and publishes the package, deploys it to
  the staging slot, and runs the full Playwright suite against the slot URL
  (from the deploy task's `AppServiceApplicationUrl` output).
- To release, run the main pipeline on `main` with **Swap staging into
  production** ticked (`deployToProduction`, default off) and approve the
  `web-production` environment. After the swap, the `@smoke` tests run
  against `productionUrl`.

## Nightly checks

`pipelines/nightly-e2e.yml` runs at 02:00 UTC every day, even with no code
changes (`always: true`). It builds and deploys nothing. It runs:

- the full Playwright suite against `stagingUrl`;
- pa11y against `stagingUrl`;
- the `@smoke` tests against `productionUrl`.

Its purpose is to catch a backend change that breaks the frontend within a
day, even when nobody touched the frontend. Change the schedule in the
`cron` line; times are UTC.

## First-run checklist (owner)

- [ ] All stages through **Deploy_Staging** are green.
- [ ] The staging URL shows an `h1` with the greeting from the real backend.
- [ ] The Web App's health check reports healthy.
- [ ] The package version appears in the Azure Artifacts feed.
- [ ] The nightly pipeline shows a scheduled run (Pipelines > ... > Scheduled runs).
