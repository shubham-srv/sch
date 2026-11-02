import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth";
import { safeNextPath } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      {/* ?next is read per request, so the form streams in after the static
          shell; the fallback is the same form returning to the home page. */}
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginFormWithNext({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={safeNextPath(next)} />;
}
