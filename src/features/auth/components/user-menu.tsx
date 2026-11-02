import { Button } from "@/components/ui/button";
import { signOutOfApp } from "@/features/auth/api/actions";
import type { CurrentUser } from "@/features/auth/types";

export interface UserMenuProps {
  user: CurrentUser;
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm" title={user.email}>
        {user.name}
      </span>
      <form action={signOutOfApp} aria-label="Sign out">
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-7 w-40 animate-pulse rounded-md bg-muted"
    />
  );
}
