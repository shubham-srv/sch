"use client";

import { ErrorView } from "@/components/error-view";

// `retry` re-fetches and re-renders the segment. `reset` would only re-render
// it, so a failed backend call would not be tried again.
export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return <ErrorView error={error} onRetry={retry} />;
}
