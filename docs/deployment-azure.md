# Deploying to Azure

The pipeline builds one image per run, pushes it to Azure Container Registry,
and deploys it to the **staging slot** of a single Web App for Containers. It
smoke-tests the slot, then (on request, after approval) **swaps** the slot into
production. Every environment runs the same image; only app settings differ.

## Placeholders

| Placeholder                | Meaning                                               | Where it is set                                                               |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `<agent-pool>`             | Self-hosted Linux agent pool                          | `agentPool` parameter in `pipelines/azure-pipelines.yml`                      |
| `<acr-service-connection>` | Docker registry service connection to the ACR         | `acrServiceConnection` variable in `pipelines/azure-pipelines.yml`            |
| `<arm-service-connection>` | Azure Resource Manager service connection             | `armServiceConnection` variable in `pipelines/azure-pipelines.yml`            |
| `<acr-name>`               | ACR name (without `.azurecr.io`)                      | variable group `web-frontend`: `acrName`                                      |
| `<resource-group>`         | Resource group of the Web App                         | `web-frontend`: `resourceGroup`                                               |
| `<webapp-prod>`            | The Web App (its production slot serves users)        | `web-frontend`: `webAppName`                                                  |
| `<webapp-staging>`         | The Web App's staging deployment slot, e.g. `staging` | `web-frontend`: `stagingSlot`                                                 |
| backend URL                | Reachable backend implementing `GET /greeting`        | `web-frontend`: `stagingApiBaseUrl`                                           |
| expected greeting          | Text the real backend returns, for the smoke test     | `web-frontend`: `smokeExpectedGreeting` (optional; defaults to `hello world`) |

Service connection names cannot come from a variable group. Azure DevOps
authorizes them before a run starts, before variable groups are read. So they
are YAML variables in the pipeline file, as are the environment names
`web-staging` and `web-production`.

## One-time Azure setup

1. **Container registry** `<acr-name>`.
2. **Web App for Containers** (Linux) `<webapp-prod>` in `<resource-group>` on
   a Standard or higher plan (deployment slots need it). Add a deployment slot
   `<webapp-staging>`.
3. **Pull from ACR with managed identity.** Give the Web App and the slot a
   system-assigned identity (each slot has its own), grant both `AcrPull` on
   the registry, and enable `acrUseManagedIdentityCreds` in their site config.
4. **Settings for both the app and the slot:**

   | Setting                               | Value                                                                                                                                                                      |
   | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `WEBSITES_PORT`                       | `3000` (the pipeline also sets it)                                                                                                                                         |
   | `WEBSITES_ENABLE_APP_SERVICE_STORAGE` | `false` (the pipeline also sets it)                                                                                                                                        |
   | `API_BASE_URL`                        | Backend base URL for that slot. Mark it as a **deployment slot setting** so it stays with the slot on swap. The pipeline sets the staging value; set production's by hand. |
   | Always On                             | On                                                                                                                                                                         |
   | HTTPS Only                            | On                                                                                                                                                                         |
   | ARR affinity                          | Off (the app is stateless)                                                                                                                                                 |
   | Health check path                     | `/api/health`                                                                                                                                                              |

   Every runtime variable is listed in `.env.example`. Do not set
   `NODE_ENV`, `PORT` or `HOSTNAME`; the image sets them.

## Health check

`/api/health` returns `200 {"status":"ok"}`. It never calls the backend, so a
backend outage does not get instances recycled. App Service pings it on every
instance and takes an instance out of rotation after repeated failures (useful
with two or more instances). The image's Docker `HEALTHCHECK` is for local runs
and Compose; App Service ignores it.

## Secrets: Key Vault references

Version 1 has no secrets. When one is added (Version 2: `ENTRA_CLIENT_SECRET`,
`SESSION_SECRET`), store it in Key Vault `<keyvault-name>` and set the app
setting to a reference instead of the value:

```text
@Microsoft.KeyVault(SecretUri=https://<keyvault-name>.vault.azure.net/secrets/<secret-name>/)
```

The app's and the slot's managed identities need the **Key Vault Secrets User**
role on the vault. Never put secret values in pipeline YAML or in a variable
group without the secret flag.

## Slot swap

`Deploy_Production` swaps `<webapp-staging>` into production with
`AzureAppServiceManage@0`. App Service warms up the staging instances before
switching traffic. The production slot stays online throughout, and if the
release is bad, swapping again restores the previous image. Settings marked as
deployment slot settings (`API_BASE_URL`) do not move with the swap.

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

1. **Service connections.**
   - A Docker registry connection to the ACR. Put its name in `acrServiceConnection`.
   - An Azure Resource Manager connection (workload identity federation)
     scoped to `<resource-group>`. Put its name in `armServiceConnection`.
2. **Variable group** `web-frontend` (Pipelines > Library) with the keys in
   the table above. Authorize the pipeline to use it.
3. **Environments** (Pipelines > Environments): `web-staging` with no checks,
   and `web-production` with an **Approvals** check.
4. **Agent pool.** Self-hosted Linux agents need:
   - Docker 23+ with Compose v2 and BuildKit, plus git and curl.
   - Passwordless sudo for `playwright install --with-deps`, or Chromium's
     system packages preinstalled (then drop `--with-deps` in
     `templates/setup-node-pnpm.yml`).
   - Outbound access to nodejs.org, registry.npmjs.org, the Playwright browser
     CDN, Google Fonts (`next/font` downloads at build time), the ACR and the
     staging app.

   If several agents share a host, the E2E and Accessibility stages already
   use different ports, but two pipeline runs can still collide.

5. **Pipeline.** Create it from `pipelines/azure-pipelines.yml`.
6. **Branch policy (PR validation).** Azure Repos Git ignores the YAML `pr:`
   trigger. On `main`, go to Branch policies > Build validation > add this
   pipeline: trigger _Automatic_, policy requirement _Required_, build
   expiration _Immediately when main is updated_. PR runs then execute
   Validate, Build, E2E and Accessibility; both deploy stages are skipped when
   `Build.Reason` is `PullRequest`.

## Releasing

- Every push to `main` deploys to the staging slot and runs the `@smoke`
  Playwright tests against the slot URL (from the deploy task's
  `AppServiceApplicationUrl` output).
- To release, run the pipeline on `main` with **Swap staging into
  production** ticked (`deployToProduction`, default off) and approve the
  `web-production` environment.

## First-run checklist (owner)

- [ ] All stages through **Deploy_Staging** are green.
- [ ] The staging URL shows an `h1` with the greeting from the real backend.
- [ ] The Web App's health check reports healthy.
