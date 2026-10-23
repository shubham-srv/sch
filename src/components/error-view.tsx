import { Button } from "@/components/ui/button";

export interface ErrorViewProps {
  /** The caught error. Only its digest, a server log reference, is shown. */
  error: unknown;
  onRetry: () => void;
}

export function ErrorView({ error, onRetry }: ErrorViewProps) {
  const digest = getDigest(error);
  return (
    <div className="space-y-6">
      <div role="alert" className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p>We couldn&apos;t load this page. Please try again.</p>
        {digest && (
          <p className="text-sm text-muted-foreground">Reference: {digest}</p>
        )}
      </div>
      <Button onClick={() => onRetry()}>Try again</Button>
    </div>
  );
}

function getDigest(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "digest" in error) {
    return typeof error.digest === "string" ? error.digest : undefined;
  }
  return undefined;
}
