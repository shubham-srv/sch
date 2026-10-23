// Test fake only: never imported by app code, never in the production image.
// Serves the same MSW handlers that Vitest uses (tests/mocks/handlers.ts), so
// there is one fake backend. MSW's getResponse() resolves each request against
// the handlers; this file only adapts node:http to the Fetch API.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { getResponse } from "msw";
import { handlers } from "../../tests/mocks/handlers";

const port = Number(process.env.MOCK_API_PORT ?? 4010);
const host = process.env.MOCK_API_HOST ?? "0.0.0.0";

async function toFetchRequest(req: IncomingMessage): Promise<Request> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? host}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    for (const item of [value ?? []].flat()) headers.append(name, item);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const hasBody = chunks.length > 0 && !["GET", "HEAD"].includes(req.method!);
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const response = await getResponse(handlers, await toFetchRequest(req));

  if (!response) {
    res.writeHead(404, { "Content-Type": "application/problem+json" });
    res.end(
      JSON.stringify({
        title: "No mock handler",
        status: 404,
        detail: `${req.method} ${req.url}`,
      }),
    );
    return;
  }

  // HttpResponse.error() simulates a network failure: drop the connection.
  if (response.type === "error") {
    req.socket.destroy();
    return;
  }

  res.statusCode = response.status;
  res.statusMessage = response.statusText;
  response.headers.forEach((value, name) => res.appendHeader(name, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

const server = createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});

server.listen(port, host, () => {
  console.log(`Mock API listening on http://${host}:${port}`);
});

// Exit promptly on `docker compose down`, where Node runs as PID 1 and has no
// default signal handlers.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
