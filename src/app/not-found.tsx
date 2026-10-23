import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p>The page you asked for does not exist.</p>
      <p>
        <Link href="/" className="underline underline-offset-4">
          Go to the home page
        </Link>
      </p>
    </div>
  );
}
