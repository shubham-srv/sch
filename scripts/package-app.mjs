// Assembles the deployable app in dist/app after `next build`: the standalone
// server (server.js plus the node_modules it needs) and the static files that
// Next.js leaves for the host to copy. This folder is what the pipeline tests,
// publishes to Azure Artifacts and deploys to the Web App.
//
// The package must contain no symlinks, because a zip deployment to App
// Service does not reliably keep them. pnpm's flat layout (nodeLinker: hoisted)
// produces none; `dereference` makes sure none slip through.
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const from = (path) => `${root}${path}`;
const out = from("dist/app");

if (!existsSync(from(".next/standalone/server.js"))) {
  console.error("No standalone build found. Run `next build` first.");
  process.exit(1);
}

// Retries cover Windows briefly locking fresh files (antivirus, indexing).
// A running `pnpm start` also locks dist/app on Windows: stop it first.
rmSync(out, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
cpSync(from(".next/standalone"), out, { recursive: true, dereference: true });
cpSync(from(".next/static"), `${out}/.next/static`, { recursive: true });
cpSync(from("public"), `${out}/public`, { recursive: true });

console.log("Packaged the app in dist/app (start it with `pnpm start`).");
