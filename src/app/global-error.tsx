"use client";

import { ErrorView } from "@/components/error-view";
import "./globals.css";

// Replaces the root layout when the layout itself fails, so it renders its own
// document and cannot use the metadata export.
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>Something went wrong</title>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
          <ErrorView error={error} onRetry={retry} />
        </main>
      </body>
    </html>
  );
}
