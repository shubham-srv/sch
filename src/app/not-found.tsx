import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

// Renders in the root layout, outside the route groups, so it has its own <main>.
export default function NotFound() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-12 focus:outline-none"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p>The page you asked for does not exist.</p>
      <p>
        <Link href="/" className="underline underline-offset-4">
          Go to the home page
        </Link>
      </p>
    </main>
  );
}
