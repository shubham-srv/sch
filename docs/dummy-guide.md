# The dummy's guide to this codebase

This guide explains how everything in this repository works, and why each
tool was chosen. It assumes you know some JavaScript and how a website works,
but not Next.js, and that you have **never written automated tests**. Read it
top to bottom once; afterwards, use it as a reference.

**Contents**

1. [The big picture](#1-the-big-picture)
2. [A tour of the folders](#2-a-tour-of-the-folders)
3. [The tools, and why each was picked](#3-the-tools-and-why-each-was-picked)
4. [Testing from zero](#4-testing-from-zero)
5. [Quality gates before code reaches main](#5-quality-gates-before-code-reaches-main)
6. [The pipeline, step by step](#6-the-pipeline-step-by-step)
7. [Configuration and environments](#7-configuration-and-environments)
8. [Troubleshooting](#8-troubleshooting)
9. [Glossary](#9-glossary)

---

## 1. The big picture

### What the app does

There is one page, `/`. It asks the backend API for a greeting and shows it
as the page's main heading (`<h1>`). That's all, on purpose: Version 1 exists
to prove the whole path works, from your laptop through the tests and the
pipeline to Azure. Real features will follow the same path.

### What happens when someone opens the page

```text
 Browser          Next.js server (Node)                                Backend API
    │  GET /             │                                                 │
    │ ─────────────────► │ 1. picks src/app/page.tsx inside layout.tsx     │
    │                    │ 2. sends the static shell at once               │
    │ ◄───── header, "Loading…" ───                                        │
    │                    │ 3. Greeting component calls getGreeting()       │
    │                    │ 4. GET {API_BASE_URL}/greeting ───────────────► │
    │                    │                     ◄────── {"message": "..."}  │
    │                    │ 5. checks the shape (zod), renders <h1>         │
    │ ◄───── <h1>hello world</h1> (streamed into the same response) ──     │
```

Step by step, with the files involved:

1. **The browser asks for `/`.** On Azure, App Service passes the request to
   Node.js running `server.js`, the Next.js production server.
2. **Next.js finds the route.** A folder or file under `src/app/` is a URL.
   `src/app/page.tsx` is `/`, and `src/app/layout.tsx` wraps every page
   (`<html>`, the skip link, the header, `<main>`).
3. **The static parts go out immediately.** The layout and the "Loading…"
   placeholder don't depend on the backend, so Next.js prepared them at build
   time and sends them straight away. This is the _static shell_.
4. **The dynamic part is fetched on the server.** In `page.tsx`, the
   `Greeting` component sits inside `<Suspense>` (React's "this part may take
   a moment" boundary). It calls `getGreeting()` in
   `src/features/greeting/api/queries.ts`, which:
   - gets a backend client from `getApiClient()` (`src/lib/api/server.ts`). That
     reads `API_BASE_URL` from the environment, checked by
     `src/lib/env.server.ts`. It also picks up the incoming request's
     correlation id, a tag that lets the backend's logs be matched with ours;
   - calls `client.get("/greeting")` (`src/lib/api/client.ts`), a thin wrapper
     around `fetch`;
   - passes the JSON to `toGreeting()` (`src/features/greeting/api/mappers.ts`),
     which checks that it really is `{ message: string }`.
5. **The heading is streamed in.** `GreetingHeading` renders the `<h1>`.
   Next.js sends that HTML in the same response, and the browser swaps it in
   where "Loading…" was. The user gets one page; it just arrives in two parts.
6. **If anything fails**, for example the backend is down, answers 500 or
   returns the wrong shape, the code throws an error. Next.js then shows
   `src/app/error.tsx`, which renders `ErrorView`: a friendly message, a
   reference number, and a **Try again** button. Internal details never reach
   the page; they go to the server log.

### Server components and client components

Next.js runs React code in two places:

- **Server components** (the default) run only on the server. They can call
  the backend and read secrets, and their code is never sent to the browser.
  `page.tsx`, `layout.tsx` and `GreetingHeading` are server components.
- **Client components** start with `"use client"`. Their code is also sent to
  the browser, so they can handle clicks and keep state. `error.tsx` is one:
  its button needs a click handler.

Rule of thumb: stay on the server unless you need interactivity, and keep
client components small.

### Why the browser never calls the backend

All backend calls happen on our server. That means:

- the backend's address and, from Version 2, users' access tokens never
  reach the browser;
- the backend doesn't have to be reachable from the internet, or deal with
  cross-origin (CORS) rules;
- there is one place to add logging, retries and error handling.

Files that must stay on the server start with `import "server-only"`. If
someone imports one into a client component by mistake, the build fails.

---

## 2. A tour of the folders

```text
src/app/                   routes: page.tsx, layout.tsx, error.tsx, api/health/route.ts
src/features/greeting/     everything the greeting feature owns
  api/queries.ts           getGreeting(): calls the backend
  api/mappers.ts           the zod schema for the response, and the mapping to the UI model
  components/              GreetingHeading (the <h1>)
  index.ts                 what the rest of the app may import from this feature
src/components/ui/         shadcn/ui components (the Button); treated as vendored code
src/components/            shared components (ErrorView)
src/lib/                   env.server.ts (config), api/ (client, errors), utils.ts
tests/                     Vitest setup, the fake backend (MSW), integration tests
e2e/                       Playwright browser tests and page objects
scripts/package-app.mjs    turns the build into the deployable dist/app folder
pipelines/                 Azure DevOps pipelines
docs/                      this guide and the reference docs
```

Two rules keep this tidy, and ESLint enforces both:

- **Features own their code.** Other code imports a feature only through its
  `index.ts`, never its internal files.
- **Lower layers don't import higher ones.** `lib/` must not import features
  or components, and `components/ui/` must not import features or the API client.

More in [architecture.md](architecture.md).

---

## 3. The tools, and why each was picked

### Building the app

**Next.js** (framework). It is React plus everything a real website needs:
file-based routing, server rendering, streaming, image and font optimisation,
and a production server.

- _Why:_ server rendering gives a fast first page and keeps backend calls on
  the server (see above). It is the most widely used React framework, and it
  runs on Azure App Service as an ordinary Node.js app.
- _Considered:_ a plain React single-page app. The browser would have to call
  the backend directly, exposing it and, later, users' tokens.

**React** (UI library). You build the page from components: functions that
return markup. Next.js is built on it.

**TypeScript** (typed JavaScript). It catches mistakes, such as a misspelled
property or a missing argument, before the code runs. It is set to strict mode,
plus `noUncheckedIndexedAccess`: reading `list[0]` might give `undefined`,
and TypeScript makes you handle that.

**Tailwind CSS** (styling). You style with small utility classes in the
markup, for example `text-4xl font-semibold`, instead of writing separate CSS
files.

- _Why:_ it's fast to write, and spacing and colours stay consistent. The final
  CSS contains only the classes actually used.

**shadcn/ui** (components). It isn't a library you install. Its CLI copies a
component's source into `src/components/ui/` (today, only `button.tsx`), and
from then on we own that code. The components are built on **Base UI**, which
handles accessibility details such as keyboard behaviour and ARIA attributes.

- _Why:_ there's no version lock-in, it is accessible by default, and it is
  styled with Tailwind like the rest of the app.
- _Considered:_ MUI or Chakra. They are heavier, and harder to make look like
  our own design.

**zod** (data validation). You describe the shape of some data once, and zod
checks real values against it at runtime. It also gives you the matching
TypeScript type. We use it twice:

- `src/lib/env.server.ts`: checks that `API_BASE_URL` is set and is an http(s) URL;
- `src/features/greeting/api/mappers.ts`: checks the backend's response.

_Why it's needed:_ TypeScript types disappear when the code runs. Data from
outside the program, such as environment variables or network responses, can
be anything. zod turns "the backend sent something unexpected" into a clear
error instead of a broken page. Since there is no OpenAPI contract, these
schemas are our copy of the backend contract.

**next/font** downloads the Geist font at build time and serves it from our
app, so browsers never contact Google.

### Keeping the code tidy

**pnpm** (package manager). It installs the libraries listed in `package.json`
into `node_modules`, at the exact versions recorded in `pnpm-lock.yaml`.

- _Why not npm:_ pnpm refuses to run libraries' install scripts unless
  they're on an allow list, which is a common way for malicious packages to
  attack. It won't install a version published less than 24 hours ago, which
  avoids pulling in a hijacked release before anyone notices. It is fast and
  saves disk space, and its shell lets the same scripts run on Windows and Linux.
- _One setting to know:_ `nodeLinker: hoisted` makes `node_modules` flat,
  like npm's. The deployed app needs real folders, not symlinks. On its own,
  a flat layout would let you import a package that isn't in `package.json`,
  so an ESLint rule (`import/no-extraneous-dependencies`) forbids that.

**ESLint** (linter). It reads the code and flags bugs, risky patterns and
breaches of our rules: import boundaries, accessibility in JSX, React hook
rules, undeclared dependencies. `pnpm lint` runs it; any warning fails.

**Prettier** (formatter). It rewrites code into one consistent style, so
nobody argues about formatting and diffs show only real changes. Its Tailwind
plugin also sorts class names. `pnpm format` fixes formatting;
`pnpm format:check` only reports it.

**Husky + lint-staged** (git hook). Before every `git commit`, Husky runs
lint-staged, which runs ESLint and Prettier on just the files you're
committing. Problems are caught before they leave your machine.

### Testing

These get a short introduction here; [section 4](#4-testing-from-zero)
shows them in use.

| Tool                                         | What it does                                                                                  | Why this one                                                                                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vitest**                                   | The _test runner_: finds `*.test.ts(x)` files, runs them and reports pass or fail             | Fast, understands TypeScript with no setup, recommended by the Next.js docs, Jest-compatible API (so most online examples apply)                         |
| **React Testing Library**                    | Renders a component in a test and finds elements the way a user would: by role, label or text | Tests what the user sees rather than internal details, so refactors don't break tests. Finding elements by role also pushes us towards accessible markup |
| **user-event**                               | Simulates a real user: clicking, typing, tabbing                                              | More realistic than firing raw DOM events: a click also triggers the hover, focus and pointer events a real one would                                    |
| **jest-dom**                                 | Extra assertions such as `toBeInTheDocument()` and `toHaveTextContent()`                      | Readable checks with clear failure messages                                                                                                              |
| **jsdom**                                    | A simulated browser page (the DOM) inside Node.js                                             | Component tests run in milliseconds without starting a real browser                                                                                      |
| **MSW** (Mock Service Worker)                | Intercepts HTTP requests in tests and answers them with fake responses we define              | Our real `fetch` code runs unchanged; only the network is fake. It can fake errors, empty data and slow responses on demand                              |
| **Playwright**                               | Drives a real browser (Chromium) against the running app                                      | Waits for elements automatically (fewer flaky tests), records traces that replay a failure, and is recommended by the Next.js docs                       |
| **pa11y-ci** (with axe and HTML_CodeSniffer) | Loads pages in a browser and checks them against the WCAG 2 AA accessibility rules            | Runs two different rule engines, so it catches more. It fails the pipeline on any error                                                                  |

### Delivering

**Azure DevOps Pipelines** runs the checks on every pull request, and builds,
tests and deploys on every merge. The steps live in YAML files in
`pipelines/`, so a change to the pipeline is reviewed like code.

**Azure Artifacts** stores each build (the `dist/app` folder) as a versioned
_Universal Package_.

- _Why:_ what gets deployed is exactly what was built and tested, byte for
  byte, and every version is kept so you can see what was released and go back.

**Azure App Service (Web Apps)** runs our Node.js server on Linux without us
managing machines.

- _Why:_ built-in Node 24 support, _deployment slots_ (a staging copy of the
  app you can swap into production instantly), health checks, HTTPS, and
  Key Vault for secrets.

---

## 4. Testing from zero

### 4.1 What an automated test is

A test is a small program that runs a piece of your code and checks the
result. Most tests follow three steps, **Arrange, Act, Assert**:

```ts
import { expect, it } from "vitest";
import { toGreeting } from "./mappers";

it("maps a valid payload to the UI model", () => {
  const payload = { message: "hello world" }; // Arrange: prepare the input
  const result = toGreeting(payload); //          Act: run the code
  expect(result).toEqual({ message: "hello world" }); // Assert: check the result
});
```

`it(...)` declares a test: a name and a function. `expect(actual).toEqual(expected)`
is an _assertion_. If it doesn't hold, the test fails and Vitest shows you the
difference. Tests run in seconds, so you run them constantly: while you work,
before you commit, and in the pipeline before anything merges.

Why bother? Tests catch mistakes before users do. They also let you change
code without fear: if a refactor breaks something, a test turns red.

### 4.2 Words you'll meet

| Term                | Meaning                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| test runner         | The program that finds and runs tests (Vitest, Playwright)                                                        |
| test / test case    | One `it(...)` or `test(...)`: one behaviour checked                                                               |
| suite               | A group of tests, written as `describe("...", () => { ... })`                                                     |
| assertion / matcher | `expect(x).toBe(y)`; `toBe`, `toEqual` and `toHaveTextContent` are _matchers_                                     |
| fake / stub / mock  | A stand-in for something real: a pretend backend, or a function that records how it was called (`vi.fn()`)        |
| fixture             | Sample data used by tests, e.g. `{ message: "hello world" }`                                                      |
| environment         | Where the test runs: plain Node (`node`), a simulated page (`jsdom`) or a real browser                            |
| flaky test          | A test that sometimes passes and sometimes fails without any code change; usually caused by timing or shared data |
| coverage            | Which lines of code the tests ran. A rough guide, not a goal in itself                                            |
| CI                  | Continuous integration: the pipeline running the checks automatically                                             |

### 4.3 Why there are several kinds of test

```text
            ▲  slower, fewer, more realistic
            │    E2E + accessibility   real browser, real app, real backend
            │    integration           our code together, fake HTTP
            │    component             one component in a simulated page
            │    unit                  one function, no page, no network
            ▼  faster, many, more focused
```

Each layer trades speed for realism:

| Layer       | Runs in                     | Speed        | Catches                                                                  | Can't catch                                           |
| ----------- | --------------------------- | ------------ | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| Unit        | Node                        | milliseconds | logic mistakes in one function                                           | how pieces fit together                               |
| Component   | jsdom                       | milliseconds | wrong rendering, broken clicks, missing labels                           | real data, real browser quirks                        |
| Integration | jsdom + MSW                 | milliseconds | query, client and component disagreeing; every error and empty state     | differences between the fake backend and the real one |
| E2E         | real browser + real backend | seconds      | the whole thing not working for a user; frontend and backend not fitting | states the real backend can't produce on demand       |

So we write many fast tests near the bottom and a few realistic ones at the
top. The fake backend (MSW) is how the fast layers cover every UI state; the
real backend is how E2E proves it all fits together.

| Command               | Runs          |
| --------------------- | ------------- |
| `pnpm test:unit`      | unit          |
| `pnpm test:component` | component     |
| `pnpm test:int`       | integration   |
| `pnpm test`           | all three     |
| `pnpm test:e2e`       | E2E           |
| `pnpm a11y`           | accessibility |

### 4.4 Unit tests: `src/features/greeting/api/mappers.test.ts`

A unit test checks one function on its own. `toGreeting()` takes whatever the
backend sent and either returns a `Greeting` or throws a clear error:

```ts
describe("toGreeting", () => {
  it("maps a valid payload to the UI model", () => {
    expect(toGreeting({ message: "hello world" })).toEqual({
      message: "hello world",
    });
  });

  it.each([
    ["missing", {}],
    ["not a string", { message: 42 }],
  ])("throws a clear error when message is %s", (_case, dto) => {
    expect(() => toGreeting(dto)).toThrow(
      /Unexpected greeting response from the backend[\s\S]*message/,
    );
  });
});
```

- `describe` groups related tests under a name.
- `it.each([...])` runs the same test once per row, here once for a missing
  `message` and once for a non-string one. `%s` in the name is filled from the row.
- `expect(() => ...).toThrow(...)` passes only if the function throws an error
  whose message matches.

Other unit tests in the repo:

- `src/lib/api/client.test.ts` passes the client a fake `fetch`, made with
  `vi.fn()`, so no network is used. It then checks the URL it was called
  with and how responses are handled.
- `src/lib/env.server.test.ts` sets fake environment variables with
  `vi.stubEnv` and checks that bad config gives a clear error.

### 4.5 Component tests: `src/components/error-view.test.tsx`

A component test renders one component into a simulated page (jsdom) and
checks what a user would see and do:

```tsx
it("calls onRetry once when the retry button is clicked", async () => {
  const user = userEvent.setup(); // a simulated user
  const onRetry = vi.fn(); // a fake function that records calls
  render(<ErrorView error={rawError} onRetry={onRetry} />);

  await user.click(screen.getByRole("button", { name: "Try again" }));

  expect(onRetry).toHaveBeenCalledTimes(1);
});
```

- `render(...)` puts the component on the simulated page.
- `screen.getByRole("button", { name: "Try again" })` finds the button the way
  a screen reader would, by its role and accessible name. If the button lost
  its text, or were a `<div>` with a click handler, this would fail. That's a
  useful accessibility check for free. Prefer `getByRole` and `getByLabelText`;
  avoid CSS selectors.
- `vi.fn()` creates a fake function. We don't care what retrying _does_ here,
  only that clicking the button asks for it, exactly once.

Another test in the same file renders the component with an error message
containing an internal IP address. It asserts that this text is **not** on the
page:

```tsx
expect(document.body).not.toHaveTextContent("ECONNREFUSED");
```

Testing for what must _not_ happen is as important as testing what should.

### 4.6 Integration tests with a fake backend: `tests/integration/greeting.int.test.tsx`

An integration test runs several real pieces together. Here that is
`getGreeting()`, the real API client, the real mapper and the real
`GreetingHeading`. Only the network is fake, provided by **MSW**.

How MSW works: during tests, every `fetch` goes to MSW instead of the network.
MSW looks for a _handler_ that matches the request and answers with whatever
the handler returns. The default handlers live in `tests/mocks/handlers.ts`:

```ts
export const greetingFixture = { message: "hello world" };

export const handlers = [
  http.get("*/greeting", () => HttpResponse.json(greetingFixture)),
];
```

`tests/setup/vitest.setup.ts` starts MSW before the tests and resets it after
each one. It sets `onUnhandledFrame: "error"`, so a request with no matching
handler fails loudly instead of quietly going to the real network.

The happy path:

```tsx
it("renders the greeting from the backend as the h1", async () => {
  const greeting = await getGreeting();
  render(<GreetingHeading message={greeting.message} />);

  expect(
    screen.getByRole("heading", { level: 1, name: "hello world" }),
  ).toBeInTheDocument();
});
```

**Testing other UI states.** This is the fake backend's real strength. To see
how the code behaves when the backend fails, override the handler for one test
with `server.use(...)`:

```tsx
it("rejects with ApiError on a 500 problem+json response", async () => {
  server.use(
    http.get("*/greeting", () =>
      HttpResponse.json(
        { type: "about:blank", title: "Internal Server Error", status: 500 },
        {
          status: 500,
          headers: { "Content-Type": "application/problem+json" },
        },
      ),
    ),
  );

  const error = await getGreeting().catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 500, title: "Internal Server Error" });
});
```

`HttpResponse.error()` fakes a network failure in the same way, and MSW's
`delay()` fakes a slow backend. You can't reliably get a real backend to do
these things on cue.

Three other lines in that file are worth understanding:

```tsx
vi.mock("next/headers", () => import("../utils/next-headers"));
vi.mock("next/server", () => import("../utils/next-server"));
vi.stubEnv("API_BASE_URL", "http://backend.test/api");
```

- `getApiClient()` uses Next.js functions (`headers()`, `connection()`) that
  only work inside a real request. `vi.mock` swaps them for simple stand-ins
  from `tests/utils/`.
- `vi.stubEnv` sets the environment variable just for these tests. The
  made-up host `backend.test` is never contacted, because MSW answers first.

### 4.7 End-to-end tests: `e2e/tests/hello.spec.ts`

An end-to-end (E2E) test checks the real thing: a real browser opens the
running app, which calls a **real backend**.

**How a run starts.** `playwright.config.ts` decides:

- **No `PLAYWRIGHT_BASE_URL` set (your machine):** Playwright reads
  `.env.local`, then runs `pnpm build && pnpm start` to build and start the
  production app. The app calls the backend at `API_BASE_URL`. If neither
  variable is set, Playwright stops straight away and says so.
- **`PLAYWRIGHT_BASE_URL` set (the pipeline, or testing a deployed site):**
  Playwright starts nothing and tests that URL.

**The test itself:**

```ts
test(
  "shows the backend greeting as the page heading",
  { tag: "@smoke" },
  async ({ page }) => {
    const hello = new HelloPage(page);
    await hello.goto();

    await expect(hello.headings).toHaveCount(1);
    if (expectedGreeting) {
      await expect(hello.greeting(expectedGreeting)).toBeVisible();
    } else {
      await expect(hello.headings).not.toBeEmpty();
    }
    await expect(
      page.getByRole("heading", { name: "Something went wrong" }),
    ).toHaveCount(0);
    await expect(page).toHaveTitle("Hello world");
  },
);
```

- `page` is a browser tab that Playwright controls.
- **`HelloPage` is a _page object_** (`e2e/pages/hello.page.ts`). It is a small
  class that knows how to find things on one page. Tests describe _what_ they
  check; the page object knows _where_ things are. If the page's markup
  changes, you fix one file instead of every test.
- **`await expect(...)` waits.** Playwright keeps retrying an assertion for up
  to 5 seconds, so a heading that streams in a moment later still passes. This
  automatic waiting is why Playwright tests are rarely flaky.
- **No exact-text check by default.** A real backend may return different
  text in each environment. Set `E2E_EXPECTED_GREETING` to check the exact text.
- **Checking it isn't the error page.** The error page also has an `h1`, so the
  test explicitly asserts that "Something went wrong" is absent.
- **`@smoke`** marks the test as read-only and safe to run against production.
  `pnpm test:e2e --grep @smoke` runs only those.

`e2e/tests/health.spec.ts` uses Playwright's `request` helper, which calls a
URL directly with no browser. It checks that `/api/health` answers and that
the security headers are present.

**Watching and debugging E2E tests:**

- `pnpm test:e2e:ui` opens Playwright's UI mode. You can pick a test, watch
  it run, and step back through each action.
- After a run, `pnpm exec playwright show-report` opens the HTML report.
- In the pipeline, a failing test is retried, and the retry records a _trace_:
  a recording of every action, network call and DOM snapshot. Open it with
  `pnpm exec playwright show-trace <trace.zip>`.

### 4.8 Accessibility checks: pa11y

Accessibility means everyone can use the site, including people using screen
readers, keyboards only, or high-contrast settings. `pnpm a11y` loads each URL
listed in `.pa11yci.js` in Chromium and runs two rule engines (axe and
HTML_CodeSniffer) against the **WCAG 2 AA** standard. Any error fails the run.
A failure looks like this:

```text
 • This element has insufficient contrast at this conformance level. Expected a
   contrast ratio of at least 4.5:1, but text in this element has a contrast
   ratio of 1.61:1. Recommendation: change text colour to #767676.
   (html > body > p)
```

It tells you the rule, the element and usually the fix. Automated tools catch
many problems but not all, so try new pages with the keyboard too: Tab through
everything, and check you can always see where the focus is.

### 4.9 Running tests and reading results

```sh
pnpm test                         # all Vitest layers once
pnpm exec vitest                  # watch mode: re-runs affected tests on every save
pnpm exec vitest mappers          # only test files whose path contains "mappers"
pnpm test:cov                     # with coverage; open coverage/index.html
```

A passing Vitest run ends like this:

```text
 ✓ |unit| src/features/greeting/api/mappers.test.ts (4 tests) 10ms
 ✓ |component| src/components/error-view.test.tsx (4 tests) 188ms
 ✓ |integration| tests/integration/greeting.int.test.tsx (5 tests) 282ms
      Tests  33 passed (33)
```

`|unit|`, `|component|` and `|integration|` show which layer each file ran in.
When a test fails, Vitest shows the test's name, the assertion that failed,
the _expected_ and _received_ values, and the line number. Read the failure
from the top: the name tells you which behaviour broke, and the diff tells you how.

### 4.10 Worked example: testing a new feature

Say you're adding an Orders page that calls `GET /orders` and shows a table.
Here are the tests you'd write, layer by layer.

**1. The contract, in `src/features/orders/api/mappers.ts`.** Copy a real
response from the backend, and describe it:

```ts
const ordersDtoSchema = z.array(
  z.object({ id: z.string(), status: z.string(), total: z.number() }),
);

export function toOrders(dto: unknown): Order[] {
  const result = ordersDtoSchema.safeParse(dto);
  if (!result.success) {
    throw new Error(
      `Unexpected orders response:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
```

**2. A unit test for the mapper**: a valid list maps, and a wrong shape
throws a clear error (as in 4.4).

**3. A fixture and a handler** in `tests/mocks/handlers.ts`, using the real
response you copied:

```ts
export const ordersFixture = [
  { id: "A-1001", status: "open", total: 42.5 },
  { id: "A-1002", status: "shipped", total: 19.99 },
];

export const handlers = [
  http.get("*/greeting", () => HttpResponse.json(greetingFixture)),
  http.get("*/orders", () => HttpResponse.json(ordersFixture)),
];
```

**4. Component tests for `OrdersTable`.** Pass orders as props and check
that the rows render. Pass an empty list and check that a "No orders yet"
message appears.

**5. Integration tests for every UI state** in
`tests/integration/orders.int.test.tsx`:

- **success:** `listOrders()` with the default handler, render the table,
  expect two rows;
- **empty:** `server.use(http.get("*/orders", () => HttpResponse.json([])))`,
  expect the empty message;
- **backend error:** a 500 handler, expect `ApiError`;
- **network failure:** `HttpResponse.error()`, expect `ApiError`.

**6. One E2E test against the real backend.** Open `/orders` and check that a
table with a header row is visible. Don't assume particular orders exist,
because a real backend's data changes. If the test only reads data, tag it
`@smoke`.

**7. Add `/orders` to `.pa11yci.js`** so the accessibility checks cover the new page.

The fake backend covers every state; the real backend proves the page works
with real data. When the backend changes its response, update the schema
and the fixture together. The nightly E2E run will tell you if they drift.

---

## 5. Quality gates before code reaches main

1. **While you work:** the editor shows TypeScript and ESLint errors;
   `pnpm exec vitest` re-runs tests on every save.
2. **On `git commit`:** Husky runs lint-staged, which runs ESLint and Prettier
   on the files you're committing. Fix what it reports, then commit again.
3. **Before you push:** `pnpm verify` runs what the pipeline's first stage
   runs (format check, lint, typecheck, all Vitest tests), plus the build.
   Run `pnpm test:e2e` too if you changed a page.
4. **On the pull request:** the pipeline runs everything again, including E2E
   and accessibility. A branch policy blocks merging until it passes.
   `.azuredevops/pull_request_template.md` adds a short checklist to every PR.

---

## 6. The pipeline, step by step

`pipelines/azure-pipelines.yml` runs on every pull request (through the
branch policy) and every merge to `main`:

| Stage                 | What happens                                                                                                                                                                                        | On PRs?             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **Validate**          | Install, Prettier check, ESLint, TypeScript, all Vitest tests with coverage. Results appear in the run's **Tests** and **Code Coverage** tabs                                                       | yes                 |
| **Build**             | `pnpm build` creates `dist/app`, kept as a pipeline artifact. On `main` it is also published to Azure Artifacts as package `web`, version `0.1.<run number>`                                        | yes (not published) |
| **E2E**               | Starts `dist/app` on the agent, pointed at the staging backend, and runs every Playwright test                                                                                                      | yes                 |
| **Accessibility**     | Same app, separate job; runs pa11y                                                                                                                                                                  | yes                 |
| **Deploy_Staging**    | Downloads the package from Azure Artifacts, deploys it to the Web App's staging slot, waits for `/api/health`, runs every Playwright test against staging                                           | no                  |
| **Deploy_Production** | Only when the run was started with **Swap staging into production** ticked, and after someone approves: swaps staging into production, waits for health, runs the `@smoke` tests against production | no                  |

`pipelines/nightly-e2e.yml` runs every night at 02:00 UTC, even when nothing
changed. It runs every E2E test and pa11y against staging, and the `@smoke`
tests against production. If the backend changes in a way that breaks us,
we find out the next morning.

The steps shared by several stages live in `pipelines/templates/`:

| Template                 | Does                                                  |
| ------------------------ | ----------------------------------------------------- |
| `setup-node-pnpm.yml`    | Node, pnpm, a cached install, and optionally Chromium |
| `serve-app.yml`          | Starts and stops `dist/app` on the agent              |
| `deploy-webapp.yml`      | Deploys and waits for health                          |
| `wait-for-health.yml`    | Polls `/api/health` until it answers                  |
| `publish-playwright.yml` | Publishes test results, reports and traces            |

When something fails, open the failed step's log first. For test failures,
use the **Tests** tab and the published report and traces
([testing.md](testing.md) explains how).

---

## 7. Configuration and environments

The same build runs everywhere; only configuration changes.

|                          | Your machine                              | Pipeline (E2E stage)          | Staging                            | Production                                     |
| ------------------------ | ----------------------------------------- | ----------------------------- | ---------------------------------- | ---------------------------------------------- |
| App                      | `pnpm dev` or `pnpm start`                | `dist/app` on the agent       | Web App staging slot               | Web App production slot                        |
| Backend (`API_BASE_URL`) | your backend container, from `.env.local` | staging backend               | staging backend                    | production backend                             |
| Set in                   | `.env.local`                              | variable group `web-frontend` | app settings (set by the pipeline) | app settings (set by hand, sticky to the slot) |
| E2E                      | `pnpm test:e2e`                           | every test                    | every test                         | `@smoke` only                                  |

Configuration is read when the server starts, not when the app is built.
That's why one build can serve every environment, and why `NEXT_PUBLIC_*`
variables, which are fixed at build time, are not used for anything that
differs between environments. Secrets (from Version 2) come from Azure
Key Vault, never from the repo.

---

## 8. Troubleshooting

| Symptom                                                            | Likely cause and fix                                                                                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The page says "Something went wrong" locally                       | The app can't reach the backend. Is your backend container running? Is `API_BASE_URL` in `.env.local` right? The terminal running the app shows the real error |
| `Invalid server environment variables … API_BASE_URL`              | `API_BASE_URL` is missing or isn't an `http(s)` URL. Copy `.env.example` to `.env.local` and fill it in                                                        |
| Playwright says "E2E needs a running backend"                      | Set `API_BASE_URL` (in `.env.local`), or set `PLAYWRIGHT_BASE_URL` to test a deployed site                                                                     |
| E2E passes but seems to test the wrong thing                       | Something else was already running on port 3000, and Playwright reused it. Stop it and re-run                                                                  |
| `[MSW] … intercepted a request without a matching request handler` | Your code called an endpoint that `tests/mocks/handlers.ts` doesn't know. Add a handler, or `server.use(...)` one in the test                                  |
| `EPERM` when running `pnpm build` on Windows                       | A running `pnpm start` is holding `dist/app`. Stop it first                                                                                                    |
| ESLint: `'x' should be listed in the project's dependencies`       | You imported a package that isn't in `package.json`. Run `pnpm add x` (or `pnpm add -D x` for test-only code)                                                  |
| ESLint: `Import a feature through its index.ts`                    | Import from `@/features/<name>`, and export what you need from that feature's `index.ts`                                                                       |
| ESLint: `Use the "@/" alias instead of "../" imports`              | Write `@/lib/...` instead of `../../lib/...`                                                                                                                   |
| pa11y reports errors                                               | Read the message: it names the element and usually the fix (missing label, low contrast, missing `alt`)                                                        |
| The commit is rejected by the pre-commit hook                      | Read the ESLint or Prettier output, fix the file, `git add` it again, and commit                                                                               |

---

## 9. Glossary

| Term                            | Meaning                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **SSR (server-side rendering)** | Building the page's HTML on the server, so the browser receives a ready page                                    |
| **Server Component**            | A React component that runs only on the server; its code never reaches the browser                              |
| **Client Component**            | A component marked `"use client"`; its code also runs in the browser, so it can handle clicks                   |
| **Suspense / streaming**        | Sending a page in parts: the ready parts first, slower parts as they finish, in the same response               |
| **Static shell**                | The parts of a page that don't depend on request data, prepared at build time                                   |
| **Hydration**                   | The browser attaching React to server-rendered HTML so buttons start working                                    |
| **Standalone output**           | Next.js's minimal production server (`server.js` plus only the `node_modules` it needs)                         |
| **`dist/app`**                  | Our packaged standalone output with its static files: the thing that gets tested and deployed                   |
| **Environment variable**        | Configuration given to a program when it starts (`API_BASE_URL`)                                                |
| **App setting**                 | Azure's name for an environment variable on a Web App                                                           |
| **Deployment slot**             | A second live copy of a Web App (staging) with its own URL and settings                                         |
| **Swap**                        | Exchanging two slots instantly: staging becomes production and production becomes staging                       |
| **Universal Package**           | A versioned bundle of files stored in Azure Artifacts                                                           |
| **Pipeline artifact**           | Files passed between stages of one pipeline run                                                                 |
| **Branch policy**               | A rule on `main` that blocks merging until checks pass                                                          |
| **Correlation id**              | A tag (`X-Correlation-Id`) sent with backend calls, so frontend and backend logs for one request can be matched |
| **ProblemDetails**              | The standard JSON error format ASP.NET Core returns (`type`, `title`, `status`, `detail`)                       |
| **Fixture**                     | Sample data used by tests                                                                                       |
| **Mock / fake / stub**          | A stand-in for a real thing in a test                                                                           |
| **Flaky test**                  | A test that passes or fails at random; fix it rather than re-running                                            |
| **WCAG 2 AA**                   | The accessibility standard our automated checks use                                                             |
