// Fetches the backend's OpenAPI document from OPENAPI_URL into the committed
// snapshot. Run through `pnpm api:types:pull`, which then formats the file
// and regenerates the TypeScript types.
import { writeFile } from "node:fs/promises";

const url = process.env.OPENAPI_URL;
if (!url) {
  console.error("OPENAPI_URL is not set (see .env.example).");
  process.exit(1);
}

const response = await fetch(url);
if (!response.ok) {
  console.error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const document = await response.json();
await writeFile(
  new URL("../openapi/openapi.json", import.meta.url),
  `${JSON.stringify(document, null, 2)}\n`,
);
console.log(`Wrote openapi/openapi.json from ${url}`);
