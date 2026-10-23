import type { Metadata } from "next";
import { Suspense } from "react";
import { getGreeting, GreetingHeading } from "@/features/greeting";

export const metadata: Metadata = { title: "Hello world" };

export default function HomePage() {
  // The greeting is fetched per request, so it streams in after the static shell.
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <Greeting />
    </Suspense>
  );
}

async function Greeting() {
  const greeting = await getGreeting();
  return <GreetingHeading message={greeting.message} />;
}
