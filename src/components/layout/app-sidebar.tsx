import Link from "next/link";

export function AppSidebar() {
  return (
    <nav aria-label="Main" className="w-48 shrink-0 border-r p-4">
      <ul className="space-y-1">
        <li>
          <Link
            href="/"
            className="block rounded-md px-2 py-1 text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Home
          </Link>
        </li>
      </ul>
    </nav>
  );
}
