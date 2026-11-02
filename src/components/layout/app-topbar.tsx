import type { ReactNode } from "react";

export interface AppTopbarProps {
  /** Shown at the end of the bar, e.g. the signed-in user's menu. */
  userMenu?: ReactNode;
}

export function AppTopbar({ userMenu }: AppTopbarProps) {
  return (
    <header className="border-b">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        {/* TODO(owner): replace "Web" with the product name. */}
        <span className="font-semibold">Web</span>
        {userMenu}
      </div>
    </header>
  );
}
